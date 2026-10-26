-- REFERENCE ONLY: public schema BEFORE the MERYO release. Includes old unsafe functions. Never execute as a migration.
--
-- PostgreSQL database dump
--

\restrict M1cxzc7jgfikWlsPmwfthsgQWTvU6b2teGdgSC9uVkJB1vlr18au6JleVUHa8WA

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: activar_barberia(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.activar_barberia(p_id bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if not public.es_admin() then raise exception 'No autorizado'; end if;
  if exists (select 1 from public.barberias where id = p_id and (lat is null or lng is null)) then
    raise exception 'Falta la ubicacion en el mapa de esta barberia';
  end if;
  update public.barberias set verificada = true, estado = 'activa' where id = p_id;
end;
$$;


--
-- Name: cancelar_reserva_barbero(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancelar_reserva_barbero(p_reserva_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
$$;


--
-- Name: cancelar_reserva_cliente(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancelar_reserva_cliente(p_reserva_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
$$;


--
-- Name: cfg(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cfg(p_clave text) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select valor from public.configuracion where clave = p_clave;
$$;


--
-- Name: confirmar_pago_interno(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.confirmar_pago_interno(p_reserva uuid, p_proveedor text, p_ref text, p_metodo text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
$$;


--
-- Name: confirmar_pago_reserva(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.confirmar_pago_reserva(p_reserva_id uuid, p_proveedor text, p_ref text, p_metodo text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform public.confirmar_pago_interno(p_reserva_id, p_proveedor, p_ref, p_metodo);
end;
$$;


--
-- Name: crear_reserva(bigint, bigint, timestamp with time zone, text, text, text, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.crear_reserva(p_barberia_id bigint, p_servicio_id bigint, p_inicio timestamp with time zone, p_nombre text, p_telefono text, p_pedido text DEFAULT NULL::text, p_extra numeric DEFAULT 0) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
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
$_$;


--
-- Name: dejar_resena(uuid, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.dejar_resena(p_reserva_id uuid, p_calificacion integer, p_comentario text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
$$;


--
-- Name: es_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.es_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (select 1 from public.profiles
                 where id = (select auth.uid()) and rol = 'admin' and coalesce(activo, true));
$$;


--
-- Name: expirar_reservas_vencidas(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.expirar_reservas_vencidas() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  insert into public.profiles (id, email, rol, nombre)
  values (new.id, new.email, 'cliente', nullif(trim(coalesce(new.raw_user_meta_data->>'nombre', '')), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;


--
-- Name: horarios_disponibles(bigint, bigint, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.horarios_disponibles(p_barberia_id bigint, p_servicio_id bigint, p_fecha date) RETURNS TABLE(hora_inicio timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
$$;


--
-- Name: marcar_asistencia(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.marcar_asistencia(p_reserva_id uuid, p_asistio boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
$$;


--
-- Name: mi_barberia_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mi_barberia_id() RETURNS bigint
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select barberia_id from public.profiles
  where id = (select auth.uid()) and rol = 'barbero' and coalesce(activo, true);
$$;


--
-- Name: notificar(uuid, text, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notificar(p_user uuid, p_titulo text, p_mensaje text, p_tipo text, p_reserva uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO ''
    AS $$
  insert into public.notificaciones (user_id, titulo, mensaje, tipo, reserva_id)
  values (p_user, p_titulo, p_mensaje, p_tipo, p_reserva);
$$;


--
-- Name: notificar_barberia(bigint, text, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notificar_barberia(p_barberia bigint, p_titulo text, p_mensaje text, p_tipo text, p_reserva uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO ''
    AS $$
  insert into public.notificaciones (user_id, titulo, mensaje, tipo, reserva_id)
  select id, p_titulo, p_mensaje, p_tipo, p_reserva from public.profiles
  where barberia_id = p_barberia and rol = 'barbero' and coalesce(activo, true);
$$;


--
-- Name: pagar_reserva_prueba(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pagar_reserva_prueba(p_reserva_id uuid, p_metodo text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
$$;


--
-- Name: registrar_barberia(text, text, text, text, double precision, double precision, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_barberia(p_nombre text, p_distrito text, p_direccion text, p_descripcion text, p_lat double precision, p_lng double precision, p_whatsapp text, p_correo text) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
$$;


--
-- Name: responder_reserva(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.responder_reserva(p_reserva_id uuid, p_aceptar boolean) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
$$;


--
-- Name: suspender_barberia(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suspender_barberia(p_id bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if not public.es_admin() then raise exception 'No autorizado'; end if;
  update public.barberias set verificada = false, estado = 'suspendida' where id = p_id;
end;
$$;


--
-- Name: sync_precio_desde(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_precio_desde() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_id bigint := coalesce(new.barberia_id, old.barberia_id);
begin
  update public.barberias
     set precio_desde = (select min(precio) from public.servicios where barberia_id = v_id and activo)
   where id = v_id;
  return null;
end;
$$;


--
-- Name: sync_rating(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_rating() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  update public.barberias b
     set rating = (select round(avg(calificacion)::numeric, 1) from public.resenas where barberia_id = new.barberia_id),
         total_resenas = (select count(*) from public.resenas where barberia_id = new.barberia_id)
   where b.id = new.barberia_id;
  return null;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: barberia_media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.barberia_media (
    id bigint NOT NULL,
    barberia_id bigint NOT NULL,
    tipo text NOT NULL,
    url text NOT NULL,
    titulo text,
    orden integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT barberia_media_tipo_check CHECK ((tipo = ANY (ARRAY['foto'::text, 'video'::text]))),
    CONSTRAINT barberia_media_titulo_check CHECK ((length(titulo) <= 100)),
    CONSTRAINT barberia_media_url_check CHECK ((url ~* '^https://'::text))
);


--
-- Name: barberia_media_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.barberia_media ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.barberia_media_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: barberias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.barberias (
    id bigint NOT NULL,
    nombre text,
    distrito text,
    direccion text,
    descripcion text,
    imagen_url text,
    rating numeric,
    total_resenas integer DEFAULT 0,
    precio_desde numeric,
    estado text DEFAULT 'pendiente'::text,
    verificada boolean DEFAULT false,
    lat double precision,
    lng double precision,
    whatsapp text,
    correo_contacto text,
    video_presentacion_url text,
    acepta_auto boolean DEFAULT false NOT NULL,
    disponible_ahora boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT barberias_lat_check CHECK (((lat IS NULL) OR ((lat >= ('-90'::integer)::double precision) AND (lat <= (90)::double precision)))),
    CONSTRAINT barberias_lng_check CHECK (((lng IS NULL) OR ((lng >= ('-180'::integer)::double precision) AND (lng <= (180)::double precision))))
);


--
-- Name: barberias_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.barberias ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.barberias_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: bloqueos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bloqueos (
    id bigint NOT NULL,
    barberia_id bigint NOT NULL,
    inicio timestamp with time zone NOT NULL,
    fin timestamp with time zone NOT NULL,
    motivo text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bloqueos_check CHECK ((fin > inicio))
);


--
-- Name: bloqueos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.bloqueos ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.bloqueos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: configuracion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.configuracion (
    clave text NOT NULL,
    valor text NOT NULL,
    descripcion text
);


--
-- Name: horarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.horarios (
    id bigint NOT NULL,
    barberia_id bigint NOT NULL,
    dia_semana smallint NOT NULL,
    hora_apertura time without time zone NOT NULL,
    hora_cierre time without time zone NOT NULL,
    CONSTRAINT horarios_check CHECK ((hora_cierre > hora_apertura)),
    CONSTRAINT horarios_dia_semana_check CHECK (((dia_semana >= 0) AND (dia_semana <= 6)))
);


--
-- Name: horarios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.horarios ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.horarios_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: notificaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notificaciones (
    id bigint NOT NULL,
    user_id uuid,
    titulo text,
    mensaje text,
    leida boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    tipo text,
    reserva_id uuid
);


--
-- Name: notificaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.notificaciones ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.notificaciones_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: pagos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pagos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reserva_id uuid NOT NULL,
    monto numeric(10,2) NOT NULL,
    moneda text DEFAULT 'PEN'::text NOT NULL,
    metodo text,
    proveedor text NOT NULL,
    proveedor_ref text,
    estado text DEFAULT 'pagado'::text NOT NULL,
    comision_plataforma numeric(10,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    pagado_en timestamp with time zone,
    CONSTRAINT pagos_estado_check CHECK ((estado = ANY (ARRAY['pendiente'::text, 'pagado'::text, 'fallido'::text, 'reembolso_pendiente'::text, 'reembolsado'::text, 'retenido'::text]))),
    CONSTRAINT pagos_metodo_check CHECK ((metodo = ANY (ARRAY['tarjeta'::text, 'yape'::text, 'plin'::text]))),
    CONSTRAINT pagos_monto_check CHECK ((monto > (0)::numeric))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text,
    rol text DEFAULT 'cliente'::text,
    barberia_id bigint,
    activo boolean DEFAULT true,
    nombre text,
    telefono text,
    CONSTRAINT profiles_rol_check CHECK ((rol = ANY (ARRAY['cliente'::text, 'barbero'::text, 'admin'::text])))
);


--
-- Name: resenas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resenas (
    id bigint NOT NULL,
    barberia_id bigint NOT NULL,
    reserva_id uuid NOT NULL,
    cliente_id uuid NOT NULL,
    autor text NOT NULL,
    calificacion smallint NOT NULL,
    comentario text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT resenas_calificacion_check CHECK (((calificacion >= 1) AND (calificacion <= 5))),
    CONSTRAINT resenas_comentario_check CHECK ((length(comentario) <= 500))
);


--
-- Name: resenas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.resenas ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.resenas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: reservas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    barberia_id bigint NOT NULL,
    servicio_id bigint NOT NULL,
    cliente_id uuid NOT NULL,
    cliente_nombre text NOT NULL,
    cliente_telefono text NOT NULL,
    servicio_nombre text NOT NULL,
    duracion_min integer NOT NULL,
    inicio timestamp with time zone NOT NULL,
    fin timestamp with time zone NOT NULL,
    pedido_especial text,
    extra_personalizacion numeric(10,2) DEFAULT 0 NOT NULL,
    precio_total numeric(10,2) NOT NULL,
    monto_adelanto numeric(10,2) NOT NULL,
    estado text DEFAULT 'solicitada'::text NOT NULL,
    expira_respuesta_en timestamp with time zone,
    expira_pago_en timestamp with time zone,
    aceptada_en timestamp with time zone,
    pagada_en timestamp with time zone,
    cerrada_en timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reservas_check CHECK ((fin > inicio)),
    CONSTRAINT reservas_estado_check CHECK ((estado = ANY (ARRAY['solicitada'::text, 'aceptada'::text, 'confirmada'::text, 'rechazada'::text, 'expirada'::text, 'cancelada_cliente'::text, 'cancelada_barbero'::text, 'no_asistio'::text, 'completada'::text]))),
    CONSTRAINT reservas_extra_personalizacion_check CHECK ((extra_personalizacion = ANY (ARRAY[(0)::numeric, (5)::numeric, (10)::numeric, (15)::numeric]))),
    CONSTRAINT reservas_monto_adelanto_check CHECK ((monto_adelanto > (0)::numeric)),
    CONSTRAINT reservas_pedido_especial_check CHECK ((length(pedido_especial) <= 300)),
    CONSTRAINT reservas_precio_total_check CHECK ((precio_total > (0)::numeric))
);


--
-- Name: reservas_legacy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservas_legacy (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    shop_id integer,
    cliente text,
    servicio text,
    fecha text,
    hora text,
    pedido text,
    total integer,
    created_at timestamp without time zone DEFAULT now(),
    estado text DEFAULT 'pendiente'::text,
    fecha_creacion timestamp without time zone DEFAULT now(),
    expira_en timestamp with time zone,
    cliente_id uuid
);


--
-- Name: servicios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.servicios (
    id bigint NOT NULL,
    barberia_id bigint NOT NULL,
    nombre text NOT NULL,
    descripcion text,
    precio numeric(10,2) NOT NULL,
    duracion_min integer NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT servicios_descripcion_check CHECK ((length(descripcion) <= 300)),
    CONSTRAINT servicios_duracion_min_check CHECK (((duracion_min >= 10) AND (duracion_min <= 240))),
    CONSTRAINT servicios_nombre_check CHECK (((length(TRIM(BOTH FROM nombre)) >= 2) AND (length(TRIM(BOTH FROM nombre)) <= 80))),
    CONSTRAINT servicios_precio_check CHECK (((precio > (0)::numeric) AND (precio <= (1000)::numeric)))
);


--
-- Name: servicios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.servicios ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.servicios_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: barberia_media barberia_media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barberia_media
    ADD CONSTRAINT barberia_media_pkey PRIMARY KEY (id);


--
-- Name: barberias barberias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barberias
    ADD CONSTRAINT barberias_pkey PRIMARY KEY (id);


--
-- Name: bloqueos bloqueos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bloqueos
    ADD CONSTRAINT bloqueos_pkey PRIMARY KEY (id);


--
-- Name: configuracion configuracion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configuracion
    ADD CONSTRAINT configuracion_pkey PRIMARY KEY (clave);


--
-- Name: horarios horarios_barberia_id_dia_semana_hora_apertura_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horarios
    ADD CONSTRAINT horarios_barberia_id_dia_semana_hora_apertura_key UNIQUE (barberia_id, dia_semana, hora_apertura);


--
-- Name: horarios horarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horarios
    ADD CONSTRAINT horarios_pkey PRIMARY KEY (id);


--
-- Name: notificaciones notificaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones
    ADD CONSTRAINT notificaciones_pkey PRIMARY KEY (id);


--
-- Name: pagos pagos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: resenas resenas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resenas
    ADD CONSTRAINT resenas_pkey PRIMARY KEY (id);


--
-- Name: resenas resenas_reserva_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resenas
    ADD CONSTRAINT resenas_reserva_id_key UNIQUE (reserva_id);


--
-- Name: reservas_legacy reservas_legacy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas_legacy
    ADD CONSTRAINT reservas_legacy_pkey PRIMARY KEY (id);


--
-- Name: reservas reservas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas
    ADD CONSTRAINT reservas_pkey PRIMARY KEY (id);


--
-- Name: reservas reservas_sin_cruce; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas
    ADD CONSTRAINT reservas_sin_cruce EXCLUDE USING gist (barberia_id WITH =, tstzrange(inicio, fin, '[)'::text) WITH &&) WHERE ((estado = ANY (ARRAY['solicitada'::text, 'aceptada'::text, 'confirmada'::text])));


--
-- Name: servicios servicios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicios
    ADD CONSTRAINT servicios_pkey PRIMARY KEY (id);


--
-- Name: barberia_media_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX barberia_media_idx ON public.barberia_media USING btree (barberia_id, tipo, orden);


--
-- Name: barberias_distrito_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX barberias_distrito_idx ON public.barberias USING btree (distrito);


--
-- Name: pagos_ref_unica; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX pagos_ref_unica ON public.pagos USING btree (proveedor, proveedor_ref) WHERE (proveedor_ref IS NOT NULL);


--
-- Name: pagos_uno_por_reserva; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX pagos_uno_por_reserva ON public.pagos USING btree (reserva_id) WHERE (estado = ANY (ARRAY['pagado'::text, 'retenido'::text, 'reembolso_pendiente'::text, 'reembolsado'::text]));


--
-- Name: resenas_barberia_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX resenas_barberia_idx ON public.resenas USING btree (barberia_id, created_at DESC);


--
-- Name: reservas_barberia_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reservas_barberia_idx ON public.reservas USING btree (barberia_id, inicio);


--
-- Name: reservas_cliente_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reservas_cliente_idx ON public.reservas USING btree (cliente_id, inicio DESC);


--
-- Name: reservas_vencimiento_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reservas_vencimiento_idx ON public.reservas USING btree (estado, expira_respuesta_en, expira_pago_en) WHERE (estado = ANY (ARRAY['solicitada'::text, 'aceptada'::text]));


--
-- Name: servicios_barberia_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX servicios_barberia_idx ON public.servicios USING btree (barberia_id);


--
-- Name: resenas resenas_sync_rating; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER resenas_sync_rating AFTER INSERT ON public.resenas FOR EACH ROW EXECUTE FUNCTION public.sync_rating();


--
-- Name: servicios servicios_sync_precio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER servicios_sync_precio AFTER INSERT OR DELETE OR UPDATE ON public.servicios FOR EACH ROW EXECUTE FUNCTION public.sync_precio_desde();


--
-- Name: barberia_media barberia_media_barberia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barberia_media
    ADD CONSTRAINT barberia_media_barberia_id_fkey FOREIGN KEY (barberia_id) REFERENCES public.barberias(id) ON DELETE CASCADE;


--
-- Name: bloqueos bloqueos_barberia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bloqueos
    ADD CONSTRAINT bloqueos_barberia_id_fkey FOREIGN KEY (barberia_id) REFERENCES public.barberias(id) ON DELETE CASCADE;


--
-- Name: horarios horarios_barberia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horarios
    ADD CONSTRAINT horarios_barberia_id_fkey FOREIGN KEY (barberia_id) REFERENCES public.barberias(id) ON DELETE CASCADE;


--
-- Name: notificaciones notificaciones_reserva_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones
    ADD CONSTRAINT notificaciones_reserva_id_fkey FOREIGN KEY (reserva_id) REFERENCES public.reservas(id) ON DELETE CASCADE;


--
-- Name: pagos pagos_reserva_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_reserva_id_fkey FOREIGN KEY (reserva_id) REFERENCES public.reservas(id) ON DELETE RESTRICT;


--
-- Name: profiles profiles_barberia_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_barberia_fk FOREIGN KEY (barberia_id) REFERENCES public.barberias(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id);


--
-- Name: resenas resenas_barberia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resenas
    ADD CONSTRAINT resenas_barberia_id_fkey FOREIGN KEY (barberia_id) REFERENCES public.barberias(id) ON DELETE CASCADE;


--
-- Name: resenas resenas_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resenas
    ADD CONSTRAINT resenas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: resenas resenas_reserva_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resenas
    ADD CONSTRAINT resenas_reserva_id_fkey FOREIGN KEY (reserva_id) REFERENCES public.reservas(id) ON DELETE CASCADE;


--
-- Name: reservas reservas_barberia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas
    ADD CONSTRAINT reservas_barberia_id_fkey FOREIGN KEY (barberia_id) REFERENCES public.barberias(id) ON DELETE RESTRICT;


--
-- Name: reservas reservas_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas
    ADD CONSTRAINT reservas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: reservas reservas_servicio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas
    ADD CONSTRAINT reservas_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES public.servicios(id) ON DELETE RESTRICT;


--
-- Name: servicios servicios_barberia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicios
    ADD CONSTRAINT servicios_barberia_id_fkey FOREIGN KEY (barberia_id) REFERENCES public.barberias(id) ON DELETE CASCADE;


--
-- Name: barberia_media; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.barberia_media ENABLE ROW LEVEL SECURITY;

--
-- Name: barberias; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.barberias ENABLE ROW LEVEL SECURITY;

--
-- Name: barberias barberias: edita su dueño; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "barberias: edita su dueño" ON public.barberias FOR UPDATE TO authenticated USING ((id = public.mi_barberia_id())) WITH CHECK ((id = public.mi_barberia_id()));


--
-- Name: barberias barberias: ver verificadas, la propia, o todas si admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "barberias: ver verificadas, la propia, o todas si admin" ON public.barberias FOR SELECT TO authenticated, anon USING (((verificada = true) OR (id = public.mi_barberia_id()) OR public.es_admin()));


--
-- Name: bloqueos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bloqueos ENABLE ROW LEVEL SECURITY;

--
-- Name: bloqueos bloqueos: el dueño administra; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "bloqueos: el dueño administra" ON public.bloqueos TO authenticated USING ((barberia_id = public.mi_barberia_id())) WITH CHECK ((barberia_id = public.mi_barberia_id()));


--
-- Name: configuracion config: lectura publica; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "config: lectura publica" ON public.configuracion FOR SELECT TO authenticated, anon USING (true);


--
-- Name: configuracion config: solo admin edita; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "config: solo admin edita" ON public.configuracion FOR UPDATE TO authenticated USING (public.es_admin()) WITH CHECK (public.es_admin());


--
-- Name: configuracion; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;

--
-- Name: horarios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.horarios ENABLE ROW LEVEL SECURITY;

--
-- Name: horarios horarios: el dueño administra; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "horarios: el dueño administra" ON public.horarios TO authenticated USING ((barberia_id = public.mi_barberia_id())) WITH CHECK ((barberia_id = public.mi_barberia_id()));


--
-- Name: horarios horarios: ver publicos o propios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "horarios: ver publicos o propios" ON public.horarios FOR SELECT TO authenticated, anon USING (((barberia_id = public.mi_barberia_id()) OR public.es_admin() OR (EXISTS ( SELECT 1
   FROM public.barberias b
  WHERE ((b.id = horarios.barberia_id) AND b.verificada)))));


--
-- Name: barberia_media media: el dueño administra; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "media: el dueño administra" ON public.barberia_media TO authenticated USING ((barberia_id = public.mi_barberia_id())) WITH CHECK ((barberia_id = public.mi_barberia_id()));


--
-- Name: barberia_media media: ver publica o propia; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "media: ver publica o propia" ON public.barberia_media FOR SELECT TO authenticated, anon USING (((barberia_id = public.mi_barberia_id()) OR public.es_admin() OR (EXISTS ( SELECT 1
   FROM public.barberias b
  WHERE ((b.id = barberia_media.barberia_id) AND b.verificada)))));


--
-- Name: notificaciones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

--
-- Name: notificaciones notificaciones: leer las propias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "notificaciones: leer las propias" ON public.notificaciones FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: notificaciones notificaciones: marcar leida las propias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "notificaciones: marcar leida las propias" ON public.notificaciones FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: pagos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;

--
-- Name: pagos pagos: cliente, barbero o admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "pagos: cliente, barbero o admin" ON public.pagos FOR SELECT TO authenticated USING ((public.es_admin() OR (EXISTS ( SELECT 1
   FROM public.reservas r
  WHERE ((r.id = pagos.reserva_id) AND ((r.cliente_id = ( SELECT auth.uid() AS uid)) OR (r.barberia_id = public.mi_barberia_id())))))));


--
-- Name: profiles perfil: actualizar el propio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "perfil: actualizar el propio" ON public.profiles FOR UPDATE TO authenticated USING ((id = ( SELECT auth.uid() AS uid))) WITH CHECK ((id = ( SELECT auth.uid() AS uid)));


--
-- Name: profiles perfil: admin lee todos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "perfil: admin lee todos" ON public.profiles FOR SELECT TO authenticated USING (public.es_admin());


--
-- Name: profiles perfil: leer el propio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "perfil: leer el propio" ON public.profiles FOR SELECT TO authenticated USING ((id = ( SELECT auth.uid() AS uid)));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: resenas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.resenas ENABLE ROW LEVEL SECURITY;

--
-- Name: resenas resenas: lectura publica; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "resenas: lectura publica" ON public.resenas FOR SELECT TO authenticated, anon USING ((EXISTS ( SELECT 1
   FROM public.barberias b
  WHERE ((b.id = resenas.barberia_id) AND b.verificada))));


--
-- Name: reservas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;

--
-- Name: reservas reservas: admin ve todas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "reservas: admin ve todas" ON public.reservas FOR SELECT TO authenticated USING (public.es_admin());


--
-- Name: reservas reservas: el barbero ve las de su barberia; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "reservas: el barbero ve las de su barberia" ON public.reservas FOR SELECT TO authenticated USING ((barberia_id = public.mi_barberia_id()));


--
-- Name: reservas reservas: el cliente ve las suyas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "reservas: el cliente ve las suyas" ON public.reservas FOR SELECT TO authenticated USING ((cliente_id = ( SELECT auth.uid() AS uid)));


--
-- Name: reservas_legacy; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reservas_legacy ENABLE ROW LEVEL SECURITY;

--
-- Name: servicios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.servicios ENABLE ROW LEVEL SECURITY;

--
-- Name: servicios servicios: el dueño administra; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "servicios: el dueño administra" ON public.servicios TO authenticated USING ((barberia_id = public.mi_barberia_id())) WITH CHECK ((barberia_id = public.mi_barberia_id()));


--
-- Name: servicios servicios: ver publicos o propios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "servicios: ver publicos o propios" ON public.servicios FOR SELECT TO authenticated, anon USING (((barberia_id = public.mi_barberia_id()) OR public.es_admin() OR (activo AND (EXISTS ( SELECT 1
   FROM public.barberias b
  WHERE ((b.id = servicios.barberia_id) AND b.verificada))))));


--
-- Name: supabase_realtime notificaciones; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.notificaciones;


--
-- Name: supabase_realtime reservas; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.reservas;


--
-- Name: FUNCTION activar_barberia(p_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.activar_barberia(p_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.activar_barberia(p_id bigint) TO service_role;
GRANT ALL ON FUNCTION public.activar_barberia(p_id bigint) TO authenticated;


--
-- Name: FUNCTION cancelar_reserva_barbero(p_reserva_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cancelar_reserva_barbero(p_reserva_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cancelar_reserva_barbero(p_reserva_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.cancelar_reserva_barbero(p_reserva_id uuid) TO authenticated;


--
-- Name: FUNCTION cancelar_reserva_cliente(p_reserva_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cancelar_reserva_cliente(p_reserva_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cancelar_reserva_cliente(p_reserva_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.cancelar_reserva_cliente(p_reserva_id uuid) TO authenticated;


--
-- Name: FUNCTION cfg(p_clave text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cfg(p_clave text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cfg(p_clave text) TO service_role;


--
-- Name: FUNCTION confirmar_pago_interno(p_reserva uuid, p_proveedor text, p_ref text, p_metodo text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.confirmar_pago_interno(p_reserva uuid, p_proveedor text, p_ref text, p_metodo text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.confirmar_pago_interno(p_reserva uuid, p_proveedor text, p_ref text, p_metodo text) TO service_role;


--
-- Name: FUNCTION confirmar_pago_reserva(p_reserva_id uuid, p_proveedor text, p_ref text, p_metodo text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.confirmar_pago_reserva(p_reserva_id uuid, p_proveedor text, p_ref text, p_metodo text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.confirmar_pago_reserva(p_reserva_id uuid, p_proveedor text, p_ref text, p_metodo text) TO service_role;


--
-- Name: FUNCTION crear_reserva(p_barberia_id bigint, p_servicio_id bigint, p_inicio timestamp with time zone, p_nombre text, p_telefono text, p_pedido text, p_extra numeric); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.crear_reserva(p_barberia_id bigint, p_servicio_id bigint, p_inicio timestamp with time zone, p_nombre text, p_telefono text, p_pedido text, p_extra numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION public.crear_reserva(p_barberia_id bigint, p_servicio_id bigint, p_inicio timestamp with time zone, p_nombre text, p_telefono text, p_pedido text, p_extra numeric) TO service_role;
GRANT ALL ON FUNCTION public.crear_reserva(p_barberia_id bigint, p_servicio_id bigint, p_inicio timestamp with time zone, p_nombre text, p_telefono text, p_pedido text, p_extra numeric) TO authenticated;


--
-- Name: FUNCTION dejar_resena(p_reserva_id uuid, p_calificacion integer, p_comentario text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.dejar_resena(p_reserva_id uuid, p_calificacion integer, p_comentario text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.dejar_resena(p_reserva_id uuid, p_calificacion integer, p_comentario text) TO service_role;
GRANT ALL ON FUNCTION public.dejar_resena(p_reserva_id uuid, p_calificacion integer, p_comentario text) TO authenticated;


--
-- Name: FUNCTION es_admin(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.es_admin() FROM PUBLIC;
GRANT ALL ON FUNCTION public.es_admin() TO service_role;
GRANT ALL ON FUNCTION public.es_admin() TO anon;
GRANT ALL ON FUNCTION public.es_admin() TO authenticated;


--
-- Name: FUNCTION expirar_reservas_vencidas(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.expirar_reservas_vencidas() FROM PUBLIC;
GRANT ALL ON FUNCTION public.expirar_reservas_vencidas() TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION horarios_disponibles(p_barberia_id bigint, p_servicio_id bigint, p_fecha date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.horarios_disponibles(p_barberia_id bigint, p_servicio_id bigint, p_fecha date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.horarios_disponibles(p_barberia_id bigint, p_servicio_id bigint, p_fecha date) TO service_role;
GRANT ALL ON FUNCTION public.horarios_disponibles(p_barberia_id bigint, p_servicio_id bigint, p_fecha date) TO anon;
GRANT ALL ON FUNCTION public.horarios_disponibles(p_barberia_id bigint, p_servicio_id bigint, p_fecha date) TO authenticated;


--
-- Name: FUNCTION marcar_asistencia(p_reserva_id uuid, p_asistio boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.marcar_asistencia(p_reserva_id uuid, p_asistio boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.marcar_asistencia(p_reserva_id uuid, p_asistio boolean) TO service_role;
GRANT ALL ON FUNCTION public.marcar_asistencia(p_reserva_id uuid, p_asistio boolean) TO authenticated;


--
-- Name: FUNCTION mi_barberia_id(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.mi_barberia_id() FROM PUBLIC;
GRANT ALL ON FUNCTION public.mi_barberia_id() TO service_role;
GRANT ALL ON FUNCTION public.mi_barberia_id() TO anon;
GRANT ALL ON FUNCTION public.mi_barberia_id() TO authenticated;


--
-- Name: FUNCTION notificar(p_user uuid, p_titulo text, p_mensaje text, p_tipo text, p_reserva uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notificar(p_user uuid, p_titulo text, p_mensaje text, p_tipo text, p_reserva uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.notificar(p_user uuid, p_titulo text, p_mensaje text, p_tipo text, p_reserva uuid) TO service_role;


--
-- Name: FUNCTION notificar_barberia(p_barberia bigint, p_titulo text, p_mensaje text, p_tipo text, p_reserva uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notificar_barberia(p_barberia bigint, p_titulo text, p_mensaje text, p_tipo text, p_reserva uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.notificar_barberia(p_barberia bigint, p_titulo text, p_mensaje text, p_tipo text, p_reserva uuid) TO service_role;


--
-- Name: FUNCTION pagar_reserva_prueba(p_reserva_id uuid, p_metodo text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pagar_reserva_prueba(p_reserva_id uuid, p_metodo text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pagar_reserva_prueba(p_reserva_id uuid, p_metodo text) TO service_role;
GRANT ALL ON FUNCTION public.pagar_reserva_prueba(p_reserva_id uuid, p_metodo text) TO authenticated;


--
-- Name: FUNCTION registrar_barberia(p_nombre text, p_distrito text, p_direccion text, p_descripcion text, p_lat double precision, p_lng double precision, p_whatsapp text, p_correo text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.registrar_barberia(p_nombre text, p_distrito text, p_direccion text, p_descripcion text, p_lat double precision, p_lng double precision, p_whatsapp text, p_correo text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.registrar_barberia(p_nombre text, p_distrito text, p_direccion text, p_descripcion text, p_lat double precision, p_lng double precision, p_whatsapp text, p_correo text) TO service_role;
GRANT ALL ON FUNCTION public.registrar_barberia(p_nombre text, p_distrito text, p_direccion text, p_descripcion text, p_lat double precision, p_lng double precision, p_whatsapp text, p_correo text) TO authenticated;


--
-- Name: FUNCTION responder_reserva(p_reserva_id uuid, p_aceptar boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.responder_reserva(p_reserva_id uuid, p_aceptar boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.responder_reserva(p_reserva_id uuid, p_aceptar boolean) TO service_role;
GRANT ALL ON FUNCTION public.responder_reserva(p_reserva_id uuid, p_aceptar boolean) TO authenticated;


--
-- Name: FUNCTION suspender_barberia(p_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.suspender_barberia(p_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.suspender_barberia(p_id bigint) TO service_role;
GRANT ALL ON FUNCTION public.suspender_barberia(p_id bigint) TO authenticated;


--
-- Name: FUNCTION sync_precio_desde(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sync_precio_desde() FROM PUBLIC;
GRANT ALL ON FUNCTION public.sync_precio_desde() TO service_role;


--
-- Name: FUNCTION sync_rating(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sync_rating() FROM PUBLIC;
GRANT ALL ON FUNCTION public.sync_rating() TO service_role;


--
-- Name: TABLE barberia_media; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.barberia_media TO authenticated;
GRANT ALL ON TABLE public.barberia_media TO service_role;
GRANT SELECT ON TABLE public.barberia_media TO anon;


--
-- Name: SEQUENCE barberia_media_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.barberia_media_id_seq TO anon;
GRANT ALL ON SEQUENCE public.barberia_media_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.barberia_media_id_seq TO service_role;


--
-- Name: TABLE barberias; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.barberias TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.barberias TO authenticated;
GRANT ALL ON TABLE public.barberias TO service_role;


--
-- Name: COLUMN barberias.nombre; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(nombre) ON TABLE public.barberias TO authenticated;


--
-- Name: COLUMN barberias.distrito; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(distrito) ON TABLE public.barberias TO authenticated;


--
-- Name: COLUMN barberias.direccion; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(direccion) ON TABLE public.barberias TO authenticated;


--
-- Name: COLUMN barberias.descripcion; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(descripcion) ON TABLE public.barberias TO authenticated;


--
-- Name: COLUMN barberias.imagen_url; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(imagen_url) ON TABLE public.barberias TO authenticated;


--
-- Name: COLUMN barberias.precio_desde; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(precio_desde) ON TABLE public.barberias TO authenticated;


--
-- Name: COLUMN barberias.lat; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(lat) ON TABLE public.barberias TO authenticated;


--
-- Name: COLUMN barberias.lng; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(lng) ON TABLE public.barberias TO authenticated;


--
-- Name: COLUMN barberias.whatsapp; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(whatsapp) ON TABLE public.barberias TO authenticated;


--
-- Name: COLUMN barberias.correo_contacto; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(correo_contacto) ON TABLE public.barberias TO authenticated;


--
-- Name: COLUMN barberias.video_presentacion_url; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(video_presentacion_url) ON TABLE public.barberias TO authenticated;


--
-- Name: COLUMN barberias.acepta_auto; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(acepta_auto) ON TABLE public.barberias TO authenticated;


--
-- Name: COLUMN barberias.disponible_ahora; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(disponible_ahora) ON TABLE public.barberias TO authenticated;


--
-- Name: SEQUENCE barberias_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.barberias_id_seq TO anon;
GRANT ALL ON SEQUENCE public.barberias_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.barberias_id_seq TO service_role;


--
-- Name: TABLE bloqueos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.bloqueos TO authenticated;
GRANT ALL ON TABLE public.bloqueos TO service_role;


--
-- Name: SEQUENCE bloqueos_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.bloqueos_id_seq TO anon;
GRANT ALL ON SEQUENCE public.bloqueos_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.bloqueos_id_seq TO service_role;


--
-- Name: TABLE configuracion; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.configuracion TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.configuracion TO authenticated;
GRANT ALL ON TABLE public.configuracion TO service_role;


--
-- Name: COLUMN configuracion.valor; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(valor) ON TABLE public.configuracion TO authenticated;


--
-- Name: TABLE horarios; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.horarios TO authenticated;
GRANT ALL ON TABLE public.horarios TO service_role;
GRANT SELECT ON TABLE public.horarios TO anon;


--
-- Name: SEQUENCE horarios_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.horarios_id_seq TO anon;
GRANT ALL ON SEQUENCE public.horarios_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.horarios_id_seq TO service_role;


--
-- Name: TABLE notificaciones; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.notificaciones TO authenticated;
GRANT ALL ON TABLE public.notificaciones TO service_role;


--
-- Name: COLUMN notificaciones.leida; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(leida) ON TABLE public.notificaciones TO authenticated;


--
-- Name: SEQUENCE notificaciones_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.notificaciones_id_seq TO anon;
GRANT ALL ON SEQUENCE public.notificaciones_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.notificaciones_id_seq TO service_role;


--
-- Name: TABLE pagos; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.pagos TO authenticated;
GRANT ALL ON TABLE public.pagos TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: COLUMN profiles.nombre; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(nombre) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.telefono; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(telefono) ON TABLE public.profiles TO authenticated;


--
-- Name: TABLE resenas; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.resenas TO authenticated;
GRANT ALL ON TABLE public.resenas TO service_role;
GRANT SELECT ON TABLE public.resenas TO anon;


--
-- Name: SEQUENCE resenas_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.resenas_id_seq TO anon;
GRANT ALL ON SEQUENCE public.resenas_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.resenas_id_seq TO service_role;


--
-- Name: TABLE reservas; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.reservas TO authenticated;
GRANT ALL ON TABLE public.reservas TO service_role;


--
-- Name: TABLE reservas_legacy; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.reservas_legacy TO service_role;


--
-- Name: TABLE servicios; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.servicios TO authenticated;
GRANT ALL ON TABLE public.servicios TO service_role;
GRANT SELECT ON TABLE public.servicios TO anon;


--
-- Name: SEQUENCE servicios_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.servicios_id_seq TO anon;
GRANT ALL ON SEQUENCE public.servicios_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.servicios_id_seq TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict M1cxzc7jgfikWlsPmwfthsgQWTvU6b2teGdgSC9uVkJB1vlr18au6JleVUHa8WA

