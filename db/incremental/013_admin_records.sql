begin;
create table meryo_private.reservation_events(
 id uuid primary key default gen_random_uuid(),reserva_id uuid not null references public.reservas(id),
 actor_id uuid,action text not null,before_data jsonb,after_data jsonb,created_at timestamptz not null default clock_timestamp()
);
create index on meryo_private.reservation_events(reserva_id,created_at);
alter table meryo_private.reservation_events enable row level security;
revoke all on meryo_private.reservation_events from public,anon,authenticated;
create function meryo_private.audit_reservation() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' or to_jsonb(new) is distinct from to_jsonb(old) then
  insert into meryo_private.reservation_events(reserva_id,actor_id,action,before_data,after_data)
  values(new.id,auth.uid(),case when tg_op='INSERT' then 'solicitud' else 'cambio' end,
   case when tg_op='INSERT' then null else jsonb_build_object('estado',old.estado,'inicio',old.inicio,'fin',old.fin,'expira_respuesta_en',old.expira_respuesta_en,'expira_pago_en',old.expira_pago_en) end,
   jsonb_build_object('estado',new.estado,'inicio',new.inicio,'fin',new.fin,'expira_respuesta_en',new.expira_respuesta_en,'expira_pago_en',new.expira_pago_en));
 end if;return new;
end$$;
create trigger meryo_reservation_audit after insert or update on public.reservas for each row execute function meryo_private.audit_reservation();

create function public.meryo_admin_usuarios(p_search text default '',p_role text default '',p_active text default '',p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;total bigint;
begin
 if not public.es_admin() then raise exception 'Administración requiere MFA' using errcode='42501';end if;
 if p_offset<0 or p_offset>100000 or length(p_search)>100 then raise exception 'Filtro fuera de rango';end if;
 with filtered as (
 select p.id,p.nombre,p.email,p.telefono,p.rol,p.activo,p.barberia_id,b.nombre barberia,
 exists(select 1 from meryo_private.shop_owners o where o.user_id=p.id) propietario,
 case when b.id is null then false else not public.meryo_barberia_publicable(b.id) end demo
 from public.profiles p left join public.barberias b on b.id=p.barberia_id
 where (coalesce(p_role,'')='' or p.rol=p_role or (p_role='propietario' and exists(select 1 from meryo_private.shop_owners o where o.user_id=p.id)))
 and (coalesce(p_active,'')='' or p.activo=(p_active='true'))
 and position(lower(coalesce(p_search,'')) in lower(concat_ws(' ',p.nombre,p.email,p.telefono,b.nombre,p.id::text)))>0
 ),page as (select * from filtered order by nombre nulls last,id limit 50 offset p_offset)
 select coalesce((select jsonb_agg(to_jsonb(x)) from page x),'[]'::jsonb),(select count(*) from filtered) into result,total;
 return jsonb_build_object('rows',result,'total',total,'offset',p_offset,'limit',50,'server_now',clock_timestamp());
end$$;

create function public.meryo_admin_reservas(p_from date,p_to date,p_shop bigint default null,p_status text default '',p_search text default '',p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;total bigint;
begin
 if not public.es_admin() then raise exception 'Administración requiere MFA' using errcode='42501';end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 or p_offset<0 or p_offset>100000 or length(p_search)>100 then raise exception 'Filtro fuera de rango; máximo 366 días';end if;
 with filtered as (
 select r.id,r.barberia_id,b.nombre barberia,r.cliente_id,r.cliente_nombre,r.servicio_nombre,r.inicio,r.fin,r.estado,r.precio_total,r.monto_adelanto,r.expira_respuesta_en,r.expira_pago_en,
 to_jsonb(r)->>'barbero_id' barbero_id,not public.meryo_barberia_publicable(b.id) demo
 from public.reservas r join public.barberias b on b.id=r.barberia_id
 where r.inicio>=(p_from::timestamp at time zone 'America/Lima') and r.inicio<((p_to+1)::timestamp at time zone 'America/Lima')
 and (p_shop is null or r.barberia_id=p_shop) and (coalesce(p_status,'')='' or r.estado=p_status)
 and position(lower(coalesce(p_search,'')) in lower(concat_ws(' ',r.cliente_nombre,r.servicio_nombre,b.nombre,r.id::text,to_jsonb(r)->>'barbero_id')))>0
 ),page as (select * from filtered order by inicio desc,id limit 50 offset p_offset)
 select coalesce((select jsonb_agg(to_jsonb(x)) from page x),'[]'::jsonb),(select count(*) from filtered) into result,total;
 return jsonb_build_object('rows',result,'total',total,'offset',p_offset,'limit',50,'server_now',clock_timestamp());
end$$;

create function public.meryo_admin_reserva_detalle(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.es_admin() then raise exception 'Administración requiere MFA' using errcode='42501';end if;
 select to_jsonb(r)||jsonb_build_object('barberia',b.nombre,'demo',not public.meryo_barberia_publicable(b.id),
 'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at) from meryo_private.reservation_events e where e.reserva_id=r.id),'[]'::jsonb),
 'payments',coalesce((select jsonb_agg(jsonb_build_object('estado',p.estado,'monto',p.monto,'moneda',p.moneda,'proveedor',p.proveedor,'pagado_en',p.pagado_en,'verificado_servidor',exists(select 1 from meryo_private.payment_intents i join meryo_private.payment_receipts c on c.intent_id=i.id where i.reserva_id=r.id and i.referencia=p.proveedor_ref and i.proveedor=p.proveedor and i.live and c.resultado='confirmada'))) from public.pagos p where p.reserva_id=r.id),'[]'::jsonb),
 'server_now',clock_timestamp()) into result from public.reservas r join public.barberias b on b.id=r.barberia_id where r.id=p_id;
 if result is null then raise exception 'Reserva no encontrada';end if;return result;
end$$;

create function public.meryo_admin_resumen(p_from date,p_to date) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.es_admin() then raise exception 'Administración requiere MFA' using errcode='42501';end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 then raise exception 'Periodo inválido';end if;
 return jsonb_build_object('desde',p_from,'hasta',p_to,'server_now',clock_timestamp(),
 'barberias',(select coalesce(jsonb_object_agg(estado,n),'{}'::jsonb) from (select estado,count(*) n from public.barberias where public.meryo_barberia_publicable(id) group by estado) x),
 'reservas',(select coalesce(jsonb_object_agg(estado,n),'{}'::jsonb) from (select estado,count(*) n from public.reservas where public.meryo_barberia_publicable(barberia_id) and inicio>=(p_from::timestamp at time zone 'America/Lima') and inicio<((p_to+1)::timestamp at time zone 'America/Lima') group by estado) x),
 'importe_solicitado',coalesce((select sum(precio_total) from public.reservas where public.meryo_barberia_publicable(barberia_id) and inicio>=(p_from::timestamp at time zone 'America/Lima') and inicio<((p_to+1)::timestamp at time zone 'America/Lima')),0),
 'pagos_verificados',coalesce((select sum(p.monto) from public.pagos p join public.reservas r on r.id=p.reserva_id where p.estado='pagado' and public.meryo_barberia_publicable(r.barberia_id) and r.inicio>=(p_from::timestamp at time zone 'America/Lima') and r.inicio<((p_to+1)::timestamp at time zone 'America/Lima') and exists(select 1 from meryo_private.payment_intents i join meryo_private.payment_receipts c on c.intent_id=i.id where i.reserva_id=r.id and i.referencia=p.proveedor_ref and i.proveedor=p.proveedor and i.live and c.resultado='confirmada')),0),
 'ingresos_meryo',null,'suscripciones_habilitadas',false,'cobros_habilitados',false);
end$$;
revoke all on function public.meryo_admin_usuarios(text,text,text,integer),public.meryo_admin_reservas(date,date,bigint,text,text,integer),public.meryo_admin_reserva_detalle(uuid),public.meryo_admin_resumen(date,date) from public,anon;
grant execute on function public.meryo_admin_usuarios(text,text,text,integer),public.meryo_admin_reservas(date,date,bigint,text,text,integer),public.meryo_admin_reserva_detalle(uuid),public.meryo_admin_resumen(date,date) to authenticated;
notify pgrst,'reload schema';
commit;
