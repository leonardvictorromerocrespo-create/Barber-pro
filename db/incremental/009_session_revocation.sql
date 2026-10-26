begin;
create function public.meryo_sesion_activa() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.sessions s where s.user_id=auth.uid()
 and s.id::text=coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb->>'session_id'
 and (s.not_after is null or s.not_after>clock_timestamp()));
$$;
revoke all on function public.meryo_sesion_activa() from public,anon;
grant execute on function public.meryo_sesion_activa() to authenticated;
create or replace function public.es_admin() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb->>'aal'='aal2',false)
 and public.meryo_sesion_activa()
 and exists(select 1 from public.profiles where id=auth.uid() and rol='admin' and activo is true)
 and exists(select 1 from auth.mfa_factors where user_id=auth.uid() and status='verified');
$$;
create or replace function public.meryo_cuenta_activa() returns boolean language sql stable security definer set search_path='' as $$
 select public.meryo_sesion_activa() and exists(select 1 from public.profiles where id=auth.uid() and activo is true);
$$;
create or replace function public.mi_barberia_id() returns bigint language sql stable security definer set search_path='' as $$
 select barberia_id from public.profiles where id=auth.uid() and rol='barbero' and activo is true and public.meryo_sesion_activa();
$$;
-- A revoked but not-yet-expired access JWT cannot execute business writes.
do $sessions$
declare signature text; source text;
begin
 foreach signature in array array[
 'public.crear_reserva(bigint,bigint,timestamptz,text,text,text,numeric)',
 'public.registrar_barberia(text,text,text,text,double precision,double precision,text,text)',
 'public.cancelar_reserva_cliente(uuid)','public.cancelar_reserva_barbero(uuid)',
 'public.dejar_resena(uuid,integer,text)','public.responder_reserva(uuid,boolean)','public.marcar_asistencia(uuid,boolean)'] loop
  source:=pg_get_functiondef(signature::regprocedure);
  if position(E'\nbegin\n' in source)=0 then raise exception 'Unexpected function body: %',signature; end if;
  source:=replace(source,E'\nbegin\n',E'\nbegin\n  if not public.meryo_cuenta_activa() then raise exception ''Sesion inactiva'' using errcode=''42501''; end if;\n');
  execute source;
 end loop;
end $sessions$;
notify pgrst,'reload schema';
commit;
