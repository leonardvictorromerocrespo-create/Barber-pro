-- DRAFT. Derived from snapshot 2026-10-25; local validation only.
-- No candidate meryo schema. No production application or automatic deployment.
begin;
do $guard$ begin
if md5(pg_get_functiondef('public.crear_reserva(bigint,bigint,timestamp with time zone,text,text,text,numeric)'::regprocedure)) <> 'c99e8bc1aa6891dfab27aa4f5f20cbce' then raise exception 'Function drift: crear_reserva'; end if;
if md5(pg_get_functiondef('public.responder_reserva(uuid,boolean)'::regprocedure)) <> 'b8c86d7a4d0a1d357b9197a8af1369dc' then raise exception 'Function drift: responder_reserva'; end if;
if md5(pg_get_functiondef('public.expirar_reservas_vencidas()'::regprocedure)) <> '477b2a3f43e322eb13b715304df6451a' then raise exception 'Function drift: expirar_reservas_vencidas'; end if;
if md5(pg_get_functiondef('public.cancelar_reserva_cliente(uuid)'::regprocedure)) <> '1f80b5d6f37a093a4b71b9c35fcb7659' then raise exception 'Function drift: cancelar_reserva_cliente'; end if;
if md5(pg_get_functiondef('public.cancelar_reserva_barbero(uuid)'::regprocedure)) <> '3d14b3cecf5607ca76d8ff66a42bbb41' then raise exception 'Function drift: cancelar_reserva_barbero'; end if;
if md5(pg_get_functiondef('public.registrar_barberia(text,text,text,text,double precision,double precision,text,text)'::regprocedure)) <> 'acb2e3f1536d5f9dac502af2f4d6398e' then raise exception 'Function drift: registrar_barberia'; end if;
if md5(pg_get_functiondef('public.dejar_resena(uuid,integer,text)'::regprocedure)) <> '270a6b62c1ff68bae9e457dac2bc7ffe' then raise exception 'Function drift: dejar_resena'; end if;
if md5(pg_get_functiondef('public.mi_barberia_id()'::regprocedure)) <> 'ea57da149dcdd90d2d56716fed2f637e' then raise exception 'Function drift: mi_barberia_id'; end if;
if md5(pg_get_functiondef('public.es_admin()'::regprocedure)) <> '74fddff87a662c579bb450addfd343af' then raise exception 'Function drift: es_admin'; end if;
end; $guard$;
create schema if not exists meryo_private;
revoke all on schema meryo_private from public,anon,authenticated;
grant usage on schema meryo_private to service_role;
create table meryo_private.launch_settings (
  id integer primary key check(id=1),
  reservas_habilitadas boolean not null default false,
  plazo_pago_segundos integer not null default 300 check(plazo_pago_segundos between 60 and 1800),
  comision_centimos integer check(comision_centimos in (100,200)),
  criterio_comision text,
  politica_cancelacion jsonb,
  politica_devolucion jsonb,
  politica_liquidacion jsonb,
  entorno text not null default 'disabled' check(entorno in ('disabled','staging','production'))
);
insert into meryo_private.launch_settings(id) values(1);
revoke all on meryo_private.launch_settings from public,anon,authenticated;
grant select,update on meryo_private.launch_settings to service_role;
create function public.meryo_cuenta_activa() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles where id=(select auth.uid()) and activo is true);
$$;
revoke all on function public.meryo_cuenta_activa() from public,anon;
grant execute on function public.meryo_cuenta_activa() to authenticated;
create policy meryo_active_account on public.reservas as restrictive for select to authenticated using(public.meryo_cuenta_activa());
create policy meryo_active_account on public.pagos as restrictive for select to authenticated using(public.meryo_cuenta_activa());
create policy meryo_active_account on public.notificaciones as restrictive for all to authenticated using(public.meryo_cuenta_activa()) with check(public.meryo_cuenta_activa());
CREATE OR REPLACE FUNCTION public.crear_reserva(p_barberia_id bigint, p_servicio_id bigint, p_inicio timestamp with time zone, p_nombre text, p_telefono text, p_pedido text DEFAULT NULL::text, p_extra numeric DEFAULT 0)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_bar public.barberias%rowtype;
  v_serv public.servicios%rowtype;
  v_fin timestamptz; v_ini_l timestamp; v_fin_l timestamp;
  v_total numeric; v_adelanto numeric; v_id uuid; v_estado text; v_pend int; v_paso int;
  v_msg text;
begin
  if v_uid is null then raise exception 'Debes iniciar sesion para reservar'; end if;
  perform 1 from public.profiles where id=v_uid and activo is true for update;
  if not found then raise exception 'Cuenta inactiva o perfil ausente' using errcode='42501'; end if;
  if not (select reservas_habilitadas from meryo_private.launch_settings where id=1) then
    raise exception 'Las reservas comerciales aun no estan habilitadas';
  end if;
  if p_inicio is null then raise exception 'Hora requerida'; end if;
  if exists (select 1 from public.profiles where id = v_uid and (rol = 'admin' or barberia_id = p_barberia_id)) then
    raise exception 'No puedes reservar en esta barberia con tu cuenta';
  end if;

  p_nombre := trim(coalesce(p_nombre, ''));
  p_telefono := regexp_replace(coalesce(p_telefono, ''), '[^0-9+]', '', 'g');
  if length(p_nombre) < 2 or length(p_nombre) > 80 then raise exception 'Escribe tu nombre'; end if;
  if p_telefono !~ '^(\+?51)?9[0-9]{8}$' then raise exception 'Celular peruano invalido (9 digitos)'; end if;
  if coalesce(p_extra, 0) not in (0, 5, 10, 15) then raise exception 'Extra invalido'; end if;

  perform public.expirar_reservas_vencidas();

  select * into v_bar from public.barberias where id = p_barberia_id and verificada and estado='activa' and disponible_ahora;
  if not found then raise exception 'Esta barberia no esta disponible ahora'; end if;
  select * into v_serv from public.servicios where id = p_servicio_id and barberia_id = p_barberia_id and activo;
  if not found then raise exception 'Servicio no disponible'; end if;

  if p_inicio < clock_timestamp() + make_interval(mins => public.cfg('minutos_anticipacion_minima')::int) then
    raise exception 'Esa hora ya paso o es muy pronto';
  end if;
  if p_inicio > clock_timestamp() + interval '30 days' then raise exception 'Solo puedes reservar hasta 30 dias'; end if;

  v_fin := p_inicio + make_interval(mins => v_serv.duracion_min);
  v_ini_l := p_inicio at time zone 'America/Lima';
  v_fin_l := v_fin at time zone 'America/Lima';
  v_paso := public.cfg('paso_minutos')::int;
  if v_ini_l <> date_trunc('minute', v_ini_l)
     or ((extract(hour from v_ini_l) * 60 + extract(minute from v_ini_l))::int % v_paso) <> 0 then
    raise exception 'Hora invalida';
  end if;
  if v_ini_l::date <> v_fin_l::date or not exists (
       select 1 from public.horarios h
       where h.barberia_id = p_barberia_id and h.dia_semana = extract(dow from v_ini_l)::int
         and h.hora_apertura <= v_ini_l::time and h.hora_cierre >= v_fin_l::time) then
    raise exception 'Fuera del horario de atencion';
  end if;
  if exists (select 1 from public.bloqueos b where b.barberia_id = p_barberia_id
             and tstzrange(b.inicio, b.fin, '[)') && tstzrange(p_inicio, v_fin, '[)')) then
    raise exception 'La barberia no atiende en ese horario';
  end if;

  select count(*) into v_pend from public.reservas where cliente_id = v_uid and estado in ('solicitada','aceptada');
  if v_pend >= public.cfg('max_reservas_pendientes')::int then
    raise exception 'Tienes demasiadas reservas pendientes. Paga o cancela una primero.';
  end if;

  v_total := v_serv.precio + coalesce(p_extra, 0);
  v_adelanto := round(v_total * 0.5, 2);
  v_estado := 'solicitada'; -- Acceptance is always manual.

  begin
    insert into public.reservas (barberia_id, servicio_id, cliente_id, cliente_nombre, cliente_telefono,
      servicio_nombre, duracion_min, inicio, fin, pedido_especial, extra_personalizacion,
      precio_total, monto_adelanto, estado, expira_respuesta_en, expira_pago_en, aceptada_en)
    values (p_barberia_id, p_servicio_id, v_uid, p_nombre, p_telefono,
      v_serv.nombre, v_serv.duracion_min, p_inicio, v_fin, nullif(left(trim(coalesce(p_pedido, '')), 300), ''),
      coalesce(p_extra, 0), v_total, v_adelanto, v_estado,
      case when v_estado = 'solicitada' then clock_timestamp() + interval '5 minutes' end,
      case when v_estado = 'aceptada' then clock_timestamp() + (select make_interval(secs => plazo_pago_segundos) from meryo_private.launch_settings where id=1) end,
      case when v_estado = 'aceptada' then clock_timestamp() end)
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'Esa hora ya fue tomada. Elige otra.';
  end;

  v_msg := p_nombre || ' pide ' || v_serv.nombre || ' el ' || to_char(v_ini_l, 'DD/MM HH24:MI');
  if v_estado = 'solicitada' then
    perform public.notificar_barberia(p_barberia_id, 'Nueva solicitud de reserva',
      v_msg || '. Tienes ' || '5' || ' minutos para responder.', 'reserva_solicitada', v_id);
  else
    perform public.notificar_barberia(p_barberia_id, 'Nueva reserva (aceptada automaticamente)', v_msg, 'reserva_solicitada', v_id);
    perform public.notificar(v_uid, 'Reserva aceptada', 'Paga el adelanto de S/ ' || v_adelanto || ' para confirmar tu cita.', 'reserva_aceptada', v_id);
  end if;
  return v_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.responder_reserva(p_reserva_id uuid, p_aceptar boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_bar bigint := public.mi_barberia_id(); v_r public.reservas%rowtype;
begin
  if v_bar is null or p_aceptar is null then raise exception 'No autorizado'; end if;
  select * into v_r from public.reservas where id = p_reserva_id and barberia_id = v_bar for update;
  if not found then raise exception 'Reserva no encontrada'; end if;
  if v_r.estado <> 'solicitada' then raise exception 'Esta solicitud ya no esta pendiente'; end if;

  if v_r.expira_respuesta_en <= clock_timestamp() then
    update public.reservas set estado = 'expirada', cerrada_en = clock_timestamp() where id = v_r.id;
    perform public.notificar(v_r.cliente_id, 'Reserva expirada', 'La barberia no respondio a tiempo. Puedes elegir otra.', 'reserva_expirada', v_r.id);
    return 'expirada';
  end if;

  if p_aceptar then
    update public.reservas
       set estado = 'aceptada', aceptada_en = clock_timestamp(), expira_respuesta_en = null,
           expira_pago_en = clock_timestamp() + (select make_interval(secs => plazo_pago_segundos) from meryo_private.launch_settings where id=1)
     where id = v_r.id;
    perform public.notificar(v_r.cliente_id, 'Reserva aceptada',
      'Paga el adelanto de S/ ' || v_r.monto_adelanto || ' en ' || (select (plazo_pago_segundos / 60.0)::text from meryo_private.launch_settings where id=1) || ' minutos para confirmar.',
      'reserva_aceptada', v_r.id);
    return 'aceptada';
  end if;

  update public.reservas set estado = 'rechazada', cerrada_en = clock_timestamp(), expira_respuesta_en = null where id = v_r.id;
  perform public.notificar(v_r.cliente_id, 'Reserva rechazada', 'La barberia no puede atenderte a esa hora. Elige otra.', 'reserva_rechazada', v_r.id);
  return 'rechazada';
end;
$function$
;
CREATE OR REPLACE FUNCTION public.expirar_reservas_vencidas()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_n integer;
begin
  with v as (
    update public.reservas
       set estado = 'expirada', cerrada_en = clock_timestamp()
     where (estado = 'solicitada' and expira_respuesta_en <= clock_timestamp())
        or (estado = 'aceptada' and expira_pago_en <= clock_timestamp())
    returning id, cliente_id
  ), n as (
    insert into public.notificaciones (user_id, titulo, mensaje, tipo, reserva_id)
    select cliente_id, 'Reserva expirada', 'La reserva vencio y la hora fue liberada.', 'reserva_expirada', id from v
    returning 1
  )
  select count(*) into v_n from v;
  return v_n;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.cancelar_reserva_cliente(p_reserva_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_r public.reservas%rowtype; v_res text;
begin
  perform 1 from public.profiles where id=(select auth.uid()) and activo is true;
  if not found then raise exception 'Cuenta inactiva' using errcode='42501'; end if;
  select * into v_r from public.reservas where id = p_reserva_id and cliente_id = (select auth.uid()) for update;
  if not found then raise exception 'Reserva no encontrada'; end if;
  if v_r.estado='confirmada' then
    raise exception 'Cancelacion con pago pendiente de politica y devolucion verificada';
  end if;
  if v_r.estado not in ('solicitada','aceptada','confirmada') then raise exception 'Esta reserva ya no se puede cancelar'; end if;
  if v_r.inicio <= clock_timestamp() then raise exception 'La cita ya empezo'; end if;

  v_res := 'cancelada';

  update public.reservas set estado = 'cancelada_cliente', cerrada_en = clock_timestamp(),
         expira_respuesta_en = null, expira_pago_en = null where id = v_r.id;
  perform public.notificar_barberia(v_r.barberia_id, 'Reserva cancelada',
    v_r.cliente_nombre || ' cancelo su cita del ' || to_char(v_r.inicio at time zone 'America/Lima', 'DD/MM HH24:MI'),
    'reserva_cancelada', v_r.id);
  return v_res;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.cancelar_reserva_barbero(p_reserva_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_bar bigint := public.mi_barberia_id(); v_r public.reservas%rowtype;
begin
  if v_bar is null then raise exception 'No autorizado'; end if;
  select * into v_r from public.reservas where id = p_reserva_id and barberia_id = v_bar for update;
  if not found then raise exception 'Reserva no encontrada'; end if;
  if v_r.estado='confirmada' then
    raise exception 'Cancelacion con pago pendiente de politica y devolucion verificada';
  end if;
  if v_r.estado not in ('solicitada','aceptada','confirmada') then raise exception 'Esta reserva ya no se puede cancelar'; end if;
  update public.reservas set estado = 'cancelada_barbero', cerrada_en = clock_timestamp(),
         expira_respuesta_en = null, expira_pago_en = null where id = v_r.id;
  perform public.notificar(v_r.cliente_id, 'La barberia cancelo tu cita',
    'Tu cita del ' || to_char(v_r.inicio at time zone 'America/Lima', 'DD/MM HH24:MI') || ' fue cancelada.',
    'reserva_cancelada', v_r.id);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.registrar_barberia(p_nombre text, p_distrito text, p_direccion text, p_descripcion text, p_lat double precision, p_lng double precision, p_whatsapp text, p_correo text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid := (select auth.uid()); v_rol text; v_bar bigint; v_id bigint;
begin
  if v_uid is null then raise exception 'Debes iniciar sesion'; end if;
  select rol, barberia_id into v_rol, v_bar from public.profiles where id = v_uid and activo is true for update;
  if not found then raise exception 'Perfil no encontrado'; end if;
  if v_rol = 'admin' then raise exception 'Un admin no puede registrar una barberia'; end if;
  if v_bar is not null then raise exception 'Ya tienes una barberia registrada'; end if;
  if coalesce(trim(p_nombre), '') = '' or coalesce(trim(p_distrito), '') = ''
     or coalesce(trim(p_direccion), '') = '' then
    raise exception 'Nombre, distrito y direccion son obligatorios';
  end if;
  if length(p_nombre) > 80 or length(p_direccion) > 200 then raise exception 'Texto demasiado largo'; end if;

  insert into public.barberias (nombre, distrito, direccion, descripcion, lat, lng, whatsapp,
                                correo_contacto, estado, verificada, total_resenas)
  values (trim(p_nombre), trim(p_distrito), trim(p_direccion), left(coalesce(p_descripcion, ''), 1000),
          p_lat, p_lng, left(p_whatsapp, 20), left(p_correo, 120), 'pendiente', false, 0)
  returning id into v_id;

  update public.profiles set rol = 'barbero', barberia_id = v_id where id = v_uid;

  -- Horario inicial lunes a sabado 9:00 a 19:00 (el barbero lo puede cambiar)
  insert into public.horarios (barberia_id, dia_semana, hora_apertura, hora_cierre)
  select v_id, d, time '09:00', time '19:00' from generate_series(1, 6) d;

  return v_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.dejar_resena(p_reserva_id uuid, p_calificacion integer, p_comentario text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_r public.reservas%rowtype;
begin
  perform 1 from public.profiles where id=(select auth.uid()) and activo is true;
  if not found then raise exception 'Cuenta inactiva' using errcode='42501'; end if;
  select * into v_r from public.reservas where id = p_reserva_id and cliente_id = (select auth.uid());
  if not found then raise exception 'Reserva no encontrada'; end if;
  if v_r.estado <> 'completada' then raise exception 'Solo puedes opinar de citas completadas'; end if;
  if p_calificacion not between 1 and 5 then raise exception 'Calificacion invalida'; end if;
  insert into public.resenas (barberia_id, reserva_id, cliente_id, autor, calificacion, comentario)
  values (v_r.barberia_id, v_r.id, v_r.cliente_id, split_part(v_r.cliente_nombre, ' ', 1),
          p_calificacion, nullif(left(trim(coalesce(p_comentario, '')), 500), ''));
exception when unique_violation then
  raise exception 'Ya dejaste tu reseña para esta cita';
end;
$function$
;
CREATE OR REPLACE FUNCTION public.mi_barberia_id()
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select barberia_id from public.profiles
  where id = (select auth.uid()) and rol = 'barbero' and activo is true;
$function$
;
CREATE OR REPLACE FUNCTION public.es_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.profiles
                 where id = (select auth.uid()) and rol = 'admin' and activo is true);
$function$
;
commit;
