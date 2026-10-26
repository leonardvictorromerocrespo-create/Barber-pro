-- Incremental from 005. No automatic production execution.
begin;
do $$ begin
 if to_regprocedure('public.meryo_reservas_estado()') is null then raise exception 'Missing 005'; end if;
end $$;
update meryo_private.launch_settings set plazo_pago_segundos=600 where id=1;
alter table meryo_private.launch_settings add column push_envio_habilitado boolean not null default false;

-- Signed JWT AAL enforced at the SQL boundary, including every RLS admin branch.
create or replace function public.es_admin() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb->>'aal'='aal2',false)
 and exists(select 1 from public.profiles where id=auth.uid() and rol='admin' and activo is true)
 and exists(select 1 from auth.sessions s where s.user_id=auth.uid() and s.id::text=coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb->>'session_id')
 and exists(select 1 from auth.mfa_factors f where f.user_id=auth.uid() and f.status='verified');
$$;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,email,rol,nombre) values(new.id,new.email,'cliente',
 nullif(left(trim(coalesce(new.raw_user_meta_data->>'nombre',new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name','')),80),''))
 on conflict(id) do nothing;
 return new;
end $$;

-- Explicit column allowlists: role/ownership/verification cannot be browser writes.
revoke update on public.profiles,public.barberias from anon,authenticated;
revoke update(id,email,rol,barberia_id,activo,nombre,telefono) on public.profiles from anon,authenticated;
grant update(nombre,telefono) on public.profiles to authenticated;
revoke update(id,nombre,distrito,direccion,descripcion,imagen_url,rating,total_resenas,precio_desde,estado,verificada,lat,lng,whatsapp,correo_contacto,video_presentacion_url,acepta_auto,disponible_ahora,created_at) on public.barberias from anon,authenticated;
grant update(nombre,distrito,direccion,descripcion,imagen_url,lat,lng,whatsapp,correo_contacto,video_presentacion_url,disponible_ahora) on public.barberias to authenticated;
do $policies$
declare tbl text; op text;
begin
 foreach tbl in array array['profiles','barberias','servicios','horarios','bloqueos','barberia_media'] loop
  foreach op in array array['INSERT','UPDATE','DELETE'] loop
   execute format('create policy %I on public.%I as restrictive for %s to authenticated %s',
    'meryo_active_'||lower(op),tbl,op,
    case op when 'INSERT' then 'with check(public.meryo_cuenta_activa())'
     when 'UPDATE' then 'using(public.meryo_cuenta_activa()) with check(public.meryo_cuenta_activa())'
     else 'using(public.meryo_cuenta_activa())' end);
  end loop;
 end loop;
end $policies$;
revoke all on function public.notificar(uuid,text,text,text,uuid),public.notificar_barberia(bigint,text,text,text,uuid),public.cfg(text) from public,anon,authenticated;

create or replace function public.meryo_reservas_config() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('respuesta_segundos',900,'plazo_pago_segundos',plazo_pago_segundos,
 'modelo_comercial',modelo_comercial,'comision_por_corte',0,'cobros_habilitados',false,
 'push_disponible',push_envio_habilitado and push_public_key is not null,
 'push_public_key',case when push_envio_habilitado then push_public_key else null end)
 from meryo_private.launch_settings where id=1;
$$;

-- No retroactive expiry is assigned to historical accepted appointments.
-- New acceptances take the approved window from settings.
do $message$
declare definition text;
begin
 definition:=pg_get_functiondef('public.responder_reserva(uuid,boolean)'::regprocedure);
 if position('Plazo de pago pendiente de definir.' in definition)=0 then raise exception 'Unexpected response function: compare first'; end if;
 definition:=replace(definition,
 '''Tu solicitud fue aceptada. Adelanto del 50 %: S/ '' || v_r.monto_adelanto || ''. Pago bloqueado hasta integrar la pasarela. Plazo de pago pendiente de definir.''',
 '''Tu barbero aceptó la cita. Tienes 10 minutos para pagar el adelanto y confirmarla.''');
 execute definition;
end $message$;

-- Lease state is private; recipient binding and stale events checked by sender.
alter table meryo_private.push_outbox
 add column attempts integer not null default 0,
 add column lease_until timestamptz,
 add column lease_token uuid,
 add column available_at timestamptz not null default clock_timestamp(),
 add column provider_accepted_at timestamptz;
alter table meryo_private.push_outbox drop constraint push_outbox_status_check;
alter table meryo_private.push_outbox add constraint push_outbox_status_check check(status in ('pending_provider','queued','leased','accepted','expired','failed'));
create function public.meryo_quitar_push(p_endpoint text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 delete from meryo_private.push_subscriptions where user_id=auth.uid() and endpoint=p_endpoint;
 return found;
end $$;
revoke all on function public.meryo_quitar_push(text) from public,anon;
grant execute on function public.meryo_quitar_push(text) to authenticated;
notify pgrst,'reload schema';
commit;
