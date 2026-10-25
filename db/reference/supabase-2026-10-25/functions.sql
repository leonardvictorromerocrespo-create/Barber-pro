CREATE OR REPLACE FUNCTION public.activar_barberia(p_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.es_admin() then raise exception 'No autorizado'; end if;
  if exists (select 1 from public.barberias where id = p_id and (lat is null or lng is null)) then
    raise exception 'Falta la ubicacion en el mapa de esta barberia';
  end if;
  update public.barberias set verificada = true, estado = 'activa' where id = p_id;
end;
$function$

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
  if v_r.estado not in ('solicitada','aceptada','confirmada') then raise exception 'Esta reserva ya no se puede cancelar'; end if;
  update public.pagos set estado = 'reembolso_pendiente' where reserva_id = v_r.id and estado = 'pagado';
  update public.reservas set estado = 'cancelada_barbero', cerrada_en = now(),
         expira_respuesta_en = null, expira_pago_en = null where id = v_r.id;
  perform public.notificar(v_r.cliente_id, 'La barberia cancelo tu cita',
    'Tu cita del ' || to_char(v_r.inicio at time zone 'America/Lima', 'DD/MM HH24:MI') || ' fue cancelada. Si pagaste, se te devuelve el adelanto completo.',
    'reserva_cancelada', v_r.id);
end;
$function$

CREATE OR REPLACE FUNCTION public.cancelar_reserva_cliente(p_reserva_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_r public.reservas%rowtype; v_res text;
begin
  select * into v_r from public.reservas where id = p_reserva_id and cliente_id = (select auth.uid()) for update;
  if not found then raise exception 'Reserva no encontrada'; end if;
  if v_r.estado not in ('solicitada','aceptada','confirmada') then raise exception 'Esta reserva ya no se puede cancelar'; end if;
  if v_r.inicio <= now() then raise exception 'La cita ya empezo'; end if;

  if v_r.estado = 'confirmada' then
    if v_r.inicio - now() >= make_interval(hours => public.cfg('horas_cancelacion_gratis')::int) then
      update public.pagos set estado = 'reembolso_pendiente' where reserva_id = v_r.id and estado = 'pagado';
      v_res := 'cancelada_con_devolucion';
    else
      update public.pagos set estado = 'retenido' where reserva_id = v_r.id and estado = 'pagado';
      v_res := 'cancelada_sin_devolucion';
    end if;
  else
    v_res := 'cancelada';
  end if;

  update public.reservas set estado = 'cancelada_cliente', cerrada_en = now(),
         expira_respuesta_en = null, expira_pago_en = null where id = v_r.id;
  perform public.notificar_barberia(v_r.barberia_id, 'Reserva cancelada',
    v_r.cliente_nombre || ' cancelo su cita del ' || to_char(v_r.inicio at time zone 'America/Lima', 'DD/MM HH24:MI'),
    'reserva_cancelada', v_r.id);
  return v_res;
end;
$function$

CREATE OR REPLACE FUNCTION public.cfg(p_clave text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select valor from public.configuracion where clave = p_clave;
$function$

CREATE OR REPLACE FUNCTION public.confirmar_pago_interno(p_reserva uuid, p_proveedor text, p_ref text, p_metodo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_r public.reservas%rowtype;
begin
  select * into v_r from public.reservas where id = p_reserva for update;
  if not found or v_r.estado <> 'aceptada' then
    raise exception 'La reserva no esta lista para pagar';
  end if;
  insert into public.pagos (reserva_id, monto, metodo, proveedor, proveedor_ref, estado, comision_plataforma, pagado_en)
  values (v_r.id, v_r.monto_adelanto, p_metodo, p_proveedor, p_ref, 'pagado',
          round(v_r.monto_adelanto * public.cfg('comision_pct')::numeric / 100, 2), now());
  update public.reservas set estado = 'confirmada', pagada_en = now(), expira_pago_en = null where id = v_r.id;
  perform public.notificar(v_r.cliente_id, 'Reserva confirmada',
    'Tu cita del ' || to_char(v_r.inicio at time zone 'America/Lima', 'DD/MM HH24:MI') || ' esta confirmada.',
    'reserva_confirmada', v_r.id);
  perform public.notificar_barberia(v_r.barberia_id, 'Reserva pagada',
    v_r.cliente_nombre || ' pago el adelanto. Cita: ' || to_char(v_r.inicio at time zone 'America/Lima', 'DD/MM HH24:MI'),
    'reserva_pagada', v_r.id);
end;
$function$

CREATE OR REPLACE FUNCTION public.confirmar_pago_reserva(p_reserva_id uuid, p_proveedor text, p_ref text, p_metodo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform public.confirmar_pago_interno(p_reserva_id, p_proveedor, p_ref, p_metodo);
end;
$function$

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
  if exists (select 1 from public.profiles where id = v_uid and (rol = 'admin' or barberia_id = p_barberia_id)) then
    raise exception 'No puedes reservar en esta barberia con tu cuenta';
  end if;

  p_nombre := trim(coalesce(p_nombre, ''));
  p_telefono := regexp_replace(coalesce(p_telefono, ''), '[^0-9+]', '', 'g');
  if length(p_nombre) < 2 or length(p_nombre) > 80 then raise exception 'Escribe tu nombre'; end if;
  if p_telefono !~ '^(\+?51)?9[0-9]{8}$' then raise exception 'Celular peruano invalido (9 digitos)'; end if;
  if coalesce(p_extra, 0) not in (0, 5, 10, 15) then raise exception 'Extra invalido'; end if;

  perform public.expirar_reservas_vencidas();

  select * into v_bar from public.barberias where id = p_barberia_id and verificada and disponible_ahora;
  if not found then raise exception 'Esta barberia no esta disponible ahora'; end if;
  select * into v_serv from public.servicios where id = p_servicio_id and barberia_id = p_barberia_id and activo;
  if not found then raise exception 'Servicio no disponible'; end if;

  if p_inicio < now() + make_interval(mins => public.cfg('minutos_anticipacion_minima')::int) then
    raise exception 'Esa hora ya paso o es muy pronto';
  end if;
  if p_inicio > now() + interval '30 days' then raise exception 'Solo puedes reservar hasta 30 dias'; end if;

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
  v_adelanto := round(v_total * public.cfg('adelanto_pct')::numeric / 100, 2);
  v_estado := case when v_bar.acepta_auto then 'aceptada' else 'solicitada' end;

  begin
    insert into public.reservas (barberia_id, servicio_id, cliente_id, cliente_nombre, cliente_telefono,
      servicio_nombre, duracion_min, inicio, fin, pedido_especial, extra_personalizacion,
      precio_total, monto_adelanto, estado, expira_respuesta_en, expira_pago_en, aceptada_en)
    values (p_barberia_id, p_servicio_id, v_uid, p_nombre, p_telefono,
      v_serv.nombre, v_serv.duracion_min, p_inicio, v_fin, nullif(left(trim(coalesce(p_pedido, '')), 300), ''),
      coalesce(p_extra, 0), v_total, v_adelanto, v_estado,
      case when v_estado = 'solicitada' then now() + make_interval(mins => public.cfg('minutos_respuesta_barbero')::int) end,
      case when v_estado = 'aceptada' then now() + make_interval(mins => public.cfg('minutos_pago_cliente')::int) end,
      case when v_estado = 'aceptada' then now() end)
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'Esa hora ya fue tomada. Elige otra.';
  end;

  v_msg := p_nombre || ' pide ' || v_serv.nombre || ' el ' || to_char(v_ini_l, 'DD/MM HH24:MI');
  if v_estado = 'solicitada' then
    perform public.notificar_barberia(p_barberia_id, 'Nueva solicitud de reserva',
      v_msg || '. Tienes ' || public.cfg('minutos_respuesta_barbero') || ' minutos para responder.', 'reserva_solicitada', v_id);
  else
    perform public.notificar_barberia(p_barberia_id, 'Nueva reserva (aceptada automaticamente)', v_msg, 'reserva_solicitada', v_id);
    perform public.notificar(v_uid, 'Reserva aceptada', 'Paga el adelanto de S/ ' || v_adelanto || ' para confirmar tu cita.', 'reserva_aceptada', v_id);
  end if;
  return v_id;
end;
$function$

CREATE OR REPLACE FUNCTION public.dejar_resena(p_reserva_id uuid, p_calificacion integer, p_comentario text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_r public.reservas%rowtype;
begin
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

CREATE OR REPLACE FUNCTION public.es_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.profiles
                 where id = (select auth.uid()) and rol = 'admin' and coalesce(activo, true));
$function$

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
       set estado = 'expirada', cerrada_en = now()
     where (estado = 'solicitada' and expira_respuesta_en <= now())
        or (estado = 'aceptada' and expira_pago_en <= now())
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

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.profiles (id, email, rol, nombre)
  values (new.id, new.email, 'cliente', nullif(trim(coalesce(new.raw_user_meta_data->>'nombre', '')), ''))
  on conflict (id) do nothing;
  return new;
end;
$function$

CREATE OR REPLACE FUNCTION public.horarios_disponibles(p_barberia_id bigint, p_servicio_id bigint, p_fecha date)
 RETURNS TABLE(hora_inicio timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_dur int; v_paso int := public.cfg('paso_minutos')::int;
        v_min timestamptz := now() + make_interval(mins => public.cfg('minutos_anticipacion_minima')::int);
begin
  select s.duracion_min into v_dur from public.servicios s
   where s.id = p_servicio_id and s.barberia_id = p_barberia_id and s.activo;
  if v_dur is null then return; end if;
  if not exists (select 1 from public.barberias b where b.id = p_barberia_id and b.verificada and b.disponible_ahora) then return; end if;

  return query
  select distinct g.t
  from public.horarios h
  cross join lateral generate_series(
      (p_fecha + h.hora_apertura) at time zone 'America/Lima',
      ((p_fecha + h.hora_cierre) at time zone 'America/Lima') - make_interval(mins => v_dur),
      make_interval(mins => v_paso)) as g(t)
  where h.barberia_id = p_barberia_id
    and h.dia_semana = extract(dow from p_fecha)::int
    and g.t >= v_min
    and not exists (
      select 1 from public.reservas r
      where r.barberia_id = p_barberia_id
        and tstzrange(r.inicio, r.fin, '[)') && tstzrange(g.t, g.t + make_interval(mins => v_dur), '[)')
        and (r.estado = 'confirmada'
             or (r.estado = 'solicitada' and r.expira_respuesta_en > now())
             or (r.estado = 'aceptada' and r.expira_pago_en > now())))
    and not exists (
      select 1 from public.bloqueos bl
      where bl.barberia_id = p_barberia_id
        and tstzrange(bl.inicio, bl.fin, '[)') && tstzrange(g.t, g.t + make_interval(mins => v_dur), '[)'))
  order by 1;
end;
$function$

CREATE OR REPLACE FUNCTION public.marcar_asistencia(p_reserva_id uuid, p_asistio boolean)
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
  if v_r.estado <> 'confirmada' then raise exception 'Solo se marcan citas confirmadas'; end if;
  if v_r.inicio > now() then raise exception 'La cita aun no empieza'; end if;
  if p_asistio then
    update public.reservas set estado = 'completada', cerrada_en = now() where id = v_r.id;
    perform public.notificar(v_r.cliente_id, 'Cuentanos como te fue', 'Deja tu reseña de ' || v_r.servicio_nombre || '.', 'pedir_resena', v_r.id);
  else
    update public.reservas set estado = 'no_asistio', cerrada_en = now() where id = v_r.id;
    update public.pagos set estado = 'retenido' where reserva_id = v_r.id and estado = 'pagado';
  end if;
end;
$function$

CREATE OR REPLACE FUNCTION public.mi_barberia_id()
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select barberia_id from public.profiles
  where id = (select auth.uid()) and rol = 'barbero' and coalesce(activo, true);
$function$

CREATE OR REPLACE FUNCTION public.notificar_barberia(p_barberia bigint, p_titulo text, p_mensaje text, p_tipo text, p_reserva uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  insert into public.notificaciones (user_id, titulo, mensaje, tipo, reserva_id)
  select id, p_titulo, p_mensaje, p_tipo, p_reserva from public.profiles
  where barberia_id = p_barberia and rol = 'barbero' and coalesce(activo, true);
$function$

CREATE OR REPLACE FUNCTION public.notificar(p_user uuid, p_titulo text, p_mensaje text, p_tipo text, p_reserva uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  insert into public.notificaciones (user_id, titulo, mensaje, tipo, reserva_id)
  values (p_user, p_titulo, p_mensaje, p_tipo, p_reserva);
$function$

CREATE OR REPLACE FUNCTION public.pagar_reserva_prueba(p_reserva_id uuid, p_metodo text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_r public.reservas%rowtype;
begin
  if public.cfg('modo_pagos') <> 'prueba' then raise exception 'Los pagos de prueba estan desactivados'; end if;
  if p_metodo not in ('tarjeta','yape','plin') then raise exception 'Metodo de pago invalido'; end if;
  select * into v_r from public.reservas where id = p_reserva_id and cliente_id = (select auth.uid()) for update;
  if not found then raise exception 'Reserva no encontrada'; end if;
  if v_r.estado <> 'aceptada' then raise exception 'Esta reserva no esta lista para pagar'; end if;
  if v_r.expira_pago_en <= now() then
    update public.reservas set estado = 'expirada', cerrada_en = now() where id = v_r.id;
    return 'expirada';
  end if;
  perform public.confirmar_pago_interno(v_r.id, 'prueba', 'prueba-' || gen_random_uuid()::text, p_metodo);
  return 'confirmada';
end;
$function$

CREATE OR REPLACE FUNCTION public.registrar_barberia(p_nombre text, p_distrito text, p_direccion text, p_descripcion text, p_lat double precision, p_lng double precision, p_whatsapp text, p_correo text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid := (select auth.uid()); v_rol text; v_bar bigint; v_id bigint;
begin
  if v_uid is null then raise exception 'Debes iniciar sesion'; end if;
  select rol, barberia_id into v_rol, v_bar from public.profiles where id = v_uid;
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

CREATE OR REPLACE FUNCTION public.responder_reserva(p_reserva_id uuid, p_aceptar boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_bar bigint := public.mi_barberia_id(); v_r public.reservas%rowtype;
begin
  if v_bar is null then raise exception 'No autorizado'; end if;
  select * into v_r from public.reservas where id = p_reserva_id and barberia_id = v_bar for update;
  if not found then raise exception 'Reserva no encontrada'; end if;
  if v_r.estado <> 'solicitada' then raise exception 'Esta solicitud ya no esta pendiente'; end if;

  if v_r.expira_respuesta_en <= now() then
    update public.reservas set estado = 'expirada', cerrada_en = now() where id = v_r.id;
    perform public.notificar(v_r.cliente_id, 'Reserva expirada', 'La barberia no respondio a tiempo. Puedes elegir otra.', 'reserva_expirada', v_r.id);
    return 'expirada';
  end if;

  if p_aceptar then
    update public.reservas
       set estado = 'aceptada', aceptada_en = now(), expira_respuesta_en = null,
           expira_pago_en = now() + make_interval(mins => public.cfg('minutos_pago_cliente')::int)
     where id = v_r.id;
    perform public.notificar(v_r.cliente_id, 'Reserva aceptada',
      'Paga el adelanto de S/ ' || v_r.monto_adelanto || ' en ' || public.cfg('minutos_pago_cliente') || ' minutos para confirmar.',
      'reserva_aceptada', v_r.id);
    return 'aceptada';
  end if;

  update public.reservas set estado = 'rechazada', cerrada_en = now(), expira_respuesta_en = null where id = v_r.id;
  perform public.notificar(v_r.cliente_id, 'Reserva rechazada', 'La barberia no puede atenderte a esa hora. Elige otra.', 'reserva_rechazada', v_r.id);
  return 'rechazada';
end;
$function$

CREATE OR REPLACE FUNCTION public.suspender_barberia(p_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.es_admin() then raise exception 'No autorizado'; end if;
  update public.barberias set verificada = false, estado = 'suspendida' where id = p_id;
end;
$function$

CREATE OR REPLACE FUNCTION public.sync_precio_desde()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id bigint := coalesce(new.barberia_id, old.barberia_id);
begin
  update public.barberias
     set precio_desde = (select min(precio) from public.servicios where barberia_id = v_id and activo)
   where id = v_id;
  return null;
end;
$function$

CREATE OR REPLACE FUNCTION public.sync_rating()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.barberias b
     set rating = (select round(avg(calificacion)::numeric, 1) from public.resenas where barberia_id = new.barberia_id),
         total_resenas = (select count(*) from public.resenas where barberia_id = new.barberia_id)
   where b.id = new.barberia_id;
  return null;
end;
$function$

