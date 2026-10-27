--
-- PostgreSQL database dump
--



-- Dumped from database version 17.11
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
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: meryo_private; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA meryo_private;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone',
    'recovery_code'
);


--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


--
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: -
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: assign_owner_service(); Type: FUNCTION; Schema: meryo_private; Owner: -
--

CREATE FUNCTION meryo_private.assign_owner_service() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
 insert into public.meryo_team_services(member_id,service_id) select m.id,new.id from public.meryo_team_members m join meryo_private.shop_owners o on o.user_id=m.user_id and o.barberia_id=m.barberia_id where m.barberia_id=new.barberia_id on conflict do nothing;return new;
end$$;


--
-- Name: audit_reservation(); Type: FUNCTION; Schema: meryo_private; Owner: -
--

CREATE FUNCTION meryo_private.audit_reservation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
 if tg_op='INSERT' or to_jsonb(new) is distinct from to_jsonb(old) then
  insert into meryo_private.reservation_events(reserva_id,actor_id,action,before_data,after_data)
  values(new.id,auth.uid(),case when tg_op='INSERT' then 'solicitud' else 'cambio' end,
   case when tg_op='INSERT' then null else jsonb_build_object('estado',old.estado,'inicio',old.inicio,'fin',old.fin,'expira_respuesta_en',old.expira_respuesta_en,'expira_pago_en',old.expira_pago_en) end,
   jsonb_build_object('estado',new.estado,'inicio',new.inicio,'fin',new.fin,'expira_respuesta_en',new.expira_respuesta_en,'expira_pago_en',new.expira_pago_en));
 end if;return new;
end$$;


--
-- Name: audit_shop(); Type: FUNCTION; Schema: meryo_private; Owner: -
--

CREATE FUNCTION meryo_private.audit_shop() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
 if to_jsonb(old) is distinct from to_jsonb(new) then
  insert into meryo_private.shop_events(barberia_id,actor_id,action,before_data,after_data)
  values(new.id,auth.uid(),'actualizacion_perfil',to_jsonb(old),to_jsonb(new));
 end if;
 return new;
end$$;


--
-- Name: cancelar_reserva_barbero(uuid); Type: FUNCTION; Schema: meryo_private; Owner: -
--

CREATE FUNCTION meryo_private.cancelar_reserva_barbero(p_reserva_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_bar bigint := public.mi_barberia_id(); v_r public.reservas%rowtype;
begin
  if not public.meryo_cuenta_activa() then raise exception 'Sesion inactiva' using errcode='42501'; end if;
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
$$;


--
-- Name: check_general_bookings(); Type: FUNCTION; Schema: meryo_private; Owner: -
--

CREATE FUNCTION meryo_private.check_general_bookings() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare shop bigint:=coalesce(new.barberia_id,old.barberia_id);begin
 perform pg_advisory_xact_lock(hashtextextended('meryo-shop-slot-'||shop::text,0));
 if exists(select 1 from public.reservas r where r.barberia_id=shop and r.fin>clock_timestamp() and r.estado in ('solicitada','aceptada','confirmada') and
 (case when r.barbero_id is not null then not meryo_private.member_time_ok(r.barbero_id,r.inicio,r.fin) else
 not exists(select 1 from public.horarios h where h.barberia_id=shop and h.dia_semana=extract(dow from r.inicio at time zone 'America/Lima')::int and h.hora_apertura<=(r.inicio at time zone 'America/Lima')::time and h.hora_cierre>=(r.fin at time zone 'America/Lima')::time)
 or exists(select 1 from public.bloqueos b where b.barberia_id=shop and tstzrange(b.inicio,b.fin,'[)')&&tstzrange(r.inicio,r.fin,'[)')) end)) then raise exception 'El horario general o bloqueo afectaría citas vigentes';end if;
 return null;
end$$;


--
-- Name: check_member_existing_bookings(uuid); Type: FUNCTION; Schema: meryo_private; Owner: -
--

CREATE FUNCTION meryo_private.check_member_existing_bookings(p_member uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
 if exists(select 1 from public.reservas r where r.barbero_id=p_member and r.fin>clock_timestamp() and r.estado in ('solicitada','aceptada','confirmada') and not meryo_private.member_time_ok(p_member,r.inicio,r.fin)) then raise exception 'El cambio afectaría citas vigentes. Resuélvelas antes de cambiar la agenda';end if;
end$$;


--
-- Name: guard_booking_slot(); Type: FUNCTION; Schema: meryo_private; Owner: -
--

CREATE FUNCTION meryo_private.guard_booking_slot() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
 if new.estado not in ('solicitada','aceptada','confirmada') then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended('meryo-shop-slot-'||new.barberia_id::text,0));
 if tg_op='INSERT' or row(new.barbero_id,new.inicio,new.fin) is distinct from row(old.barbero_id,old.inicio,old.fin) then
  if new.barbero_id is null or not meryo_private.member_time_ok(new.barbero_id,new.inicio,new.fin) then raise exception 'Horario individual no disponible';end if;
 end if;
 if exists(select 1 from public.reservas r where r.id<>new.id and r.estado in ('solicitada','aceptada','confirmada') and tstzrange(r.inicio,r.fin,'[)')&&tstzrange(new.inicio,new.fin,'[)')
 and ((r.barberia_id=new.barberia_id and (r.barbero_id=new.barbero_id or r.barbero_id is null or new.barbero_id is null)) or r.cliente_id=new.cliente_id)) then raise exception 'Esa hora ya fue tomada o coincide con otra cita del cliente' using errcode='23P01';end if;
 return new;
end$$;


--
-- Name: initialize_owner_team(); Type: FUNCTION; Schema: meryo_private; Owner: -
--

CREATE FUNCTION meryo_private.initialize_owner_team() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare member uuid;begin
 insert into public.meryo_team_members(barberia_id,user_id,display_name) select new.barberia_id,new.user_id,left(coalesce(nullif(trim(p.nombre),''),b.nombre,'Propietario'),80) from public.profiles p join public.barberias b on b.id=new.barberia_id where p.id=new.user_id returning id into member;
 insert into public.meryo_team_hours(member_id,day,kind,starts,ends,legacy_hour_id) select member,dia_semana,'jornada',hora_apertura,hora_cierre,id from public.horarios where barberia_id=new.barberia_id;
 return new;
end$$;


--
-- Name: marcar_asistencia(uuid, boolean); Type: FUNCTION; Schema: meryo_private; Owner: -
--

CREATE FUNCTION meryo_private.marcar_asistencia(p_reserva_id uuid, p_asistio boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_bar bigint := public.mi_barberia_id(); v_r public.reservas%rowtype;
begin
  if not public.meryo_cuenta_activa() then raise exception 'Sesion inactiva' using errcode='42501'; end if;
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
-- Name: member_time_ok(uuid, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: meryo_private; Owner: -
--

CREATE FUNCTION meryo_private.member_time_ok(p_member uuid, p_start timestamp with time zone, p_end timestamp with time zone) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 select exists(select 1 from public.meryo_team_members m where m.id=p_member
 and (p_start at time zone 'America/Lima')::date=(p_end at time zone 'America/Lima')::date
 and exists(select 1 from public.horarios h where h.barberia_id=m.barberia_id and h.dia_semana=extract(dow from p_start at time zone 'America/Lima')::int and h.hora_apertura<=(p_start at time zone 'America/Lima')::time and h.hora_cierre>=(p_end at time zone 'America/Lima')::time)
 and exists(select 1 from public.meryo_team_hours h where h.member_id=m.id and h.active and h.kind='jornada' and h.day=extract(dow from p_start at time zone 'America/Lima')::int and h.starts<=(p_start at time zone 'America/Lima')::time and h.ends>=(p_end at time zone 'America/Lima')::time)
 and not exists(select 1 from public.meryo_team_hours h where h.member_id=m.id and h.active and h.kind='descanso' and h.day=extract(dow from p_start at time zone 'America/Lima')::int and tstzrange(((p_start at time zone 'America/Lima')::date+h.starts) at time zone 'America/Lima',((p_start at time zone 'America/Lima')::date+h.ends) at time zone 'America/Lima','[)') && tstzrange(p_start,p_end,'[)'))
 and not exists(select 1 from public.bloqueos b where b.barberia_id=m.barberia_id and tstzrange(b.inicio,b.fin,'[)')&&tstzrange(p_start,p_end,'[)'))
 and not exists(select 1 from public.meryo_team_blocks b where b.member_id=m.id and b.active and tstzrange(b.starts,b.ends,'[)')&&tstzrange(p_start,p_end,'[)')));
$$;


--
-- Name: queue_push(); Type: FUNCTION; Schema: meryo_private; Owner: -
--

CREATE FUNCTION meryo_private.queue_push() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
 if new.tipo in ('reserva_solicitada','reserva_aceptada','reserva_rechazada','reserva_expirada','reserva_confirmada') then
  insert into meryo_private.push_outbox(notification_id,user_id,event,reserva_id) values(new.id,new.user_id,new.tipo,new.reserva_id);
 end if;
 return new;
end $$;


--
-- Name: require_booking_member(uuid, boolean); Type: FUNCTION; Schema: meryo_private; Owner: -
--

CREATE FUNCTION meryo_private.require_booking_member(p_id uuid, p_accept boolean DEFAULT false) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare r public.reservas%rowtype;begin
 select * into r from public.reservas where id=p_id;if not found then raise exception 'Reserva no encontrada';end if;
 perform pg_advisory_xact_lock(hashtextextended('meryo-shop-slot-'||r.barberia_id::text,0));
 if not public.meryo_es_propietario(r.barberia_id) and not public.meryo_es_cita_asignada(r.barbero_id) then raise exception 'No autorizado para esta cita' using errcode='42501';end if;
 if p_accept and r.barbero_id is not null and not exists(select 1 from public.meryo_team_members m join public.profiles p on p.id=m.user_id where m.id=r.barbero_id and m.active and p.activo) then raise exception 'El integrante está inactivo; revisa la asignación antes de aceptar';end if;
end$$;


--
-- Name: require_owner_member(uuid); Type: FUNCTION; Schema: meryo_private; Owner: -
--

CREATE FUNCTION meryo_private.require_owner_member(p_member uuid) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare shop bigint;begin
 select barberia_id into shop from public.meryo_team_members where id=p_member;
 if not public.meryo_es_propietario(shop) then raise exception 'Integrante de otra barbería o cuenta no propietaria' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('meryo-shop-slot-'||shop::text,0));return shop;
end$$;


--
-- Name: responder_reserva(uuid, boolean); Type: FUNCTION; Schema: meryo_private; Owner: -
--

CREATE FUNCTION meryo_private.responder_reserva(p_reserva_id uuid, p_aceptar boolean) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_bar bigint := public.mi_barberia_id(); v_r public.reservas%rowtype;
begin
  if not public.meryo_cuenta_activa() then raise exception 'Sesion inactiva' using errcode='42501'; end if;
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
      'Tu barbero aceptó la cita. Tienes 10 minutos para pagar el adelanto y confirmarla.',
      'reserva_aceptada', v_r.id);
    return 'aceptada';
  end if;

  update public.reservas set estado = 'rechazada', cerrada_en = clock_timestamp(), expira_respuesta_en = null where id = v_r.id;
  perform public.notificar(v_r.cliente_id, 'Reserva rechazada', 'La barberia no puede atenderte a esa hora. Elige otra.', 'reserva_rechazada', v_r.id);
  return 'rechazada';
end;
$$;


--
-- Name: sync_general_hours(); Type: FUNCTION; Schema: meryo_private; Owner: -
--

CREATE FUNCTION meryo_private.sync_general_hours() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare shop bigint:=coalesce(new.barberia_id,old.barberia_id);member uuid;begin
 perform pg_advisory_xact_lock(hashtextextended('meryo-shop-slot-'||shop::text,0));
 select m.id into member from public.meryo_team_members m join meryo_private.shop_owners o on o.user_id=m.user_id where m.barberia_id=shop;
 if tg_op='DELETE' then update public.meryo_team_hours set active=false,legacy_hour_id=null where legacy_hour_id=old.id;return old;end if;
 if member is not null then
  insert into public.meryo_team_hours(member_id,day,kind,starts,ends,legacy_hour_id) values(member,new.dia_semana,'jornada',new.hora_apertura,new.hora_cierre,new.id)
  on conflict(legacy_hour_id) do nothing;
 end if;return new;
end$$;


--
-- Name: activar_barberia(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.activar_barberia(p_id bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin perform public.meryo_moderar_barberia(p_id,'aprobar',null,(select estado from public.barberias where id=p_id));end$$;


--
-- Name: cancelar_reserva_barbero(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancelar_reserva_barbero(p_reserva_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$begin perform meryo_private.require_booking_member(p_reserva_id);perform meryo_private.cancelar_reserva_barbero(p_reserva_id);end$$;


--
-- Name: cancelar_reserva_cliente(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancelar_reserva_cliente(p_reserva_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_r public.reservas%rowtype; v_res text;
begin
  if not public.meryo_cuenta_activa() then raise exception 'Sesion inactiva' using errcode='42501'; end if;
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
begin
  raise exception 'Use el contrato de pago verificado del servidor' using errcode='42501';
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
  raise exception 'Use el contrato de pago verificado del servidor' using errcode='42501';
end;
$$;


--
-- Name: confirmar_pago_verificado(uuid, text, text, text, bigint, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.confirmar_pago_verificado(p_intent uuid, p_proveedor text, p_referencia text, p_merchant text, p_monto_centimos bigint, p_moneda text, p_live boolean) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare r public.reservas%rowtype; i meryo_private.payment_intents%rowtype;
  receipt meryo_private.payment_receipts%rowtype; result text;
  s meryo_private.launch_settings%rowtype;
begin
  select * into i from meryo_private.payment_intents where id=p_intent;
  if not found then raise exception 'Intento desconocido'; end if;
  select * into r from public.reservas where id=i.reserva_id for update;
  select * into s from meryo_private.launch_settings where id=1;
  if not s.pagos_habilitados or s.entorno='disabled' or p_live is distinct from (s.entorno='production') then raise exception 'Entorno de pago incorrecto'; end if;
  if p_proveedor is distinct from i.proveedor or p_referencia is distinct from i.referencia
    or p_merchant is distinct from i.merchant_id or p_monto_centimos is distinct from i.monto_centimos
    or p_moneda is distinct from i.moneda or p_live is distinct from i.live then
    raise exception 'Pago no coincide con el intento';
  end if;
  select * into receipt from meryo_private.payment_receipts where intent_id=i.id;
  if found then return receipt.resultado; end if;
  if r.estado='aceptada' and r.expira_pago_en>clock_timestamp() then
    insert into public.pagos(reserva_id,monto,moneda,metodo,proveedor,proveedor_ref,estado,comision_plataforma,pagado_en)
    values(r.id,i.monto_centimos/100.0,'PEN',i.metodo,i.proveedor,i.referencia,'pagado',
      0,clock_timestamp());
    update public.reservas set estado='confirmada',pagada_en=clock_timestamp(),expira_pago_en=null where id=r.id;
    perform public.notificar(r.cliente_id,'Reserva confirmada','El servidor verifico el adelanto.','reserva_confirmada',r.id);
    perform public.notificar_barberia(r.barberia_id,'Reserva pagada','El servidor verifico el adelanto.','reserva_pagada',r.id);
    result := 'confirmada';
  else
    if r.estado='aceptada' and r.expira_pago_en<=clock_timestamp() then
      update public.reservas set estado='expirada',cerrada_en=clock_timestamp(),expira_pago_en=null where id=r.id;
    end if;
    -- Retain the verified receipt for reconciliation; NEVER revive a released slot.
    result := 'requiere_conciliacion';
  end if;
  insert into meryo_private.payment_receipts(intent_id,resultado) values(i.id,result);
  return result;
end;
$$;


--
-- Name: crear_reserva(bigint, bigint, timestamp with time zone, text, text, text, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.crear_reserva(p_barberia_id bigint, p_servicio_id bigint, p_inicio timestamp with time zone, p_nombre text, p_telefono text, p_pedido text DEFAULT NULL::text, p_extra numeric DEFAULT 0) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare member uuid;begin
 select m.id into member from public.meryo_team_members m join meryo_private.shop_owners o on o.user_id=m.user_id where m.barberia_id=p_barberia_id;
 return public.meryo_solicitar_cita(p_barberia_id,p_servicio_id,p_inicio,p_nombre,p_telefono,p_pedido,p_extra,member);
end$$;


--
-- Name: dejar_resena(uuid, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.dejar_resena(p_reserva_id uuid, p_calificacion integer, p_comentario text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_r public.reservas%rowtype;
begin
  if not public.meryo_cuenta_activa() then raise exception 'Sesion inactiva' using errcode='42501'; end if;
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
$$;


--
-- Name: es_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.es_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 select coalesce(coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb->>'aal'='aal2',false)
 and public.meryo_sesion_activa()
 and exists(select 1 from public.profiles where id=auth.uid() and rol='admin' and activo is true)
 and exists(select 1 from auth.mfa_factors where user_id=auth.uid() and status='verified');
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
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
 insert into public.profiles(id,email,rol,nombre) values(new.id,new.email,'cliente',
 nullif(left(trim(coalesce(new.raw_user_meta_data->>'nombre',new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name','')),80),''))
 on conflict(id) do nothing;
 return new;
end $$;


--
-- Name: horarios_disponibles(bigint, bigint, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.horarios_disponibles(p_barberia_id bigint, p_servicio_id bigint, p_fecha date) RETURNS TABLE(hora_inicio timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 select * from public.meryo_horarios_barbero(p_barberia_id,p_servicio_id,p_fecha,(select m.id from public.meryo_team_members m join meryo_private.shop_owners o on o.user_id=m.user_id where m.barberia_id=p_barberia_id));
$$;


--
-- Name: marcar_asistencia(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.marcar_asistencia(p_reserva_id uuid, p_asistio boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$begin perform meryo_private.require_booking_member(p_reserva_id);perform meryo_private.marcar_asistencia(p_reserva_id,p_asistio);end$$;


--
-- Name: meryo_aceptar_invitacion(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meryo_aceptar_invitacion(p_token text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare invitation meryo_private.team_invites%rowtype;p public.profiles%rowtype;member uuid;email text;begin
 if not public.meryo_cuenta_activa() or p_token !~ '^[0-9a-f]{64}$' then raise exception 'Inicia sesión con la cuenta invitada' using errcode='42501';end if;
 select * into invitation from meryo_private.team_invites where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') for update;
 if not found or invitation.status<>'pendiente' or invitation.expires_at<=clock_timestamp() then raise exception 'Invitación inválida, usada o vencida';end if;
 select lower(u.email) into email from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null;
 if email is distinct from invitation.email then raise exception 'La invitación pertenece a otro correo verificado' using errcode='42501';end if;
 select * into p from public.profiles where id=auth.uid() for update;
 if p.rol='admin' or (p.barberia_id is not null and p.barberia_id<>invitation.barberia_id) or exists(select 1 from meryo_private.shop_owners where user_id=p.id) then raise exception 'Esta cuenta no puede vincularse a ese equipo';end if;
 perform pg_advisory_xact_lock(hashtextextended('meryo-shop-slot-'||invitation.barberia_id::text,0));
 insert into public.meryo_team_members(barberia_id,user_id,display_name) values(invitation.barberia_id,p.id,invitation.display_name)
 on conflict(user_id) do update set active=true,display_name=excluded.display_name where meryo_team_members.barberia_id=excluded.barberia_id returning id into member;
 if member is null then raise exception 'La cuenta ya pertenece a otro equipo';end if;
 update public.profiles set rol='barbero',barberia_id=invitation.barberia_id where id=p.id;
 update meryo_private.team_invites set status='aceptada',accepted_by=p.id where id=invitation.id;
 insert into meryo_private.shop_events(barberia_id,actor_id,action,after_data) values(invitation.barberia_id,p.id,'aceptar_invitacion',jsonb_build_object('member',member));return member;
end$_$;


--
-- Name: meryo_actualizar_integrante(uuid, text, boolean, bigint[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meryo_actualizar_integrante(p_member uuid, p_name text, p_active boolean, p_services bigint[]) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare shop bigint:=public.mi_barberia_id();m public.meryo_team_members%rowtype;begin
 if not public.meryo_es_propietario(shop) then raise exception 'Solo el propietario puede gestionar el equipo' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('meryo-shop-slot-'||shop::text,0));
 select * into m from public.meryo_team_members where id=p_member and barberia_id=shop for update;if not found then raise exception 'Integrante no encontrado';end if;
 if p_active is null or length(trim(p_name)) not between 2 and 80 then raise exception 'Nombre o estado inválido';end if;
 if not p_active and exists(select 1 from meryo_private.shop_owners where user_id=m.user_id) then raise exception 'No se puede desactivar al propietario';end if;
 if not p_active and exists(select 1 from public.reservas where barbero_id=m.id and fin>clock_timestamp() and estado in ('solicitada','aceptada','confirmada')) then raise exception 'Primero resuelve las citas pendientes de este integrante; no se cancela ni se cobra automáticamente';end if;
 if exists(select 1 from unnest(coalesce(p_services,'{}'::bigint[])) requested(service_id) where not exists(select 1 from public.servicios s where s.id=requested.service_id and s.barberia_id=shop)) then raise exception 'Servicio de otra barbería' using errcode='42501';end if;
 update public.meryo_team_members set display_name=trim(p_name),active=p_active where id=m.id;
 update public.meryo_team_services set active=false where member_id=m.id;
 insert into public.meryo_team_services(member_id,service_id) select m.id,id from (select distinct unnest(coalesce(p_services,'{}'::bigint[])) id) s on conflict(member_id,service_id) do update set active=true;
 insert into meryo_private.shop_events(barberia_id,actor_id,action,before_data,after_data) values(shop,auth.uid(),'actualizar_integrante',jsonb_build_object('member',m.id,'active',m.active,'name',m.display_name),jsonb_build_object('member',m.id,'active',p_active,'name',trim(p_name),'services',p_services));return true;
end$$;


--
-- Name: meryo_admin_barberias(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meryo_admin_barberias() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
 if not public.es_admin() then raise exception 'Administración requiere MFA' using errcode='42501';end if;
 return coalesce((select jsonb_agg(to_jsonb(b)||jsonb_build_object(
 'demo',not public.meryo_barberia_publicable(b.id),
 'propietario',(select jsonb_build_object('id',p.id,'nombre',p.nombre,'email',p.email,'telefono',p.telefono,'activo',p.activo) from meryo_private.shop_owners o join public.profiles p on p.id=o.user_id where o.barberia_id=b.id),
 'servicios',coalesce((select jsonb_agg(to_jsonb(s) order by s.nombre) from public.servicios s where s.barberia_id=b.id),'[]'::jsonb),
 'equipo',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'nombre',p.nombre,'activo',(p.activo and coalesce((select m.active from public.meryo_team_members m where m.user_id=p.id),false)),'propietario',p.id=o.user_id)) from public.profiles p left join meryo_private.shop_owners o on o.barberia_id=p.barberia_id where p.barberia_id=b.id),'[]'::jsonb)
 ) order by b.created_at desc,b.id desc) from public.barberias b),'[]'::jsonb);
end$$;


--
-- Name: meryo_admin_reserva_detalle(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meryo_admin_reserva_detalle(p_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare result jsonb;
begin
 if not public.es_admin() then raise exception 'Administración requiere MFA' using errcode='42501';end if;
 select to_jsonb(r)||jsonb_build_object('barberia',b.nombre,'demo',not public.meryo_barberia_publicable(b.id),
 'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at) from meryo_private.reservation_events e where e.reserva_id=r.id),'[]'::jsonb),
 'payments',coalesce((select jsonb_agg(jsonb_build_object('estado',p.estado,'monto',p.monto,'moneda',p.moneda,'proveedor',p.proveedor,'pagado_en',p.pagado_en,'verificado_servidor',exists(select 1 from meryo_private.payment_intents i join meryo_private.payment_receipts c on c.intent_id=i.id where i.reserva_id=r.id and i.referencia=p.proveedor_ref and i.proveedor=p.proveedor and i.live and c.resultado='confirmada'))) from public.pagos p where p.reserva_id=r.id),'[]'::jsonb),
 'server_now',clock_timestamp()) into result from public.reservas r join public.barberias b on b.id=r.barberia_id where r.id=p_id;
 if result is null then raise exception 'Reserva no encontrada';end if;return result;
end$$;


--
-- Name: meryo_admin_reservas(date, date, bigint, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meryo_admin_reservas(p_from date, p_to date, p_shop bigint DEFAULT NULL::bigint, p_status text DEFAULT ''::text, p_search text DEFAULT ''::text, p_offset integer DEFAULT 0) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
 and position(lower(coalesce(p_search,'')) in lower(concat_ws(' ',r.cliente_nombre,r.servicio_nombre,b.nombre,r.id::text,to_jsonb(r)->>'barbero_id',to_jsonb(r)->>'barbero_nombre')))>0
 ),page as (select * from filtered order by inicio desc,id limit 50 offset p_offset)
 select coalesce((select jsonb_agg(to_jsonb(x)) from page x),'[]'::jsonb),(select count(*) from filtered) into result,total;
 return jsonb_build_object('rows',result,'total',total,'offset',p_offset,'limit',50,'server_now',clock_timestamp());
end$$;


--
-- Name: meryo_admin_resumen(date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meryo_admin_resumen(p_from date, p_to date) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: meryo_admin_usuarios(text, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meryo_admin_usuarios(p_search text DEFAULT ''::text, p_role text DEFAULT ''::text, p_active text DEFAULT ''::text, p_offset integer DEFAULT 0) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare result jsonb;total bigint;
begin
 if not public.es_admin() then raise exception 'Administración requiere MFA' using errcode='42501';end if;
 if p_offset<0 or p_offset>100000 or length(p_search)>100 then raise exception 'Filtro fuera de rango';end if;
 with filtered as (
 select p.id,p.nombre,p.email,p.telefono,p.rol,p.activo,(select m.active from public.meryo_team_members m where m.user_id=p.id) team_active,p.barberia_id,b.nombre barberia,
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


--
-- Name: meryo_agregar_bloqueo(uuid, timestamp with time zone, timestamp with time zone, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meryo_agregar_bloqueo(p_member uuid, p_start timestamp with time zone, p_end timestamp with time zone, p_reason text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare shop bigint;result uuid;begin
 shop:=meryo_private.require_owner_member(p_member);
 if p_start is null or p_end is null or p_end<=p_start or p_end-p_start>interval '366 days' or length(trim(coalesce(p_reason,''))) not between 3 and 300 then raise exception 'Revisa fechas y motivo del bloqueo';end if;
 insert into public.meryo_team_blocks(member_id,starts,ends,reason) values(p_member,p_start,p_end,trim(p_reason)) returning id into result;
 perform meryo_private.check_member_existing_bookings(p_member);
 insert into meryo_private.shop_events(barberia_id,actor_id,action,after_data) values(shop,auth.uid(),'agregar_bloqueo',jsonb_build_object('id',result,'member',p_member,'start',p_start,'end',p_end,'reason',trim(p_reason)));return result;
end$$;


--
-- Name: meryo_agregar_tramo(uuid, integer, text, time without time zone, time without time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meryo_agregar_tramo(p_member uuid, p_day integer, p_kind text, p_start time without time zone, p_end time without time zone) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare shop bigint;result uuid;begin
 shop:=meryo_private.require_owner_member(p_member);
 if p_start is null or p_end is null or p_end<=p_start or p_day not between 0 and 6 or p_kind not in ('jornada','descanso') then raise exception 'Tramo inválido';end if;
 if exists(select 1 from public.meryo_team_hours where member_id=p_member and day=p_day and kind=p_kind and active and starts<p_end and ends>p_start) then raise exception 'Este tramo se superpone con otro del mismo tipo';end if;
 if p_kind='descanso' and not exists(select 1 from public.meryo_team_hours where member_id=p_member and day=p_day and kind='jornada' and active and starts<=p_start and ends>=p_end) then raise exception 'El descanso debe estar dentro de una jornada';end if;
 insert into public.meryo_team_hours(member_id,day,kind,starts,ends) values(p_member,p_day,p_kind,p_start,p_end) returning id into result;
 perform meryo_private.check_member_existing_bookings(p_member);
 insert into meryo_private.shop_events(barberia_id,actor_id,action,after_data) values(shop,auth.uid(),'agregar_tramo',jsonb_build_object('member',p_member,'id',result,'kind',p_kind,'day',p_day,'start',p_start,'end',p_end));return result;
end$$;


--
-- Name: meryo_barberia_publicable(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meryo_barberia_publicable(p_id bigint) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 select not exists(select 1 from meryo_private.catalog_exclusions e where e.barberia_id=p_id and e.active);
$$;


--
-- Name: meryo_barberos_servicio(bigint, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meryo_barberos_servicio(p_shop bigint, p_service bigint) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'nombre',m.display_name) order by m.display_name,m.id),'[]'::jsonb)
 from public.meryo_team_members m join public.profiles p on p.id=m.user_id join public.barberias b on b.id=m.barberia_id
 where m.barberia_id=p_shop and m.active and p.activo and b.verificada and b.estado='activa' and public.meryo_barberia_publicable(b.id)
 and exists(select 1 from public.meryo_team_services ms join public.servicios s on s.id=ms.service_id where ms.member_id=m.id and ms.service_id=p_service and ms.active and s.activo and s.barberia_id=p_shop);
$$;


--
-- Name: meryo_catalogo_base_011(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meryo_catalogo_base_011() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',b.id,'nombre',b.nombre,'distrito',b.distrito,'direccion',b.direccion,
  'descripcion',b.descripcion,'imagen_url',b.imagen_url,'lat',b.lat,'lng',b.lng,
  'whatsapp',b.whatsapp,'correo_contacto',b.correo_contacto,
  'video_presentacion_url',b.video_presentacion_url,
  'estado',b.estado,'verificada',b.verificada,
  'precio_desde',(select min(s.precio) from public.servicios s where s.barberia_id=b.id and s.activo),
  'rating',reviews.rating,'total_resenas',reviews.total,'reviews_verified',true,
  'servicios',coalesce((select jsonb_agg(jsonb_build_object(
   'id',s.id,'nombre',s.nombre,'descripcion',s.descripcion,'precio',s.precio,
   'duracion_min',s.duracion_min,'activo',s.activo) order by s.nombre,s.id)
   from public.servicios s where s.barberia_id=b.id and s.activo),'[]'::jsonb)
 ) order by b.nombre,b.id),'[]'::jsonb)
 from public.barberias b
 cross join lateral (
  select avg(r.calificacion)::numeric(3,2) rating,count(*)::integer total
  from public.resenas r where r.barberia_id=b.id and r.calificacion between 1 and 5
 ) reviews
 where b.verificada is true and b.estado='activa' and public.meryo_barberia_publicable(b.id);
$$;


--
-- Name: meryo_catalogo_base_012(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meryo_catalogo_base_012() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 select coalesce(jsonb_agg(b||jsonb_build_object(
 'assets',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'kind',a.kind,'object_path',a.object_path,'title',a.title) order by a.created_at) from public.meryo_shop_assets a where a.barberia_id=(b->>'id')::bigint and a.active),'[]'::jsonb),
 'resenas',coalesce((select jsonb_agg(to_jsonb(r)) from (select id,autor,calificacion,comentario,created_at from public.resenas where barberia_id=(b->>'id')::bigint order by created_at desc limit 50) r),'[]'::jsonb),
 'equipo',coalesce((select jsonb_agg(jsonb_build_object('nombre',coalesce(p.nombre,'Propietario'),'propietario',true)) from meryo_private.shop_owners o join public.profiles p on p.id=o.user_id where o.barberia_id=(b->>'id')::bigint and p.activo),'[]'::jsonb)
 )),'[]'::jsonb) from jsonb_array_elements(public.meryo_catalogo_base_011()) b;
$$;


--
-- Name: meryo_catalogo_publico(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meryo_catalogo_publico() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 select coalesce(jsonb_agg(b||jsonb_build_object('equipo',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'nombre',m.display_name,'propietario',exists(select 1 from meryo_private.shop_owners o where o.user_id=m.user_id),'servicios',coalesce((select jsonb_agg(s.service_id) from public.meryo_team_services s where s.member_id=m.id and s.active),'[]'::jsonb)) order by m.display_name,m.id) from public.meryo_team_members m join public.profiles p on p.id=m.user_id where m.barberia_id=(b->>'id')::bigint and m.active and p.activo),'[]'::jsonb))),'[]'::jsonb)
 from jsonb_array_elements(public.meryo_catalogo_base_012()) b;
$$;


--
-- Name: meryo_contenido_config(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meryo_contenido_config() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 select jsonb_build_object('uploads_enabled',uploads_enabled,'reason','Falta verificar una carga y descarga reales de Storage en un entorno de pruebas separado.','image_limit',5242880,'video_limit',20971520) from meryo_private.shop_content_settings where id=1;
$$;


--
-- Name: meryo_cuenta_activa(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meryo_cuenta_activa() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 select public.meryo_sesion_activa() and exists(select 1 from public.profiles where id=auth.uid() and activo is true);
$$;


--
-- Name: meryo_editar_tramo(uuid, time without time zone, time without time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meryo_editar_tramo(p_id uuid, p_start time without time zone, p_end time without time zone) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare h public.meryo_team_hours%rowtype;shop bigint;begin
 select * into h from public.meryo_team_hours where id=p_id and active;if not found then raise exception 'Tramo no encontrado';end if;
 shop:=meryo_private.require_owner_member(h.member_id);
 if p_start is null or p_end is null or p_end<=p_start then raise exception 'Tramo inválido';end if;
 if exists(select 1 from public.meryo_team_hours where member_id=h.member_id and day=h.day and kind=h.kind and active and id<>h.id and starts<p_end and ends>p_start) then raise exception 'Este tramo se superpone con otro del mismo tipo';end if;
 if h.kind='descanso' and not exists(select 1 from public.meryo_team_hours where member_id=h.member_id and day=h.day and kind='jornada' and active and starts<=p_start and ends>=p_end) then raise exception 'El descanso debe estar dentro de una jornada';end if;
 update public.meryo_team_hours set starts=p_start,ends=p_end where id=h.id;
 perform meryo_private.check_member_existing_bookings(h.member_id);
 insert into meryo_private.shop_events(barberia_id,actor_id,action,before_data,after_data) values(shop,auth.uid(),'editar_tramo',jsonb_build_object('id',p_id,'start',h.starts,'end',h.ends),jsonb_build_object('id',p_id,'start',p_start,'end',p_end));return true;
end$$;


--
-- Name: meryo_equipo(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meryo_equipo() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare shop bigint:=public.mi_barberia_id();is_owner boolean;begin
 if shop is null then raise exception 'Tu cuenta no tiene acceso activo a un equipo' using errcode='42501';end if;
 is_owner:=public.meryo_es_propietario(shop);
 return jsonb_build_object('shop',shop,'owner',is_owner,'server_now',clock_timestamp(),
 'members',coalesce((select jsonb_agg(to_jsonb(x) order by x.display_name) from (select m.id,m.display_name,m.active,m.user_id,
 case when is_owner or m.user_id=auth.uid() then p.email end email,
 exists(select 1 from meryo_private.shop_owners o where o.user_id=m.user_id and o.barberia_id=shop) propietario,
 coalesce((select jsonb_agg(s.service_id) from public.meryo_team_services s where s.member_id=m.id and s.active),'[]'::jsonb) services,
 coalesce((select jsonb_agg(to_jsonb(h) order by h.day,h.starts) from public.meryo_team_hours h where h.member_id=m.id and h.active),'[]'::jsonb) hours,
 coalesce((select jsonb_agg(to_jsonb(b) order by b.starts) from public.meryo_team_blocks b where b.member_id=m.id and b.active and b.ends>clock_timestamp()),'[]'::jsonb) blocks
 from public.meryo_team_members m join public.profiles p on p.id=m.user_id where m.barberia_id=shop and (is_owner or m.user_id=auth.uid())) x),'[]'::jsonb),
 'invites',case when is_owner then coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'email',i.email,'display_name',i.display_name,'expires_at',i.expires_at,'status',case when i.status='pendiente' and i.expires_at<=clock_timestamp() then 'vencida' else i.status end) order by i.created_at desc) from meryo_private.team_invites i where i.barberia_id=shop),'[]'::jsonb) else '[]'::jsonb end);
end$$;


--
-- Name: meryo_es_cita_asignada(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meryo_es_cita_asignada(p_member uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 select public.meryo_cuenta_activa() and exists(select 1 from public.meryo_team_members where id=p_member and user_id=auth.uid() and active and barberia_id=public.mi_barberia_id());
$$;


--
-- Name: meryo_es_propietario(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meryo_es_propietario(p_id bigint) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 select public.meryo_cuenta_activa() and exists(select 1 from meryo_private.shop_owners where barberia_id=p_id and user_id=auth.uid());
$$;


--
-- Name: meryo_guardar_perfil(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meryo_guardar_perfil(p_data jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare b public.barberias%rowtype; identity_changed boolean;
begin
 select * into b from public.barberias where id=public.mi_barberia_id() for update;
 if not found or not public.meryo_es_propietario(b.id) then raise exception 'Solo el propietario puede editar este perfil' using errcode='42501'; end if;
 if exists(select 1 from jsonb_object_keys(p_data) k where k not in ('nombre','distrito','direccion','descripcion','lat','lng','whatsapp','correo_contacto','disponible_ahora')) then raise exception 'Campo no permitido';end if;
 if length(trim(coalesce(p_data->>'nombre','')))<2 or length(p_data->>'nombre')>80 or length(trim(coalesce(p_data->>'direccion','')))<3 or length(p_data->>'direccion')>200 or length(trim(coalesce(p_data->>'distrito','')))<2 or length(p_data->>'distrito')>80 or length(coalesce(p_data->>'descripcion',''))>2000 or length(coalesce(p_data->>'whatsapp',''))>20 or length(coalesce(p_data->>'correo_contacto',''))>120 then raise exception 'Revisa nombre, dirección, distrito y longitud del contenido';end if;
 identity_changed:=row(b.nombre,b.direccion,b.distrito,b.lat,b.lng) is distinct from row(trim(p_data->>'nombre'),trim(p_data->>'direccion'),trim(p_data->>'distrito'),(p_data->>'lat')::double precision,(p_data->>'lng')::double precision);
 update public.barberias set nombre=trim(p_data->>'nombre'),direccion=trim(p_data->>'direccion'),distrito=trim(p_data->>'distrito'),descripcion=p_data->>'descripcion',lat=(p_data->>'lat')::double precision,lng=(p_data->>'lng')::double precision,whatsapp=p_data->>'whatsapp',correo_contacto=p_data->>'correo_contacto',disponible_ahora=coalesce((p_data->>'disponible_ahora')::boolean,false),
 estado=case when identity_changed and estado='activa' then 'pendiente' else estado end,
 verificada=case when identity_changed then false else verificada end where id=b.id returning * into b;
 return to_jsonb(b);
end$$;


--
-- Name: meryo_historial_barberia(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meryo_historial_barberia(p_id bigint) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
 if not public.es_admin() and not public.meryo_es_propietario(p_id) then raise exception 'No autorizado' using errcode='42501';end if;
 return coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from (select id,actor_id,action,reason,before_data,after_data,created_at from meryo_private.shop_events where barberia_id=p_id order by created_at desc limit 100) e),'[]'::jsonb);
end$$;


--
-- Name: meryo_horarios_barbero(bigint, bigint, date, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meryo_horarios_barbero(p_shop bigint, p_service bigint, p_date date, p_member uuid) RETURNS TABLE(hora_inicio timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare duration integer;step integer:=public.cfg('paso_minutos')::int;
begin
 if p_date is null or p_date<(clock_timestamp() at time zone 'America/Lima')::date or p_date>(clock_timestamp() at time zone 'America/Lima')::date+30 then return;end if;
 if not exists(select 1 from jsonb_array_elements(public.meryo_barberos_servicio(p_shop,p_service)) m where m->>'id'=p_member::text) then return;end if;
 select duracion_min into duration from public.servicios where id=p_service and barberia_id=p_shop and activo;
 return query select t from generate_series(p_date::timestamp at time zone 'America/Lima',((p_date+1)::timestamp at time zone 'America/Lima')-make_interval(mins=>duration),make_interval(mins=>step)) t
 where t>=clock_timestamp()+make_interval(mins=>public.cfg('minutos_anticipacion_minima')::int) and t<=clock_timestamp()+interval '30 days'
 and meryo_private.member_time_ok(p_member,t,t+make_interval(mins=>duration))
 and not exists(select 1 from public.reservas r where r.barberia_id=p_shop and (r.barbero_id=p_member or r.barbero_id is null)
 and tstzrange(r.inicio,r.fin,'[)')&&tstzrange(t,t+make_interval(mins=>duration),'[)')
 and (r.estado='confirmada' or(r.estado='solicitada' and r.expira_respuesta_en>clock_timestamp()) or(r.estado='aceptada' and(r.expira_pago_en is null or r.expira_pago_en>clock_timestamp())))) order by t;
end$$;


--
-- Name: meryo_invitar_integrante(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meryo_invitar_integrante(p_email text, p_name text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare shop bigint:=public.mi_barberia_id();token text;invitation meryo_private.team_invites%rowtype;begin
 if not public.meryo_es_propietario(shop) then raise exception 'Solo el propietario puede invitar' using errcode='42501';end if;
 p_email:=lower(trim(p_email));p_name:=trim(p_name);
 if p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(p_email)>254 or length(p_name) not between 2 and 80 then raise exception 'Revisa correo y nombre profesional';end if;
 perform pg_advisory_xact_lock(hashtextextended('meryo-shop-slot-'||shop::text,0));
 if (select count(*) from meryo_private.team_invites where barberia_id=shop and created_at>clock_timestamp()-interval '1 day')>=50 then raise exception 'Límite diario de invitaciones alcanzado';end if;
 token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
 insert into meryo_private.team_invites(barberia_id,email,display_name,token_hash,created_by) values(shop,p_email,p_name,encode(sha256(convert_to(token,'UTF8')),'hex'),auth.uid()) returning * into invitation;
 insert into meryo_private.shop_events(barberia_id,actor_id,action,after_data) values(shop,auth.uid(),'invitar_integrante',jsonb_build_object('invite',invitation.id,'email',p_email));
 return jsonb_build_object('id',invitation.id,'token',token,'expires_at',invitation.expires_at);
end$_$;


--
-- Name: meryo_moderar_barberia(bigint, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meryo_moderar_barberia(p_id bigint, p_action text, p_reason text, p_expected text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare b public.barberias%rowtype;target text;
begin
 if not public.es_admin() then raise exception 'Administración requiere sesión real y MFA' using errcode='42501';end if;
 select * into b from public.barberias where id=p_id for update;
 if not found then raise exception 'Barbería no encontrada';end if;
 if not public.meryo_barberia_publicable(p_id) then raise exception 'Demo separado: no se publica mediante moderación';end if;
 if b.estado is distinct from p_expected then raise exception 'Otro cambio actualizó esta barbería. Recarga la ficha';end if;
 target:=case when p_action='aprobar' and b.estado in ('pendiente','rechazada') then 'activa' when p_action='rechazar' and b.estado='pendiente' then 'rechazada' when p_action='suspender' and b.estado='activa' then 'suspendida' when p_action='reactivar' and b.estado='suspendida' then 'activa' else null end;
 if target is null then raise exception 'Transición no permitida';end if;
 if p_action in ('rechazar','suspender') and length(trim(coalesce(p_reason,'')))<5 then raise exception 'Indica un motivo de al menos 5 caracteres';end if;
 if length(coalesce(p_reason,''))>1000 then raise exception 'Motivo demasiado largo';end if;
 if target='activa' and (b.lat is null or b.lng is null or nullif(trim(b.nombre),'') is null or nullif(trim(b.direccion),'') is null or not exists(select 1 from public.servicios where barberia_id=p_id and activo)) then raise exception 'Completa ubicación, perfil y al menos un servicio activo antes de aprobar';end if;
 update public.barberias set estado=target,verificada=(target='activa') where id=p_id;
 insert into meryo_private.shop_events(barberia_id,actor_id,action,reason,before_data,after_data) values(p_id,auth.uid(),p_action,nullif(trim(p_reason),''),jsonb_build_object('estado',b.estado),jsonb_build_object('estado',target));
 perform public.notificar(o.user_id,'Revisión de tu barbería',target||coalesce(': '||nullif(trim(p_reason),''),''),'barberia_revision',null) from meryo_private.shop_owners o where o.barberia_id=p_id;
 return jsonb_build_object('id',p_id,'estado',target,'verificada',target='activa');
end$$;


--
-- Name: meryo_publicar_archivo(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meryo_publicar_archivo(p_path text, p_kind text, p_title text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare shop bigint:=public.mi_barberia_id();meta jsonb;asset uuid;owner_text text;
begin
 if not (select uploads_enabled from meryo_private.shop_content_settings where id=1) then raise exception 'Subidas bloqueadas hasta verificar Storage en pruebas';end if;
 if not public.meryo_es_propietario(shop) or split_part(p_path,'/',1)<>shop::text then raise exception 'No autorizado' using errcode='42501';end if;
 if p_kind not in ('portada','foto','video') or length(coalesce(p_title,''))>100 then raise exception 'Tipo o título inválido';end if;
 select metadata,owner_id into meta,owner_text from storage.objects where bucket_id='meryo-shop-content' and name=p_path for share;
 if not found or owner_text is distinct from auth.uid()::text then raise exception 'Primero sube el archivo con tu propia sesión';end if;
 if coalesce((meta->>'size')::bigint,0)<=0 or (meta->>'size')::bigint>(case when p_kind='video' then 20971520 else 5242880 end) or coalesce(meta->>'mimetype','')<>all(case when p_kind='video' then array['video/mp4','video/webm'] else array['image/jpeg','image/png','image/webp'] end) then raise exception 'Formato o tamaño no permitido';end if;
 if p_kind in ('portada','video') then update public.meryo_shop_assets set active=false,retired_at=clock_timestamp() where barberia_id=shop and kind=p_kind and active;end if;
 insert into public.meryo_shop_assets(barberia_id,kind,object_path,title,mime,bytes) values(shop,p_kind,p_path,coalesce(p_title,''),meta->>'mimetype',(meta->>'size')::bigint) returning id into asset;
 insert into meryo_private.shop_events(barberia_id,actor_id,action,after_data) values(shop,auth.uid(),'publicar_archivo',jsonb_build_object('asset',asset,'kind',p_kind));
 return asset;
end$$;


--
-- Name: meryo_quitar_push(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meryo_quitar_push(p_endpoint text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
 delete from meryo_private.push_subscriptions where user_id=auth.uid() and endpoint=p_endpoint;
 return found;
end $$;


--
-- Name: meryo_registrar_push(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meryo_registrar_push(p_subscription jsonb) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare uid uuid:=auth.uid(); ep text:=p_subscription->>'endpoint'; pk text:=p_subscription->'keys'->>'p256dh'; ak text:=p_subscription->'keys'->>'auth';
begin
 if uid is null or not public.meryo_cuenta_activa() then raise exception 'No autorizado' using errcode='42501'; end if;
 if ep is null or ep !~ '^https://' or length(ep)>2048 or pk is null or pk !~ '^[A-Za-z0-9_-]{80,150}$' or ak is null or ak !~ '^[A-Za-z0-9_-]{20,30}$' then raise exception 'Suscripcion invalida'; end if;
 insert into meryo_private.push_subscriptions(endpoint,user_id,p256dh,auth) values(ep,uid,pk,ak)
 on conflict(endpoint) do update set p256dh=excluded.p256dh,auth=excluded.auth,updated_at=clock_timestamp()
 where meryo_private.push_subscriptions.user_id=uid;
 if not found then raise exception 'Suscripcion pertenece a otra cuenta' using errcode='42501'; end if;
 return true;
end $_$;


--
-- Name: meryo_reservas_config(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meryo_reservas_config() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 select jsonb_build_object('respuesta_segundos',900,'plazo_pago_segundos',plazo_pago_segundos,
 'modelo_comercial',modelo_comercial,'comision_por_corte',0,'cobros_habilitados',false,
 'push_disponible',push_envio_habilitado and push_public_key is not null,
 'push_public_key',case when push_envio_habilitado then push_public_key else null end)
 from meryo_private.launch_settings where id=1;
$$;


--
-- Name: meryo_reservas_estado(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meryo_reservas_estado() RETURNS jsonb
    LANGUAGE sql
    SET search_path TO ''
    AS $$
 select jsonb_build_object('server_now',clock_timestamp(),'reservas',coalesce(jsonb_agg(
  to_jsonb(r)||jsonb_build_object('barberias',jsonb_build_object('nombre',b.nombre),
  'pagos',(select coalesce(jsonb_agg(jsonb_build_object('proveedor',p.proveedor,'estado',p.estado)),'[]'::jsonb) from public.pagos p where p.reserva_id=r.id))
  order by (r.estado in ('solicitada','aceptada')) desc,r.inicio desc),'[]'::jsonb))
 from public.reservas r join public.barberias b on b.id=r.barberia_id
 where r.cliente_id=(select auth.uid()) or r.barberia_id=public.mi_barberia_id();
$$;


--
-- Name: meryo_retirar_archivo(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meryo_retirar_archivo(p_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare shop bigint:=public.mi_barberia_id();begin
 if not public.meryo_es_propietario(shop) then raise exception 'No autorizado' using errcode='42501';end if;
 update public.meryo_shop_assets set active=false,retired_at=clock_timestamp() where id=p_id and barberia_id=shop and active;
 if not found then raise exception 'Archivo activo no encontrado';end if;
 insert into meryo_private.shop_events(barberia_id,actor_id,action,after_data) values(shop,auth.uid(),'retirar_archivo',jsonb_build_object('asset',p_id));return true;
end$$;


--
-- Name: meryo_retirar_bloqueo(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meryo_retirar_bloqueo(p_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare member uuid;shop bigint;begin
 select member_id into member from public.meryo_team_blocks where id=p_id and active;if member is null then raise exception 'Bloqueo activo no encontrado';end if;
 shop:=meryo_private.require_owner_member(member);update public.meryo_team_blocks set active=false where id=p_id;
 insert into meryo_private.shop_events(barberia_id,actor_id,action,after_data) values(shop,auth.uid(),'retirar_bloqueo',jsonb_build_object('id',p_id,'member',member));return true;
end$$;


--
-- Name: meryo_retirar_tramo(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meryo_retirar_tramo(p_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare member uuid;shop bigint;begin
 select member_id into member from public.meryo_team_hours where id=p_id and active;if member is null then raise exception 'Tramo activo no encontrado';end if;
 shop:=meryo_private.require_owner_member(member);update public.meryo_team_hours set active=false where id=p_id;
 perform meryo_private.check_member_existing_bookings(member);
 insert into meryo_private.shop_events(barberia_id,actor_id,action,after_data) values(shop,auth.uid(),'retirar_tramo',jsonb_build_object('id',p_id,'member',member));return true;
end$$;


--
-- Name: meryo_revocar_invitacion(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meryo_revocar_invitacion(p_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare shop bigint:=public.mi_barberia_id();begin
 if not public.meryo_es_propietario(shop) then raise exception 'No autorizado' using errcode='42501';end if;
 update meryo_private.team_invites set status='revocada' where id=p_id and barberia_id=shop and status='pendiente';if not found then raise exception 'Invitación pendiente no encontrada';end if;
 insert into meryo_private.shop_events(barberia_id,actor_id,action,after_data) values(shop,auth.uid(),'revocar_invitacion',jsonb_build_object('invite',p_id));return true;
end$$;


--
-- Name: meryo_sesion_activa(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meryo_sesion_activa() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 select exists(select 1 from auth.sessions s where s.user_id=auth.uid()
 and s.id::text=coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb->>'session_id'
 and (s.not_after is null or s.not_after>clock_timestamp()));
$$;


--
-- Name: meryo_solicitar_cita(bigint, bigint, timestamp with time zone, text, text, text, numeric, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meryo_solicitar_cita(p_barberia_id bigint, p_servicio_id bigint, p_inicio timestamp with time zone, p_nombre text, p_telefono text, p_pedido text, p_extra numeric, p_barbero_id uuid) RETURNS uuid
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
  if not public.meryo_cuenta_activa() then raise exception 'Sesion inactiva' using errcode='42501'; end if;
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
  if coalesce(p_extra, 0) <> 0 then raise exception 'El cliente no puede asignarse recargos'; end if;

  perform public.expirar_reservas_vencidas();
  perform pg_advisory_xact_lock(hashtextextended('meryo-shop-slot-'||p_barberia_id::text,0));
  if not exists(select 1 from jsonb_array_elements(public.meryo_barberos_servicio(p_barberia_id,p_servicio_id)) m where m->>'id'=p_barbero_id::text) then raise exception 'Elige un barbero habilitado para este servicio';end if;

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

  v_total := v_serv.precio;
  v_adelanto := round(v_total * 0.5, 2);
  v_estado := 'solicitada'; -- Acceptance is always manual.

  begin
    insert into public.reservas (barbero_id,barbero_nombre,barberia_id, servicio_id, cliente_id, cliente_nombre, cliente_telefono,
      servicio_nombre, duracion_min, inicio, fin, pedido_especial, extra_personalizacion,
      precio_total, monto_adelanto, estado, expira_respuesta_en, expira_pago_en, aceptada_en)
    values (p_barbero_id,(select display_name from public.meryo_team_members where id=p_barbero_id),p_barberia_id, p_servicio_id, v_uid, p_nombre, p_telefono,
      v_serv.nombre, v_serv.duracion_min, p_inicio, v_fin, nullif(left(trim(coalesce(p_pedido, '')), 300), ''),
      coalesce(p_extra, 0), v_total, v_adelanto, v_estado,
      case when v_estado = 'solicitada' then clock_timestamp() + interval '15 minutes' end,
      case when v_estado = 'aceptada' then clock_timestamp() + (select make_interval(secs => plazo_pago_segundos) from meryo_private.launch_settings where id=1) end,
      case when v_estado = 'aceptada' then clock_timestamp() end)
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'Esa hora ya fue tomada. Elige otra.';
  end;

  v_msg := p_nombre || ' pide ' || v_serv.nombre || ' el ' || to_char(v_ini_l, 'DD/MM HH24:MI');
  if v_estado = 'solicitada' then
    perform public.notificar_barberia(p_barberia_id, 'Nueva solicitud de reserva',
      v_msg || '. Tienes 15 minutos para responder.', 'reserva_solicitada', v_id);
  else
    perform public.notificar_barberia(p_barberia_id, 'Nueva reserva (aceptada automaticamente)', v_msg, 'reserva_solicitada', v_id);
    perform public.notificar(v_uid, 'Reserva aceptada', 'Paga el adelanto de S/ ' || v_adelanto || ' para confirmar tu cita.', 'reserva_aceptada', v_id);
  end if;
  update public.profiles set nombre=coalesce(nullif(trim(nombre),''),p_nombre), telefono=coalesce(nullif(trim(telefono),''),p_telefono) where id=v_uid;
  return v_id;
end;
$_$;


--
-- Name: mi_barberia_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mi_barberia_id() RETURNS bigint
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 select p.barberia_id from public.profiles p join public.meryo_team_members m on m.user_id=p.id and m.barberia_id=p.barberia_id
 where p.id=auth.uid() and p.rol='barbero' and p.activo and m.active and public.meryo_sesion_activa();
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
 insert into public.notificaciones(user_id,titulo,mensaje,tipo,reserva_id)
 select distinct p.id,p_titulo,p_mensaje,p_tipo,p_reserva from public.profiles p join public.meryo_team_members m on m.user_id=p.id
 where m.barberia_id=p_barberia and m.active and p.activo and (exists(select 1 from meryo_private.shop_owners o where o.user_id=p.id and o.barberia_id=p_barberia) or exists(select 1 from public.reservas r where r.id=p_reserva and r.barbero_id=m.id));
$$;


--
-- Name: pagar_reserva_prueba(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pagar_reserva_prueba(p_reserva_id uuid, p_metodo text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  raise exception 'Pago simulado deshabilitado en el backend comercial' using errcode='42501';
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
  if not public.meryo_cuenta_activa() then raise exception 'Sesion inactiva' using errcode='42501'; end if;
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

  insert into meryo_private.shop_owners(barberia_id,user_id) values(v_id,v_uid);
  insert into meryo_private.shop_events(barberia_id,actor_id,action,after_data) values(v_id,v_uid,'registro',jsonb_build_object('estado','pendiente'));
  return v_id;
end;
$$;


--
-- Name: registrar_intento_pago_verificado(uuid, uuid, text, text, text, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_intento_pago_verificado(p_reserva uuid, p_cliente uuid, p_proveedor text, p_referencia text, p_merchant text, p_live boolean, p_metodo text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare r public.reservas%rowtype; s meryo_private.launch_settings%rowtype;
  i meryo_private.payment_intents%rowtype;
begin
  select * into r from public.reservas where id=p_reserva and cliente_id=p_cliente for update;
  if not found then raise exception 'Reserva no encontrada'; end if;
  if not exists(select 1 from public.profiles where id=p_cliente and activo is true) then
    raise exception 'Cuenta inactiva' using errcode='42501';
  end if;
  select * into s from meryo_private.launch_settings where id=1;
  if not s.pagos_habilitados or s.entorno='disabled' or not s.reservas_habilitadas or p_live is distinct from (s.entorno='production') then
    raise exception 'Entorno de pago no habilitado';
  end if;
  if r.estado<>'aceptada' or r.expira_pago_en is null or r.expira_pago_en<=clock_timestamp() then
    raise exception 'Reserva no disponible para pago';
  end if;
  if p_proveedor in ('prueba','simulado','mock') then raise exception 'Proveedor simulado prohibido'; end if;
  select * into i from meryo_private.payment_intents where reserva_id=r.id;
  if found then
    if i.proveedor is distinct from p_proveedor or i.referencia is distinct from p_referencia or i.merchant_id is distinct from p_merchant or i.live is distinct from p_live or i.metodo is distinct from p_metodo then
      raise exception 'Intento de pago ya registrado con otros datos';
    end if;
    return i.id;
  end if;
  insert into meryo_private.payment_intents(reserva_id,proveedor,referencia,merchant_id,monto_centimos,moneda,live,metodo)
  values(r.id,p_proveedor,p_referencia,p_merchant,round(r.monto_adelanto*100)::bigint,'PEN',p_live,p_metodo)
  returning id into i.id;
  return i.id;
end;
$$;


--
-- Name: responder_reserva(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.responder_reserva(p_reserva_id uuid, p_aceptar boolean) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$begin perform meryo_private.require_booking_member(p_reserva_id,p_aceptar);return meryo_private.responder_reserva(p_reserva_id,p_aceptar);end$$;


--
-- Name: suspender_barberia(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suspender_barberia(p_id bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin raise exception 'Usa moderación e indica el motivo';end$$;


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


--
-- Name: allow_any_operation(text[]); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.allow_any_operation(expected_operations text[]) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT CASE
      WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
      ELSE raw_operation
    END AS current_operation
    FROM current_operation
  )
  SELECT EXISTS (
    SELECT 1
    FROM normalized n
    CROSS JOIN LATERAL unnest(expected_operations) AS expected_operation
    WHERE expected_operation IS NOT NULL
      AND expected_operation <> ''
      AND n.current_operation = CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END
  );
$$;


--
-- Name: allow_only_operation(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.allow_only_operation(expected_operation text) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT
      CASE
        WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
        ELSE raw_operation
      END AS current_operation,
      CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END AS requested_operation
    FROM current_operation
  )
  SELECT CASE
    WHEN requested_operation IS NULL OR requested_operation = '' THEN FALSE
    ELSE COALESCE(current_operation = requested_operation, FALSE)
  END
  FROM normalized;
$$;


--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


--
-- Name: enforce_bucket_lifecycle_service_role(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.enforce_bucket_lifecycle_service_role() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $$
BEGIN
  IF current_user::text IS DISTINCT FROM TG_ARGV[0]
     AND (
       OLD.lifecycle_configuration IS DISTINCT FROM NEW.lifecycle_configuration
       OR OLD.lifecycle_configuration_generation IS DISTINCT FROM NEW.lifecycle_configuration_generation
     ) THEN
    -- AFTER runs only after caller RLS has accepted the proposed row. The API
    -- recognizes this specific error after rolling back its permission probe;
    -- direct non-service writes still fail and cannot persist the change.
    RAISE EXCEPTION 'bucket control columns may only be changed by the configured storage service role'
      USING ERRCODE = 'PST01',
            SCHEMA = TG_TABLE_SCHEMA,
            TABLE = TG_TABLE_NAME,
            CONSTRAINT = TG_NAME;
  END IF;

  RETURN NULL;
END;
$$;


--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.enforce_bucket_name_length() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Get the last path segment (the actual filename)
    SELECT _parts[array_length(_parts, 1)] INTO _filename;
    -- Extract extension: reverse, split on '.', then reverse again
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    RETURN _parts[array_length(_parts, 1)];
END
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


--
-- Name: get_common_prefix(text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_common_prefix(p_key text, p_prefix text, p_delimiter text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
SELECT CASE
    WHEN p_delimiter <> ''
         AND position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)) > 0
    THEN left(
        p_key,
        length(p_prefix)
            + position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1))
            + length(p_delimiter) - 1
    )
    ELSE NULL
END;
$$;


--
-- Name: get_size_by_bucket(text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_size_by_bucket(noncurrent_versions text DEFAULT 'include'::text, delete_markers text DEFAULT 'include'::text) RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    -- COALESCE first: NULL NOT IN (...) evaluates to NULL (not TRUE), so a
    -- bare NOT IN check silently leaves an explicit NULL argument unreset.
    noncurrent_versions := COALESCE(noncurrent_versions, 'include');
    delete_markers := COALESCE(delete_markers, 'include');
    IF noncurrent_versions NOT IN ('exclude', 'only', 'include') THEN
        noncurrent_versions := 'include';
    END IF;
    IF delete_markers NOT IN ('exclude', 'only', 'include') THEN
        delete_markers := 'include';
    END IF;

    return query
        select sum((metadata->>'size')::bigint)::bigint as size, obj.bucket_id
        from "storage".objects as obj
        where (noncurrent_versions != 'exclude' OR obj.archived_at IS NULL)
          and (noncurrent_versions != 'only' OR obj.archived_at IS NOT NULL)
          and (delete_markers != 'exclude' OR NOT obj.is_delete_marker)
          and (delete_markers != 'only' OR obj.is_delete_marker)
        group by obj.bucket_id;
END
$$;


--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text, raw_prefix_param text DEFAULT NULL::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE sql STABLE
    AS $_$
WITH candidates AS (
    SELECT
        upload.key AS object_key,
        CASE
            WHEN position($3 IN substring(upload.key FROM length(coalesce($7, $2)) + 1)) > 0
            THEN left(
                upload.key,
                length(coalesce($7, $2))
                    + position($3 IN substring(upload.key FROM length(coalesce($7, $2)) + 1))
                    + length($3) - 1
            )
            ELSE upload.key
        END AS result_key,
        upload.id,
        upload.created_at,
        position($3 IN substring(upload.key FROM length(coalesce($7, $2)) + 1)) > 0 AS is_common_prefix
    FROM storage.s3_multipart_uploads AS upload
    WHERE upload.bucket_id = $1
      AND upload.key COLLATE "C" LIKE $2 || '%'
), filtered AS (
    SELECT candidate.*
    FROM candidates AS candidate
    WHERE $5 = ''
       OR candidate.result_key COLLATE "C" > $5
       OR (
           candidate.result_key COLLATE "C" = $5
           AND NOT candidate.is_common_prefix
           AND $6 <> ''
           -- A completed or aborted marker repeats the remaining same-key uploads.
           AND COALESCE(
               (candidate.created_at, candidate.id COLLATE "C") > (
                   SELECT marker.created_at, marker.id COLLATE "C"
                   FROM storage.s3_multipart_uploads AS marker
                   WHERE marker.bucket_id = $1
                     AND marker.key COLLATE "C" = $5
                     AND marker.id = $6
               ),
               TRUE
           )
       )
), ranked AS (
    SELECT
        filtered.*,
        row_number() OVER (
            PARTITION BY filtered.result_key COLLATE "C"
            ORDER BY filtered.created_at, filtered.id COLLATE "C"
        ) AS prefix_rank
    FROM filtered
)
SELECT ranked.result_key, ranked.id, ranked.created_at
FROM ranked
WHERE NOT ranked.is_common_prefix OR ranked.prefix_rank = 1
ORDER BY ranked.result_key COLLATE "C", ranked.created_at, ranked.id COLLATE "C"
LIMIT $4;
$_$;


--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text, text, text, text, timestamp with time zone, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_objects_with_delimiter(_bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, noncurrent_versions text DEFAULT 'exclude'::text, delete_markers text DEFAULT 'exclude'::text, next_token_archived_at timestamp with time zone DEFAULT NULL::timestamp with time zone, next_token_version text DEFAULT ''::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, version text, archived_at timestamp with time zone, is_delete_marker boolean, is_versioned boolean)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;

    -- Configuration
    v_is_asc BOOLEAN;
    v_prefix TEXT;
    v_start TEXT;
    v_start_relative TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;
    v_version_filter TEXT;

    -- true when noncurrent_versions can return >1 row per name; keeps them
    -- ordered most-recent-first and lets pagination resume mid-key
    v_multi_row BOOLEAN;
    v_name_order TEXT;
    v_exact_range_predicate TEXT;
    v_strict_range_predicate TEXT;
    v_inclusive_range_predicate TEXT;

    -- Seek state for the current name. archived_at is normalized to JavaScript's
    -- millisecond precision and version breaks ties within the same millisecond.
    -- Current rows use 'infinity'; NULL means no tiebreak has been established.
    v_next_seek TEXT;
    v_next_seek_at TIMESTAMPTZ;
    v_next_seek_version TEXT;
    v_next_seek_strict BOOLEAN := false;
    v_cursor_is_folder BOOLEAN;
    v_count INT := 0;
    v_previous_seek TEXT;
    v_previous_seek_at TIMESTAMPTZ;
    v_previous_seek_version TEXT;
    v_previous_count INT;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;
    v_batch_query_strict TEXT;
    v_delete_marker_peek_query TEXT;
    v_delete_marker_peek_query_strict TEXT;

BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_is_asc := lower(coalesce(sort_order, 'asc')) = 'asc';
    v_prefix := coalesce(prefix_param, '');
    v_start := CASE WHEN coalesce(next_token, '') <> '' THEN next_token ELSE coalesce(start_after, '') END;
    v_file_batch_size := LEAST(GREATEST(max_keys * 2, 100), 1000);
    v_next_seek_at := NULL;
    v_next_seek_version := '';

    -- COALESCE first: NULL NOT IN (...) evaluates to NULL (not TRUE), so a
    -- bare NOT IN check silently leaves an explicit NULL argument unreset.
    noncurrent_versions := COALESCE(noncurrent_versions, 'exclude');
    delete_markers := COALESCE(delete_markers, 'exclude');
    IF noncurrent_versions NOT IN ('exclude', 'only', 'include') THEN
        noncurrent_versions := 'exclude';
    END IF;
    IF delete_markers NOT IN ('exclude', 'only', 'include') THEN
        delete_markers := 'exclude';
    END IF;

    v_multi_row := noncurrent_versions IN ('only', 'include');
    v_name_order := CASE WHEN v_is_asc THEN 'ASC' ELSE 'DESC' END;

    v_version_filter := '';
    IF noncurrent_versions = 'exclude' THEN
        v_version_filter := v_version_filter || ' AND o.archived_at IS NULL';
    ELSIF noncurrent_versions = 'only' THEN
        v_version_filter := v_version_filter || ' AND o.archived_at IS NOT NULL';
    END IF;
    IF delete_markers = 'exclude' THEN
        v_version_filter := v_version_filter || ' AND NOT o.is_delete_marker';
    ELSIF delete_markers = 'only' THEN
        v_version_filter := v_version_filter || ' AND o.is_delete_marker';
    END IF;

    -- Calculate upper bound for prefix filtering (bytewise, using COLLATE "C")
    IF v_prefix = '' THEN
        v_upper_bound := NULL;
    ELSE
        v_upper_bound := left(v_prefix, -1) || chr(ascii(right(v_prefix, 1)) + 1);
    END IF;

    -- Keep caller-provided cursors inside the requested prefix range.
    IF v_start <> '' AND v_upper_bound IS NOT NULL THEN
        IF v_is_asc THEN
            IF v_start COLLATE "C" < v_prefix COLLATE "C" THEN
                v_start := '';
            ELSIF v_start COLLATE "C" >= v_upper_bound COLLATE "C" THEN
                RETURN;
            END IF;
        ELSE
            IF v_start COLLATE "C" < v_prefix COLLATE "C" THEN
                RETURN;
            ELSIF v_start COLLATE "C" >= v_upper_bound COLLATE "C" THEN
                v_start := '';
            END IF;
        END IF;
    END IF;

    v_start_relative := substring(v_start FROM length(v_prefix) + 1);

    -- Direction affects only the indexed name range and its ordering. Cursor
    -- state transitions and within-key version ordering stay shared.
    IF v_is_asc THEN
        v_exact_range_predicate := 'TRUE';
        v_strict_range_predicate := 'o.name COLLATE "C" > $2';
        v_inclusive_range_predicate := 'o.name COLLATE "C" >= $2';
        IF v_upper_bound IS NOT NULL THEN
            v_exact_range_predicate := 'o.name COLLATE "C" < $3';
            v_strict_range_predicate := v_strict_range_predicate || ' AND o.name COLLATE "C" < $3';
            v_inclusive_range_predicate := v_inclusive_range_predicate || ' AND o.name COLLATE "C" < $3';
        END IF;
    ELSE
        v_exact_range_predicate := 'TRUE';
        v_strict_range_predicate := 'o.name COLLATE "C" < $2';
        v_inclusive_range_predicate := 'o.name COLLATE "C" < $2';
        IF v_prefix <> '' THEN
            v_exact_range_predicate := 'o.name COLLATE "C" >= $3';
            v_strict_range_predicate := v_strict_range_predicate || ' AND o.name COLLATE "C" >= $3';
            v_inclusive_range_predicate := v_inclusive_range_predicate || ' AND o.name COLLATE "C" >= $3';
        END IF;
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    -- The multi-row order matches the externally serialized cursor exactly:
    -- archived_at at millisecond precision, then version as the final tiebreak.
    --
    -- When v_multi_row, the seek is a keyset tuple comparison ("name > $2 OR
    -- (name = $2 AND tiebreak)") - Postgres won't split that OR into indexable
    -- form (confirmed even with fully literal values), so as one WHERE clause
    -- it forces a full bucket scan filtered row-by-row. Splitting it into two
    -- independently-indexable branches (exact name match with the tiebreak
    -- filter, vs. strictly-past names) combined with UNION ALL lets each
    -- branch keep name as a real index condition; the outer ORDER BY/LIMIT
    -- re-merges them into the same page the single query used to produce.
    IF v_multi_row THEN
        v_batch_query := format(
            $sql$
            SELECT *
            FROM (
                (
                    SELECT o.name, o.id, o.updated_at, o.created_at,
                           o.last_accessed_at, o.metadata, o.version,
                           o.archived_at, o.is_delete_marker, o.is_versioned
                    FROM storage.objects o
                    WHERE o.bucket_id = $1
                      AND o.name COLLATE "C" = $2
                      AND %s
                      AND NOT $7::boolean
                      AND (
                          $5::timestamptz IS NULL
                          OR COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) < $5
                          OR (
                              COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) = $5
                              AND COALESCE(o.version, '') > $6
                          )
                      )
                      %s
                    ORDER BY
                        COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) DESC,
                        COALESCE(o.version, '') ASC
                    LIMIT $4
                )
                UNION ALL
                (
                    SELECT o.name, o.id, o.updated_at, o.created_at,
                           o.last_accessed_at, o.metadata, o.version,
                           o.archived_at, o.is_delete_marker, o.is_versioned
                    FROM storage.objects o
                    WHERE o.bucket_id = $1
                      AND %s
                      %s
                    ORDER BY
                        o.name COLLATE "C" %s,
                        COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) DESC,
                        COALESCE(o.version, '') ASC
                    LIMIT $4
                )
            ) sub
            ORDER BY
                sub.name COLLATE "C" %s,
                COALESCE(date_trunc('milliseconds', sub.archived_at), 'infinity'::timestamptz) DESC,
                COALESCE(sub.version, '') ASC
            LIMIT $4
            $sql$,
            v_exact_range_predicate,
            v_version_filter,
            v_strict_range_predicate,
            v_version_filter,
            v_name_order,
            v_name_order
        );
    ELSE
        v_batch_query := format(
            $sql$
            SELECT o.name, o.id, o.updated_at, o.created_at,
                   o.last_accessed_at, o.metadata, o.version,
                   o.archived_at, o.is_delete_marker, o.is_versioned
            FROM storage.objects o
            WHERE o.bucket_id = $1
              AND %s
              %s
            ORDER BY o.name COLLATE "C" %s, o.archived_at DESC
            LIMIT $4
            $sql$,
            v_inclusive_range_predicate,
            v_version_filter,
            v_name_order
        );

        -- Strict counterpart of the query above: used once the single-row
        -- ASC batch advance (below) has left v_next_seek pointing at the
        -- last row already emitted, so an inclusive predicate would
        -- re-match it forever. Only single-row mode ever sets strict mode,
        -- so this variant is never needed when v_multi_row.
        v_batch_query_strict := format(
            $sql$
            SELECT o.name, o.id, o.updated_at, o.created_at,
                   o.last_accessed_at, o.metadata, o.version,
                   o.archived_at, o.is_delete_marker, o.is_versioned
            FROM storage.objects o
            WHERE o.bucket_id = $1
              AND %s
              %s
            ORDER BY o.name COLLATE "C" %s, o.archived_at DESC
            LIMIT $4
            $sql$,
            v_strict_range_predicate,
            v_version_filter,
            v_name_order
        );
    END IF;

    -- The static peek predicates cannot use the partial delete-marker index
    -- once PL/pgSQL switches to a generic plan because whether
    -- is_delete_marker is required remains parameter-dependent. Reuse the
    -- already-specialized batch query with a one-row limit for this sparse
    -- filter so the plan sees a literal `o.is_delete_marker` predicate.
    IF delete_markers = 'only' THEN
        v_delete_marker_peek_query :=
            'SELECT marker_page.name FROM (' || v_batch_query || ') marker_page LIMIT 1';
        IF NOT v_multi_row THEN
            v_delete_marker_peek_query_strict :=
                'SELECT marker_page.name FROM (' || v_batch_query_strict || ') marker_page LIMIT 1';
        END IF;
    END IF;

    -- ========================================================================
    -- SEEK INITIALIZATION: Determine starting position
    -- ========================================================================
    IF v_start = '' THEN
        IF v_is_asc THEN
            v_next_seek := v_prefix;
        ELSE
            -- DESC without cursor performs one specialized initial seek so
            -- partial current-version and delete-marker indexes remain available.
            EXECUTE format(
                'SELECT o.name FROM storage.objects o WHERE o.bucket_id = $1%s%s ORDER BY o.name COLLATE "C" DESC LIMIT 1',
                CASE WHEN v_upper_bound IS NOT NULL
                    THEN ' AND o.name COLLATE "C" >= $2 AND o.name COLLATE "C" < $3'
                    ELSE ''
                END,
                v_version_filter
            )
            INTO v_next_seek
            USING _bucket_id, v_prefix, v_upper_bound;

            IF v_next_seek IS NOT NULL THEN
                v_next_seek := v_next_seek || delimiter_param;
            ELSE
                RETURN;
            END IF;
        END IF;
    ELSE
        -- Folder continuation tokens retain their trailing delimiter. A
        -- delimiter-less startAfter is always a literal key boundary.
        v_cursor_is_folder := delimiter_param <> ''
            AND v_start_relative <> ''
            AND right(v_start_relative, length(delimiter_param)) = delimiter_param;

        IF v_cursor_is_folder THEN
            v_next_seek := CASE
                WHEN right(v_start, length(delimiter_param)) = delimiter_param
                    THEN v_start
                ELSE v_start || delimiter_param
            END;
            IF v_is_asc THEN
                v_next_seek := left(v_next_seek, -1)
                    || chr(ascii(right(v_next_seek, 1)) + 1);
            END IF;
            v_next_seek_strict := NOT v_is_asc;
        ELSE
            -- leaf object: when v_multi_row, stay on v_start with the
            -- caller-supplied tiebreak so a page boundary mid-key resumes
            -- that key's remaining rows instead of skipping them. Truncate
            -- to milliseconds like every other v_next_seek_at assignment -
            -- harmless today since object.ts's cursor always round-trips
            -- through JS Date first, but this shouldn't rely on that.
            IF v_multi_row THEN
                v_next_seek := v_start;
                v_next_seek_at := date_trunc('milliseconds', next_token_archived_at);
                v_next_seek_version := coalesce(next_token_version, '');
                v_next_seek_strict := coalesce(next_token, '') = '';
            ELSIF v_is_asc THEN
                v_next_seek := v_start;
                v_next_seek_strict := true;
            ELSE
                v_next_seek := v_start;
            END IF;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= max_keys;

        v_previous_seek := v_next_seek;
        v_previous_seek_at := v_next_seek_at;
        v_previous_seek_version := v_next_seek_version;
        v_previous_count := v_count;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        -- v_multi_row is branched here (rather than folded into the WHERE
        -- clause as a bound parameter) so each concrete query keeps an
        -- unconditional seek predicate - once PL/pgSQL switches to its
        -- cached generic plan (after 5 calls), a parameter-gated
        -- "(NOT v_multi_row AND name >= $x) OR (v_multi_row AND ...)"
        -- predicate stops the planner from using name as an index
        -- condition at all, degrading every subsequent peek to a full
        -- index scan filtered row-by-row instead of a bounded range scan.
        -- v_multi_row's seek predicate is a keyset tuple comparison
        -- ("name > x OR (name = x AND tiebreak)") - Postgres does not
        -- split this OR into indexable form even with fully literal
        -- values, so it falls back to a full scan filtered row-by-row.
        -- Splitting it into two independently-indexable branches (exact
        -- name match with the tiebreak filter, vs. strictly-past name)
        -- combined with UNION ALL lets each branch keep name as a real
        -- index condition; the outer ORDER BY/LIMIT picks whichever of
        -- the (at most 2) rows sorts first.
        IF delete_markers = 'only' THEN
            EXECUTE CASE WHEN v_next_seek_strict AND NOT v_multi_row
                THEN v_delete_marker_peek_query_strict
                ELSE v_delete_marker_peek_query
            END
                INTO v_peek_name
                USING _bucket_id, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END,
                    1, v_next_seek_at, v_next_seek_version, v_next_seek_strict;
        ELSIF v_multi_row THEN
            IF v_is_asc THEN
                IF v_upper_bound IS NOT NULL THEN
                    SELECT sub.name INTO v_peek_name FROM (
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" = v_next_seek
                           AND o.name COLLATE "C" < v_upper_bound
                           AND NOT v_next_seek_strict
                           AND (v_next_seek_at IS NULL
                                OR COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) < v_next_seek_at
                                OR (COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) = v_next_seek_at
                                    AND COALESCE(o.version, '') > v_next_seek_version))
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) DESC, COALESCE(o.version, '') ASC LIMIT 1)
                        UNION ALL
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" > v_next_seek AND o.name COLLATE "C" < v_upper_bound
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY o.name COLLATE "C" ASC LIMIT 1)
                    ) sub ORDER BY sub.name COLLATE "C" ASC LIMIT 1;
                ELSE
                    SELECT sub.name INTO v_peek_name FROM (
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" = v_next_seek
                           AND NOT v_next_seek_strict
                           AND (v_next_seek_at IS NULL
                                OR COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) < v_next_seek_at
                                OR (COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) = v_next_seek_at
                                    AND COALESCE(o.version, '') > v_next_seek_version))
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) DESC, COALESCE(o.version, '') ASC LIMIT 1)
                        UNION ALL
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" > v_next_seek
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY o.name COLLATE "C" ASC LIMIT 1)
                    ) sub ORDER BY sub.name COLLATE "C" ASC LIMIT 1;
                END IF;
            ELSE
                IF v_upper_bound IS NOT NULL THEN
                    SELECT sub.name INTO v_peek_name FROM (
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" = v_next_seek
                           AND o.name COLLATE "C" >= v_prefix
                           AND NOT v_next_seek_strict
                           AND (v_next_seek_at IS NULL
                                OR COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) < v_next_seek_at
                                OR (COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) = v_next_seek_at
                                    AND COALESCE(o.version, '') > v_next_seek_version))
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) DESC, COALESCE(o.version, '') ASC LIMIT 1)
                        UNION ALL
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY o.name COLLATE "C" DESC LIMIT 1)
                    ) sub ORDER BY sub.name COLLATE "C" DESC LIMIT 1;
                ELSE
                    SELECT sub.name INTO v_peek_name FROM (
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" = v_next_seek
                           AND NOT v_next_seek_strict
                           AND (v_next_seek_at IS NULL
                                OR COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) < v_next_seek_at
                                OR (COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) = v_next_seek_at
                                    AND COALESCE(o.version, '') > v_next_seek_version))
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) DESC, COALESCE(o.version, '') ASC LIMIT 1)
                        UNION ALL
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY o.name COLLATE "C" DESC LIMIT 1)
                    ) sub ORDER BY sub.name COLLATE "C" DESC LIMIT 1;
                END IF;
            END IF;
        ELSE
            -- Single-row mode is always noncurrent_versions='exclude'. Keep
            -- this predicate literal so generic plans use the current index.
            IF v_is_asc THEN
                IF v_next_seek_strict AND v_upper_bound IS NOT NULL THEN
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = _bucket_id
                      AND o.name COLLATE "C" > v_next_seek
                      AND o.name COLLATE "C" < v_upper_bound
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                      AND (delete_markers != 'only' OR o.is_delete_marker)
                    ORDER BY o.name COLLATE "C" ASC LIMIT 1;
                ELSIF v_next_seek_strict THEN
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = _bucket_id
                      AND o.name COLLATE "C" > v_next_seek
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                      AND (delete_markers != 'only' OR o.is_delete_marker)
                    ORDER BY o.name COLLATE "C" ASC LIMIT 1;
                ELSIF v_upper_bound IS NOT NULL THEN
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = _bucket_id
                      AND o.name COLLATE "C" >= v_next_seek
                      AND o.name COLLATE "C" < v_upper_bound
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                      AND (delete_markers != 'only' OR o.is_delete_marker)
                    ORDER BY o.name COLLATE "C" ASC LIMIT 1;
                ELSE
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = _bucket_id
                      AND o.name COLLATE "C" >= v_next_seek
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                      AND (delete_markers != 'only' OR o.is_delete_marker)
                    ORDER BY o.name COLLATE "C" ASC LIMIT 1;
                END IF;
            ELSE
                IF v_upper_bound IS NOT NULL THEN
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = _bucket_id
                      AND o.name COLLATE "C" < v_next_seek
                      AND o.name COLLATE "C" >= v_prefix
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                      AND (delete_markers != 'only' OR o.is_delete_marker)
                    ORDER BY o.name COLLATE "C" DESC LIMIT 1;
                ELSE
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = _bucket_id
                      AND o.name COLLATE "C" < v_next_seek
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                      AND (delete_markers != 'only' OR o.is_delete_marker)
                    ORDER BY o.name COLLATE "C" DESC LIMIT 1;
                END IF;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(v_peek_name, v_prefix, delimiter_param);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Emit and skip to next folder (no heap access needed)
            name := v_common_prefix;
            id := NULL;
            updated_at := NULL;
            created_at := NULL;
            last_accessed_at := NULL;
            metadata := NULL;
            version := NULL;
            archived_at := NULL;
            is_delete_marker := NULL;
            is_versioned := NULL;
            RETURN NEXT;
            v_count := v_count + 1;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := left(v_common_prefix, -1)
                    || chr(ascii(right(v_common_prefix, 1)) + 1);
            ELSE
                v_next_seek := v_common_prefix;
            END IF;
            v_next_seek_at := NULL;
            v_next_seek_version := '';
            v_next_seek_strict := NOT v_is_asc;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE CASE WHEN v_next_seek_strict AND NOT v_multi_row THEN v_batch_query_strict ELSE v_batch_query END
                USING _bucket_id, v_next_seek,
                CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END, v_file_batch_size, v_next_seek_at, v_next_seek_version,
                v_next_seek_strict
            LOOP
                v_common_prefix := storage.get_common_prefix(v_current.name, v_prefix, delimiter_param);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it. Reset
                    -- strict mode too it may have been set by an earlier
                    -- row in this same batch (see the single-row ASC advance
                    -- below), and v_next_seek here is the folder-triggering
                    -- row's own name, which the next peek must find inclusively.
                    v_next_seek := CASE
                        WHEN v_is_asc THEN v_current.name
                        ELSE v_current.name || delimiter_param
                    END;
                    v_next_seek_at := NULL;
                    v_next_seek_version := '';
                    v_next_seek_strict := false;
                    EXIT;
                END IF;

                -- Emit file
                name := v_current.name;
                id := v_current.id;
                updated_at := v_current.updated_at;
                created_at := v_current.created_at;
                last_accessed_at := v_current.last_accessed_at;
                metadata := v_current.metadata;
                version := v_current.version;
                archived_at := v_current.archived_at;
                is_delete_marker := v_current.is_delete_marker;
                is_versioned := v_current.is_versioned;
                RETURN NEXT;
                v_count := v_count + 1;

                -- when v_multi_row, stay on this name and record its
                -- archived_at as the new tiebreak so remaining rows for the
                -- same key are picked up before moving to the next name
                IF v_multi_row THEN
                    v_next_seek := v_current.name;
                    v_next_seek_at := COALESCE(date_trunc('milliseconds', v_current.archived_at), 'infinity'::timestamptz);
                    v_next_seek_version := COALESCE(v_current.version, '');
                    v_next_seek_strict := false;
                ELSIF v_is_asc THEN
                    -- Appending the delimiter as a fake lexical successor
                    -- would skip a real key like `name || '!'` (or any
                    -- character sorting below the delimiter), which sorts
                    -- between `name` and `name || delimiter`. Track the real
                    -- name and mark the next comparison strict instead.
                    v_next_seek := v_current.name;
                    v_next_seek_strict := true;
                ELSE
                    v_next_seek := v_current.name;
                END IF;

                EXIT WHEN v_count >= max_keys;
            END LOOP;
        END IF;

        IF v_count = v_previous_count
           AND v_next_seek IS NOT DISTINCT FROM v_previous_seek
           AND v_next_seek_at IS NOT DISTINCT FROM v_previous_seek_at
           AND v_next_seek_version IS NOT DISTINCT FROM v_previous_seek_version THEN
            RAISE EXCEPTION 'storage.list_objects_with_delimiter made no progress at seek (%, %, %)',
                v_next_seek, v_next_seek_at, v_next_seek_version;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


--
-- Name: protect_bucket_control_columns(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.protect_bucket_control_columns() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  configuration_changed boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.lifecycle_configuration IS NOT NULL
       OR NEW.lifecycle_configuration_generation IS NOT NULL THEN
      IF NOT pg_has_role(current_user, TG_ARGV[0], 'MEMBER') THEN
        RAISE EXCEPTION 'only members of the configured storage service role may insert lifecycle policy state'
          USING ERRCODE = '42501',
                HINT = format(
                  'Insert with both lifecycle columns NULL and configure lifecycle through the Storage API afterward, or insert as a member of %I.',
                  TG_ARGV[0]
                );
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  configuration_changed =
    OLD.lifecycle_configuration IS DISTINCT FROM NEW.lifecycle_configuration
    OR OLD.lifecycle_configuration_generation IS DISTINCT FROM NEW.lifecycle_configuration_generation;

  IF NOT configuration_changed THEN
    RETURN NEW;
  END IF;

  IF NEW.type IS DISTINCT FROM 'STANDARD' THEN
    RAISE EXCEPTION 'bucket versioning and lifecycle controls require a Standard bucket'
      USING ERRCODE = '0A000';
  END IF;

  IF NEW.lifecycle_configuration IS NULL
     AND NEW.lifecycle_configuration_generation IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.lifecycle_configuration IS NULL
     OR NEW.lifecycle_configuration_generation IS NULL
     OR OLD.lifecycle_configuration IS NOT DISTINCT FROM NEW.lifecycle_configuration
     OR OLD.lifecycle_configuration_generation IS NOT DISTINCT FROM NEW.lifecycle_configuration_generation THEN
    RAISE EXCEPTION 'a changed lifecycle policy requires a new non-null generation'
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: protect_delete(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.protect_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$$;


--
-- Name: search(text, text, integer, integer, integer, text, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text, noncurrent_versions text DEFAULT 'exclude'::text, delete_markers text DEFAULT 'exclude'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb, version text, archived_at timestamp with time zone, is_delete_marker boolean, is_versioned boolean)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;
    v_delimiter CONSTANT TEXT := '/';

    -- Configuration
    v_limit INT;
    v_prefix TEXT;
    v_prefix_lower TEXT;
    v_prefix_len INT;
    v_prefix_start INT;
    v_combined_levels INT;
    v_is_asc BOOLEAN;
    v_order_by TEXT;
    v_sort_order TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;
    v_version_filter TEXT;
    v_multi_row BOOLEAN;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;
    v_delete_marker_peek_query TEXT;
    v_delete_marker_peek_query_strict TEXT;

    -- Seek state
    v_next_seek TEXT;
    v_next_seek_at TIMESTAMPTZ;
    v_next_seek_version TEXT;
    v_next_seek_strict BOOLEAN := false;
    v_count INT := 0;
    v_skipped INT := 0;
    v_previous_seek TEXT;
    v_previous_seek_at TIMESTAMPTZ;
    v_previous_seek_version TEXT;
    v_previous_count INT;
    v_previous_skipped INT;
BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_limit := LEAST(coalesce(limits, 100), 1500);
    v_prefix := coalesce(prefix, '') || coalesce(search, '');
    v_prefix_lower := lower(v_prefix);
    v_prefix_len := length(coalesce(prefix, ''));
    v_prefix_start := coalesce(array_length(string_to_array(coalesce(prefix, ''), v_delimiter), 1), 1);
    v_combined_levels := coalesce(array_length(string_to_array(v_prefix, v_delimiter), 1), 1);
    v_is_asc := lower(coalesce(sortorder, 'asc')) = 'asc';
    v_file_batch_size := LEAST(GREATEST(v_limit * 2, 100), 1000);
    v_next_seek_at := NULL;
    v_next_seek_version := '';

    -- COALESCE first: NULL NOT IN (...) evaluates to NULL (not TRUE), so a
    -- bare NOT IN check silently leaves an explicit NULL argument unreset.
    noncurrent_versions := COALESCE(noncurrent_versions, 'exclude');
    delete_markers := COALESCE(delete_markers, 'exclude');
    IF noncurrent_versions NOT IN ('exclude', 'only', 'include') THEN
        noncurrent_versions := 'exclude';
    END IF;
    IF delete_markers NOT IN ('exclude', 'only', 'include') THEN
        delete_markers := 'exclude';
    END IF;

    v_multi_row := noncurrent_versions IN ('only', 'include');

    v_version_filter := '';
    IF noncurrent_versions = 'exclude' THEN
        v_version_filter := v_version_filter || ' AND o.archived_at IS NULL';
    ELSIF noncurrent_versions = 'only' THEN
        v_version_filter := v_version_filter || ' AND o.archived_at IS NOT NULL';
    END IF;
    IF delete_markers = 'exclude' THEN
        v_version_filter := v_version_filter || ' AND NOT o.is_delete_marker';
    ELSIF delete_markers = 'only' THEN
        v_version_filter := v_version_filter || ' AND o.is_delete_marker';
    END IF;

    -- Validate sort column
    CASE lower(coalesce(sortcolumn, 'name'))
        WHEN 'name' THEN v_order_by := 'name';
        WHEN 'updated_at' THEN v_order_by := 'updated_at';
        WHEN 'created_at' THEN v_order_by := 'created_at';
        WHEN 'last_accessed_at' THEN v_order_by := 'last_accessed_at';
        ELSE v_order_by := 'name';
    END CASE;

    v_sort_order := CASE WHEN v_is_asc THEN 'asc' ELSE 'desc' END;

    -- ========================================================================
    -- NON-NAME SORTING: Use path_tokens approach
    -- ========================================================================
    IF v_order_by != 'name' THEN
        RETURN QUERY EXECUTE format(
            $sql$
            WITH folders AS (
                SELECT array_to_string(path_tokens[$1:$2], '/') AS folder
                FROM storage.objects
                WHERE objects.name ILIKE $3 || '%%'
                  AND bucket_id = $4
                  AND array_length(objects.path_tokens, 1) <> $2
                  AND ($7 != 'exclude' OR objects.archived_at IS NULL)
                  AND ($7 != 'only' OR objects.archived_at IS NOT NULL)
                  AND ($8 != 'exclude' OR NOT objects.is_delete_marker)
                  AND ($8 != 'only' OR objects.is_delete_marker)
                GROUP BY folder
                ORDER BY folder %s
            )
            (SELECT folder AS "name",
                   NULL::uuid AS id,
                   NULL::timestamptz AS updated_at,
                   NULL::timestamptz AS created_at,
                   NULL::timestamptz AS last_accessed_at,
                   NULL::jsonb AS metadata,
                   NULL::text AS version,
                   NULL::timestamptz AS archived_at,
                   NULL::boolean AS is_delete_marker,
                   NULL::boolean AS is_versioned FROM folders)
            UNION ALL
            (SELECT array_to_string(path_tokens[$1:$2], '/') AS "name",
                   id, updated_at, created_at, last_accessed_at, metadata,
                   version, archived_at, is_delete_marker, is_versioned
             FROM storage.objects
             WHERE objects.name ILIKE $3 || '%%'
               AND bucket_id = $4
               AND array_length(objects.path_tokens, 1) = $2
               AND ($7 != 'exclude' OR objects.archived_at IS NULL)
               AND ($7 != 'only' OR objects.archived_at IS NOT NULL)
               AND ($8 != 'exclude' OR NOT objects.is_delete_marker)
               AND ($8 != 'only' OR objects.is_delete_marker)
             -- name, then version, as tiebreaks so two versions of the same
             -- key tying on the sort column still sort deterministically
             ORDER BY %I %s, name COLLATE "C" %s, COALESCE(version, '') %s)
            LIMIT $5 OFFSET $6
            $sql$, v_sort_order, v_order_by, v_sort_order, v_sort_order, v_sort_order
        ) USING v_prefix_start, v_combined_levels, v_prefix, bucketname, v_limit, offsets, noncurrent_versions, delete_markers;
        RETURN;
    END IF;

    -- ========================================================================
    -- NAME SORTING: Hybrid skip-scan with batch optimization
    -- ========================================================================

    -- Calculate upper bound for prefix filtering
    IF v_prefix_lower = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix_lower, 1) = v_delimiter THEN
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(v_delimiter) + 1);
    ELSE
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(right(v_prefix_lower, 1)) + 1);
    END IF;

    -- Build a resume-safe batch query. The exact-name branch returns remaining
    -- versions after the current (archived_at, version) boundary; the strict
    -- name branch returns subsequent keys. UNION ALL keeps both predicates
    -- independently indexable.
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT * FROM (' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" = $2 AND ($5::timestamptz IS NULL OR COALESCE(o.archived_at, ''infinity''::timestamptz) < $5 OR (COALESCE(o.archived_at, ''infinity''::timestamptz) = $5 AND COALESCE(o.version, '''') > $6))' ||
                v_version_filter || ' ORDER BY COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4) UNION ALL ' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" > $2 AND lower(o.name) COLLATE "C" < $3' || v_version_filter ||
                ' ORDER BY lower(o.name) COLLATE "C" ASC, COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4)' ||
                ') sub ORDER BY lower(sub.name) COLLATE "C" ASC, COALESCE(sub.archived_at, ''infinity''::timestamptz) DESC, COALESCE(sub.version, '''') ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT * FROM (' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" = $2 AND ($5::timestamptz IS NULL OR COALESCE(o.archived_at, ''infinity''::timestamptz) < $5 OR (COALESCE(o.archived_at, ''infinity''::timestamptz) = $5 AND COALESCE(o.version, '''') > $6))' ||
                v_version_filter || ' ORDER BY COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4) UNION ALL ' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" > $2' || v_version_filter ||
                ' ORDER BY lower(o.name) COLLATE "C" ASC, COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4)' ||
                ') sub ORDER BY lower(sub.name) COLLATE "C" ASC, COALESCE(sub.archived_at, ''infinity''::timestamptz) DESC, COALESCE(sub.version, '''') ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT * FROM (' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" = $2 AND ($5::timestamptz IS NULL OR COALESCE(o.archived_at, ''infinity''::timestamptz) < $5 OR (COALESCE(o.archived_at, ''infinity''::timestamptz) = $5 AND COALESCE(o.version, '''') > $6))' ||
                v_version_filter || ' ORDER BY COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4) UNION ALL ' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 AND lower(o.name) COLLATE "C" >= $3' || v_version_filter ||
                ' ORDER BY lower(o.name) COLLATE "C" DESC, COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4)' ||
                ') sub ORDER BY lower(sub.name) COLLATE "C" DESC, COALESCE(sub.archived_at, ''infinity''::timestamptz) DESC, COALESCE(sub.version, '''') ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT * FROM (' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" = $2 AND ($5::timestamptz IS NULL OR COALESCE(o.archived_at, ''infinity''::timestamptz) < $5 OR (COALESCE(o.archived_at, ''infinity''::timestamptz) = $5 AND COALESCE(o.version, '''') > $6))' ||
                v_version_filter || ' ORDER BY COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4) UNION ALL ' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2' || v_version_filter ||
                ' ORDER BY lower(o.name) COLLATE "C" DESC, COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4)' ||
                ') sub ORDER BY lower(sub.name) COLLATE "C" DESC, COALESCE(sub.archived_at, ''infinity''::timestamptz) DESC, COALESCE(sub.version, '''') ASC LIMIT $4';
        END IF;
    END IF;

    -- Keep the delete-marker predicate literal so the cached generic
    -- plan can use idx_objects_delete_markers during the main-loop peek.
    IF delete_markers = 'only' THEN
        IF v_multi_row THEN
            v_delete_marker_peek_query :=
                'SELECT marker_page.name FROM (' || v_batch_query || ') marker_page LIMIT 1';
        ELSIF v_is_asc THEN
            -- Two separate literal query strings, not one gated by a bound
            -- boolean: folding "$n AND op1 OR NOT $n AND op2" into a single
            -- query defeats the generic plan's ability to push either
            -- comparison into the index. Branching in PL/pgSQL control flow
            -- instead keeps each query's index condition intact.
            v_delete_marker_peek_query :=
                'SELECT o.name FROM storage.objects o WHERE o.bucket_id = $1 ' ||
                'AND lower(o.name) COLLATE "C" >= $2' ||
                CASE WHEN v_upper_bound IS NOT NULL
                    THEN ' AND lower(o.name) COLLATE "C" < $3'
                    ELSE ''
                END ||
                v_version_filter ||
                ' ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1';
            -- Strict variant: used once the single-row ASC batch advance
            -- (below) has left v_next_seek pointing at the last row already
            -- emitted, so a plain >= would re-match it forever.
            v_delete_marker_peek_query_strict :=
                'SELECT o.name FROM storage.objects o WHERE o.bucket_id = $1 ' ||
                'AND lower(o.name) COLLATE "C" > $2' ||
                CASE WHEN v_upper_bound IS NOT NULL
                    THEN ' AND lower(o.name) COLLATE "C" < $3'
                    ELSE ''
                END ||
                v_version_filter ||
                ' ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1';
        ELSE
            v_delete_marker_peek_query :=
                'SELECT o.name FROM storage.objects o WHERE o.bucket_id = $1 ' ||
                'AND lower(o.name) COLLATE "C" < $2' ||
                CASE WHEN v_upper_bound IS NOT NULL
                    THEN ' AND lower(o.name) COLLATE "C" >= $3'
                    ELSE ''
                END ||
                v_version_filter ||
                ' ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1';
        END IF;
    END IF;

    -- Initialize seek position
    IF v_is_asc THEN
        v_next_seek := v_prefix_lower;
    ELSE
        -- DESC performs one specialized initial seek so partial current-version
        -- and delete-marker indexes remain available.
        EXECUTE format(
            'SELECT o.name FROM storage.objects o WHERE o.bucket_id = $1%s%s ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1',
            CASE WHEN v_upper_bound IS NOT NULL
                THEN ' AND lower(o.name) COLLATE "C" >= $2 AND lower(o.name) COLLATE "C" < $3'
                ELSE ''
            END,
            v_version_filter
        )
        INTO v_peek_name
        USING bucketname, v_prefix_lower, v_upper_bound;

        IF v_peek_name IS NOT NULL THEN
            v_next_seek := lower(v_peek_name) || v_delimiter;
        ELSE
            RETURN;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch and
    -- the delete-marker-only path
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= v_limit;

        v_previous_seek := v_next_seek;
        v_previous_seek_at := v_next_seek_at;
        v_previous_seek_version := v_next_seek_version;
        v_previous_count := v_count;
        v_previous_skipped := v_skipped;

        -- STEP 1: PEEK
        v_peek_name := NULL;
        IF delete_markers = 'only' THEN
            EXECUTE CASE WHEN v_next_seek_strict
                THEN v_delete_marker_peek_query_strict
                ELSE v_delete_marker_peek_query
            END
                INTO v_peek_name
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END,
                    1, v_next_seek_at, v_next_seek_version;
        ELSIF v_multi_row AND v_next_seek_at IS NOT NULL THEN
            SELECT o.name INTO v_peek_name
            FROM storage.objects o
            WHERE o.bucket_id = bucketname
              AND lower(o.name) COLLATE "C" = v_next_seek
              AND (COALESCE(o.archived_at, 'infinity'::timestamptz) < v_next_seek_at
                   OR (COALESCE(o.archived_at, 'infinity'::timestamptz) = v_next_seek_at
                       AND COALESCE(o.version, '') > v_next_seek_version))
              AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
              AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
              AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
              AND (delete_markers != 'only' OR o.is_delete_marker)
            ORDER BY COALESCE(o.archived_at, 'infinity'::timestamptz) DESC,
                     COALESCE(o.version, '') ASC
            LIMIT 1;

            -- The current key is exhausted. Clear its version boundary and
            -- make the following ASC name peek strict. Appending '/' is not a
            -- valid lexical successor because keys ending in characters such
            -- as '!' sort between the exhausted name and name || '/'.
            IF v_peek_name IS NULL THEN
                IF v_is_asc THEN
                    v_next_seek_strict := true;
                END IF;
                v_next_seek_at := NULL;
                v_next_seek_version := '';
            END IF;
        END IF;

        -- Single-row mode is always noncurrent_versions='exclude'. Keep the
        -- current-row predicate literal so generic plans use the current index.
        IF delete_markers != 'only' AND v_peek_name IS NULL AND NOT v_multi_row THEN
            IF v_is_asc THEN
                IF v_next_seek_strict AND v_upper_bound IS NOT NULL THEN
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" > v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                    ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
                ELSIF v_next_seek_strict THEN
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" > v_next_seek
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                    ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
                ELSIF v_upper_bound IS NOT NULL THEN
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                    ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
                ELSE
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                    ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
                END IF;
            ELSIF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                  AND o.archived_at IS NULL
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                  AND o.archived_at IS NULL
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        ELSIF delete_markers != 'only' AND v_peek_name IS NULL AND v_is_asc THEN
            IF v_next_seek_strict AND v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" > v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                  AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                  AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                  AND (delete_markers != 'only' OR o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSIF v_next_seek_strict THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" > v_next_seek
                  AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                  AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                  AND (delete_markers != 'only' OR o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSIF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                  AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                  AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                  AND (delete_markers != 'only' OR o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                  AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                  AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                  AND (delete_markers != 'only' OR o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSIF delete_markers != 'only' AND v_peek_name IS NULL THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                  AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                  AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                  AND (delete_markers != 'only' OR o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                  AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                  AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                  AND (delete_markers != 'only' OR o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- If the peek landed on a different key than we were tracking, any
        -- version boundary belongs to the OLD key and must not leak into the
        -- new one - e.g. the deleteMarkers='only' peek doesn't know or care
        -- whether it's continuing the same key or jumping to a new one, so
        -- it never clears these itself.
        IF lower(v_peek_name) IS DISTINCT FROM v_next_seek THEN
            v_next_seek_at := NULL;
            v_next_seek_version := '';
        END IF;

        -- The peek is authoritative for the next key to process. This is
        -- especially important after exhausting a multi-version key: the
        -- version boundary has been cleared, so executing the batch against
        -- a stale v_next_seek would replay every version of that old key.
        v_next_seek := lower(v_peek_name);
        v_next_seek_strict := false;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(lower(v_peek_name), v_prefix_lower, v_delimiter);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Handle offset, emit if needed, skip to next folder
            IF v_skipped < offsets THEN
                v_skipped := v_skipped + 1;
            ELSE
                name := substring(rtrim(storage.get_common_prefix(v_peek_name, v_prefix, v_delimiter), v_delimiter) from v_prefix_len + 1);
                id := NULL;
                updated_at := NULL;
                created_at := NULL;
                last_accessed_at := NULL;
                metadata := NULL;
                version := NULL;
                archived_at := NULL;
                is_delete_marker := NULL;
                is_versioned := NULL;
                RETURN NEXT;
                v_count := v_count + 1;
            END IF;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := lower(left(v_common_prefix, -1)) || chr(ascii(v_delimiter) + 1);
            ELSE
                v_next_seek := lower(v_common_prefix);
            END IF;
            v_next_seek_at := NULL;
            v_next_seek_version := '';
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix_lower is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END, v_file_batch_size,
                    v_next_seek_at, v_next_seek_version
            LOOP
                v_common_prefix := storage.get_common_prefix(lower(v_current.name), v_prefix_lower, v_delimiter);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it. Reset
                    -- strict mode too - it may have been set by an earlier
                    -- row in this same batch (see the single-row ASC advance
                    -- below), and v_next_seek here is the folder-triggering
                    -- row's own name, which the next peek must find inclusively.
                    v_next_seek := CASE
                        WHEN v_is_asc THEN lower(v_current.name)
                        ELSE lower(v_current.name) || v_delimiter
                    END;
                    v_next_seek_at := NULL;
                    v_next_seek_version := '';
                    v_next_seek_strict := false;
                    EXIT;
                END IF;

                -- Handle offset skipping
                IF v_skipped < offsets THEN
                    v_skipped := v_skipped + 1;
                ELSE
                    -- Emit file
                    name := substring(v_current.name from v_prefix_len + 1);
                    id := v_current.id;
                    updated_at := v_current.updated_at;
                    created_at := v_current.created_at;
                    last_accessed_at := v_current.last_accessed_at;
                    metadata := v_current.metadata;
                    version := v_current.version;
                    archived_at := v_current.archived_at;
                    is_delete_marker := v_current.is_delete_marker;
                    is_versioned := v_current.is_versioned;
                    RETURN NEXT;
                    v_count := v_count + 1;
                END IF;

                -- Multi-row mode must remain on this key until all of its
                -- versions have crossed the internal batch boundary.
                IF v_multi_row THEN
                    v_next_seek := lower(v_current.name);
                    v_next_seek_at := COALESCE(v_current.archived_at, 'infinity'::timestamptz);
                    v_next_seek_version := COALESCE(v_current.version, '');
                ELSIF v_is_asc THEN
                    -- Appending the delimiter as a fake lexical successor would
                    -- skip a real key like `name || '!'` (or any character
                    -- sorting below the delimiter), which sorts between `name`
                    -- and `name || delimiter`. Track the real name and mark the
                    -- next comparison strict instead - same fix as the
                    -- exhausted-key case above.
                    v_next_seek := lower(v_current.name);
                    v_next_seek_strict := true;
                ELSE
                    v_next_seek := lower(v_current.name);
                END IF;

                EXIT WHEN v_count >= v_limit;
            END LOOP;
        END IF;

        IF v_count = v_previous_count
           AND v_skipped = v_previous_skipped
           AND v_next_seek IS NOT DISTINCT FROM v_previous_seek
           AND v_next_seek_at IS NOT DISTINCT FROM v_previous_seek_at
           AND v_next_seek_version IS NOT DISTINCT FROM v_previous_seek_version THEN
            RAISE EXCEPTION 'storage.search made no progress at seek (%, %, %)',
                v_next_seek, v_next_seek_at, v_next_seek_version;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: search_by_timestamp(text, text, integer, integer, text, text, text, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_by_timestamp(p_prefix text, p_bucket_id text, p_limit integer, p_level integer, p_start_after text, p_sort_order text, p_sort_column text, p_sort_column_after text, noncurrent_versions text DEFAULT 'exclude'::text, delete_markers text DEFAULT 'exclude'::text, p_start_after_version text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb, version text, archived_at timestamp with time zone, is_delete_marker boolean, is_versioned boolean)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_cursor_op text;
    v_query text;
    v_prefix text;
    v_prefix_pattern text;
    v_sort_order text;
    v_sort_column text;
    v_version_tiebreak text;
BEGIN
    v_prefix := coalesce(p_prefix, '');
    -- Keep the raw prefix for common-prefix calculations and escape only LIKE metacharacters.
    v_prefix_pattern := replace(v_prefix, chr(92), chr(92) || chr(92));
    v_prefix_pattern := replace(v_prefix_pattern, '%', chr(92) || '%');
    v_prefix_pattern := replace(v_prefix_pattern, '_', chr(92) || '_');

    -- COALESCE first: NULL NOT IN (...) evaluates to NULL (not TRUE), so a
    -- bare NOT IN check silently leaves an explicit NULL argument unreset.
    noncurrent_versions := COALESCE(noncurrent_versions, 'exclude');
    delete_markers := COALESCE(delete_markers, 'exclude');
    IF noncurrent_versions NOT IN ('exclude', 'only', 'include') THEN
        noncurrent_versions := 'exclude';
    END IF;
    IF delete_markers NOT IN ('exclude', 'only', 'include') THEN
        delete_markers := 'exclude';
    END IF;

    -- $9 is only populated in multi-row mode; it's always '' otherwise, so
    -- only use each row's real version as a tiebreak in multi-row mode.
    v_version_tiebreak := CASE WHEN noncurrent_versions IN ('only', 'include') THEN 'COALESCE(version, '''')' ELSE '''''' END;

    -- Defense-in-depth: this function is independently reachable and must
    -- not trust p_sort_order/p_sort_column to already be validated by a
    -- caller. Normalize to the same strict allow-list storage.search_v2
    -- uses before interpolating anything into dynamic SQL below.
    v_sort_order := lower(coalesce(p_sort_order, 'asc'));
    IF v_sort_order NOT IN ('asc', 'desc') THEN
        v_sort_order := 'asc';
    END IF;

    v_sort_column := lower(coalesce(p_sort_column, 'updated_at'));
    IF v_sort_column NOT IN ('updated_at', 'created_at') THEN
        v_sort_column := 'updated_at';
    END IF;

    IF v_sort_order = 'asc' THEN
        v_cursor_op := '>';
    ELSE
        v_cursor_op := '<';
    END IF;

    v_query := format($sql$
        WITH raw_objects AS (
            SELECT
                o.name AS obj_name,
                o.id AS obj_id,
                o.updated_at AS obj_updated_at,
                o.created_at AS obj_created_at,
                o.last_accessed_at AS obj_last_accessed_at,
                o.metadata AS obj_metadata,
                o.version AS obj_version,
                o.archived_at AS obj_archived_at,
                o.is_delete_marker AS obj_is_delete_marker,
                o.is_versioned AS obj_is_versioned,
                storage.get_common_prefix(o.name, $1, '/') AS common_prefix
            FROM storage.objects o
            WHERE o.bucket_id = $2
              AND o.name COLLATE "C" LIKE $10 || '%%'
              AND ($7 != 'exclude' OR o.archived_at IS NULL)
              AND ($7 != 'only' OR o.archived_at IS NOT NULL)
              AND ($8 != 'exclude' OR NOT o.is_delete_marker)
              AND ($8 != 'only' OR o.is_delete_marker)
        ),
        -- Aggregate common prefixes (folders)
        -- Both created_at and updated_at use MIN(obj_created_at) to match the old prefixes table behavior
        aggregated_prefixes AS (
            SELECT
                common_prefix AS name,
                NULL::uuid AS id,
                MIN(obj_created_at) AS updated_at,
                MIN(obj_created_at) AS created_at,
                NULL::timestamptz AS last_accessed_at,
                NULL::jsonb AS metadata,
                NULL::text AS version,
                NULL::timestamptz AS archived_at,
                NULL::boolean AS is_delete_marker,
                NULL::boolean AS is_versioned,
                TRUE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NOT NULL
            GROUP BY common_prefix
        ),
        leaf_objects AS (
            SELECT
                obj_name AS name,
                obj_id AS id,
                obj_updated_at AS updated_at,
                obj_created_at AS created_at,
                obj_last_accessed_at AS last_accessed_at,
                obj_metadata AS metadata,
                obj_version AS version,
                obj_archived_at AS archived_at,
                obj_is_delete_marker AS is_delete_marker,
                obj_is_versioned AS is_versioned,
                FALSE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NULL
        ),
        combined AS (
            SELECT * FROM aggregated_prefixes
            UNION ALL
            SELECT * FROM leaf_objects
        ),
        filtered AS (
            SELECT *
            FROM combined
            WHERE (
                $5 = ''
                OR ROW(
                    COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz),
                    name COLLATE "C",
                    %s
                ) %s ROW(
                    -- truncated the same way as the stored value above
                    date_trunc('milliseconds', COALESCE(NULLIF($6, '')::timestamptz, 'epoch'::timestamptz)),
                    $5,
                    $9
                )
            )
        )
        SELECT
            split_part(name, '/', $3) AS key,
            name,
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata,
            version,
            archived_at,
            is_delete_marker,
            is_versioned
        FROM filtered
        ORDER BY
            COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz) %s,
            name COLLATE "C" %s,
            COALESCE(version, '') %s
        LIMIT $4
    $sql$,
        v_sort_column,
        v_version_tiebreak,
        v_cursor_op,
        v_sort_column,
        v_sort_order,
        v_sort_order,
        v_sort_order
    );

    -- version is the third tiebreak component for two versions of the same
    -- key tying on both timestamp and name (see filtered CTE / ORDER BY above)
    RETURN QUERY EXECUTE v_query
    USING v_prefix, p_bucket_id, p_level, p_limit, p_start_after, p_sort_column_after, noncurrent_versions, delete_markers, coalesce(p_start_after_version, ''), v_prefix_pattern;
END;
$_$;


--
-- Name: search_v2(text, text, integer, integer, text, text, text, text, text, text, timestamp with time zone, text, boolean); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text, noncurrent_versions text DEFAULT 'exclude'::text, delete_markers text DEFAULT 'exclude'::text, start_after_archived_at timestamp with time zone DEFAULT NULL::timestamp with time zone, start_after_version text DEFAULT ''::text, start_after_is_continuation boolean DEFAULT false) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb, version text, archived_at timestamp with time zone, is_delete_marker boolean, is_versioned boolean)
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_sort_col text;
    v_sort_ord text;
    v_limit int;
BEGIN
    -- Cap limit to maximum of 1500 records
    v_limit := LEAST(coalesce(limits, 100), 1500);

    -- Validate and normalize sort_order
    v_sort_ord := lower(coalesce(sort_order, 'asc'));
    IF v_sort_ord NOT IN ('asc', 'desc') THEN
        v_sort_ord := 'asc';
    END IF;

    -- Validate and normalize sort_column
    v_sort_col := lower(coalesce(sort_column, 'name'));
    IF v_sort_col NOT IN ('name', 'updated_at', 'created_at') THEN
        v_sort_col := 'name';
    END IF;

    -- Route to appropriate implementation
    IF v_sort_col = 'name' THEN
        -- Use list_objects_with_delimiter for name sorting (most efficient: O(k * log n))
        RETURN QUERY
        SELECT
            split_part(l.name, '/', levels) AS key,
            l.name AS name,
            l.id,
            l.updated_at,
            l.created_at,
            l.last_accessed_at,
            l.metadata,
            l.version,
            l.archived_at,
            l.is_delete_marker,
            l.is_versioned
        FROM storage.list_objects_with_delimiter(
            bucket_name,
            coalesce(prefix, ''),
            '/',
            v_limit,
            CASE WHEN start_after_is_continuation THEN '' ELSE start_after END,
            CASE WHEN start_after_is_continuation THEN start_after ELSE '' END,
            v_sort_ord,
            noncurrent_versions,
            delete_markers,
            start_after_archived_at,
            start_after_version
        ) l;
    ELSE
        -- Use aggregation approach for timestamp sorting
        -- Not efficient for large datasets but supports correct pagination
        RETURN QUERY SELECT * FROM storage.search_by_timestamp(
            prefix, bucket_name, v_limit, levels, start_after,
            v_sort_ord, v_sort_col, sort_column_after,
            noncurrent_versions, delete_markers, start_after_version
        );
    END IF;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: custom_oauth_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.custom_oauth_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_type text NOT NULL,
    identifier text NOT NULL,
    name text NOT NULL,
    client_id text NOT NULL,
    client_secret text NOT NULL,
    acceptable_client_ids text[] DEFAULT '{}'::text[] NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    pkce_enabled boolean DEFAULT true NOT NULL,
    attribute_mapping jsonb DEFAULT '{}'::jsonb NOT NULL,
    authorization_params jsonb DEFAULT '{}'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    email_optional boolean DEFAULT false NOT NULL,
    issuer text,
    discovery_url text,
    skip_nonce_check boolean DEFAULT false NOT NULL,
    cached_discovery jsonb,
    discovery_cached_at timestamp with time zone,
    authorization_url text,
    token_url text,
    userinfo_url text,
    jwks_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    custom_claims_allowlist text[] DEFAULT '{}'::text[] NOT NULL,
    CONSTRAINT custom_oauth_providers_authorization_url_https CHECK (((authorization_url IS NULL) OR (authorization_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_authorization_url_length CHECK (((authorization_url IS NULL) OR (char_length(authorization_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_client_id_length CHECK (((char_length(client_id) >= 1) AND (char_length(client_id) <= 512))),
    CONSTRAINT custom_oauth_providers_discovery_url_length CHECK (((discovery_url IS NULL) OR (char_length(discovery_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_identifier_format CHECK ((identifier ~ '^[a-z0-9][a-z0-9:-]{0,48}[a-z0-9]$'::text)),
    CONSTRAINT custom_oauth_providers_issuer_length CHECK (((issuer IS NULL) OR ((char_length(issuer) >= 1) AND (char_length(issuer) <= 2048)))),
    CONSTRAINT custom_oauth_providers_jwks_uri_https CHECK (((jwks_uri IS NULL) OR (jwks_uri ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_jwks_uri_length CHECK (((jwks_uri IS NULL) OR (char_length(jwks_uri) <= 2048))),
    CONSTRAINT custom_oauth_providers_name_length CHECK (((char_length(name) >= 1) AND (char_length(name) <= 100))),
    CONSTRAINT custom_oauth_providers_oauth2_requires_endpoints CHECK (((provider_type <> 'oauth2'::text) OR ((authorization_url IS NOT NULL) AND (token_url IS NOT NULL) AND (userinfo_url IS NOT NULL)))),
    CONSTRAINT custom_oauth_providers_oidc_discovery_url_https CHECK (((provider_type <> 'oidc'::text) OR (discovery_url IS NULL) OR (discovery_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_issuer_https CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NULL) OR (issuer ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_requires_issuer CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NOT NULL))),
    CONSTRAINT custom_oauth_providers_provider_type_check CHECK ((provider_type = ANY (ARRAY['oauth2'::text, 'oidc'::text]))),
    CONSTRAINT custom_oauth_providers_token_url_https CHECK (((token_url IS NULL) OR (token_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_token_url_length CHECK (((token_url IS NULL) OR (char_length(token_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_userinfo_url_https CHECK (((userinfo_url IS NULL) OR (userinfo_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_userinfo_url_length CHECK (((userinfo_url IS NULL) OR (char_length(userinfo_url) <= 2048)))
);


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text,
    code_challenge_method auth.code_challenge_method,
    code_challenge text,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone,
    invite_token text,
    referrer text,
    oauth_client_state_id uuid,
    linking_target_id uuid,
    email_optional boolean DEFAULT false NOT NULL
);


--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.flow_state IS 'Stores metadata for all OAuth/SSO login flows';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid,
    last_webauthn_challenge_data jsonb
);


--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: COLUMN mfa_factors.last_webauthn_challenge_data; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.mfa_factors.last_webauthn_challenge_data IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- Name: mfa_recovery_code_sets; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_recovery_code_sets (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    mfa_factor_id uuid NOT NULL,
    failed_verification_count integer DEFAULT 0 NOT NULL,
    verification_locked_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mfa_recovery_code_sets_failed_verification_count_check CHECK ((failed_verification_count >= 0))
);


--
-- Name: mfa_recovery_codes; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_recovery_codes (
    id uuid NOT NULL,
    mfa_recovery_code_set_id uuid NOT NULL,
    code_hash text NOT NULL,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_authorizations (
    id uuid NOT NULL,
    authorization_id text NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    redirect_uri text NOT NULL,
    scope text NOT NULL,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method auth.code_challenge_method,
    response_type auth.oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
    status auth.oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL,
    authorization_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    nonce text,
    CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255)),
    CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128)),
    CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at)),
    CONSTRAINT oauth_authorizations_nonce_length CHECK ((char_length(nonce) <= 255)),
    CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048)),
    CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048)),
    CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096)),
    CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096))
);


--
-- Name: oauth_client_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_client_states (
    id uuid NOT NULL,
    provider_type text NOT NULL,
    code_verifier text,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: TABLE oauth_client_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.oauth_client_states IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_secret_hash text,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type auth.oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
    token_endpoint_auth_method text NOT NULL,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048)),
    CONSTRAINT oauth_clients_token_endpoint_auth_method_check CHECK ((token_endpoint_auth_method = ANY (ARRAY['client_secret_basic'::text, 'client_secret_post'::text, 'none'::text])))
);


--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    scopes text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))),
    CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048)),
    CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
);


--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: -
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.schema_migrations (
    version character varying(14) NOT NULL
);


--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: scim_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.scim_tokens (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    token_hash text NOT NULL,
    prefix text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    revoked_at timestamp with time zone,
    last_used_at timestamp with time zone,
    CONSTRAINT scim_tokens_expires_at_future CHECK (((expires_at IS NULL) OR (expires_at > created_at))),
    CONSTRAINT scim_tokens_revoked_after_created CHECK (((revoked_at IS NULL) OR (revoked_at >= created_at))),
    CONSTRAINT scim_tokens_token_hash_check CHECK ((token_hash ~ '^[0-9a-f]{64}$'::text))
);


--
-- Name: scim_users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.scim_users (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    user_id uuid,
    resource jsonb NOT NULL,
    user_name text GENERATED ALWAYS AS (lower((resource ->> 'userName'::text))) STORED NOT NULL,
    external_id text GENERATED ALWAYS AS ((resource ->> 'externalId'::text)) STORED,
    active boolean GENERATED ALWAYS AS (COALESCE(((resource ->> 'active'::text))::boolean, true)) STORED NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid,
    refresh_token_hmac_key text,
    refresh_token_counter bigint,
    scopes text,
    CONSTRAINT sessions_scopes_length CHECK ((char_length(scopes) <= 4096))
);


--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: COLUMN sessions.refresh_token_hmac_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_hmac_key IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- Name: COLUMN sessions.refresh_token_counter; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_counter IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: webauthn_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.webauthn_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    challenge_type text NOT NULL,
    session_data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT webauthn_challenges_challenge_type_check CHECK ((challenge_type = ANY (ARRAY['signup'::text, 'registration'::text, 'authentication'::text])))
);


--
-- Name: webauthn_credentials; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.webauthn_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    credential_id bytea NOT NULL,
    public_key bytea NOT NULL,
    attestation_type text DEFAULT ''::text NOT NULL,
    aaguid uuid,
    sign_count bigint DEFAULT 0 NOT NULL,
    transports jsonb DEFAULT '[]'::jsonb NOT NULL,
    backup_eligible boolean DEFAULT false NOT NULL,
    backed_up boolean DEFAULT false NOT NULL,
    friendly_name text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone
);


--
-- Name: catalog_exclusions; Type: TABLE; Schema: meryo_private; Owner: -
--

CREATE TABLE meryo_private.catalog_exclusions (
    barberia_id bigint NOT NULL,
    active boolean DEFAULT true NOT NULL,
    reason text NOT NULL,
    evidence text NOT NULL,
    confirmed_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);


--
-- Name: launch_settings; Type: TABLE; Schema: meryo_private; Owner: -
--

CREATE TABLE meryo_private.launch_settings (
    id integer NOT NULL,
    reservas_habilitadas boolean DEFAULT false NOT NULL,
    plazo_pago_segundos integer,
    comision_centimos integer,
    criterio_comision text,
    politica_cancelacion jsonb,
    politica_devolucion jsonb,
    politica_liquidacion jsonb,
    entorno text DEFAULT 'disabled'::text NOT NULL,
    modelo_comercial text DEFAULT 'mensualidad'::text NOT NULL,
    precios_planes_propuestos jsonb,
    push_public_key text,
    push_envio_habilitado boolean DEFAULT false NOT NULL,
    pagos_habilitados boolean DEFAULT false NOT NULL,
    CONSTRAINT launch_settings_comision_centimos_check CHECK ((comision_centimos = ANY (ARRAY[100, 200]))),
    CONSTRAINT launch_settings_entorno_check CHECK ((entorno = ANY (ARRAY['disabled'::text, 'staging'::text, 'production'::text]))),
    CONSTRAINT launch_settings_id_check CHECK ((id = 1)),
    CONSTRAINT launch_settings_modelo_comercial_check CHECK ((modelo_comercial = 'mensualidad'::text)),
    CONSTRAINT launch_settings_plazo_pago_segundos_check CHECK (((plazo_pago_segundos >= 60) AND (plazo_pago_segundos <= 1800)))
);


--
-- Name: payment_intents; Type: TABLE; Schema: meryo_private; Owner: -
--

CREATE TABLE meryo_private.payment_intents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reserva_id uuid NOT NULL,
    proveedor text NOT NULL,
    referencia text NOT NULL,
    merchant_id text NOT NULL,
    monto_centimos bigint NOT NULL,
    moneda text NOT NULL,
    live boolean NOT NULL,
    metodo text NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT payment_intents_merchant_id_check CHECK (((length(merchant_id) >= 1) AND (length(merchant_id) <= 200))),
    CONSTRAINT payment_intents_metodo_check CHECK ((metodo = ANY (ARRAY['tarjeta'::text, 'yape'::text, 'plin'::text]))),
    CONSTRAINT payment_intents_moneda_check CHECK ((moneda = 'PEN'::text)),
    CONSTRAINT payment_intents_monto_centimos_check CHECK ((monto_centimos > 0)),
    CONSTRAINT payment_intents_proveedor_check CHECK (((length(proveedor) >= 1) AND (length(proveedor) <= 80))),
    CONSTRAINT payment_intents_referencia_check CHECK (((length(referencia) >= 1) AND (length(referencia) <= 200)))
);


--
-- Name: payment_receipts; Type: TABLE; Schema: meryo_private; Owner: -
--

CREATE TABLE meryo_private.payment_receipts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    intent_id uuid NOT NULL,
    resultado text NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT payment_receipts_resultado_check CHECK ((resultado = ANY (ARRAY['confirmada'::text, 'requiere_conciliacion'::text])))
);


--
-- Name: push_deliveries; Type: TABLE; Schema: meryo_private; Owner: -
--

CREATE TABLE meryo_private.push_deliveries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    outbox_id bigint NOT NULL,
    endpoint_hash text NOT NULL,
    ack_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    provider_accepted_at timestamp with time zone,
    received_at timestamp with time zone
);


--
-- Name: push_outbox; Type: TABLE; Schema: meryo_private; Owner: -
--

CREATE TABLE meryo_private.push_outbox (
    id bigint NOT NULL,
    notification_id bigint NOT NULL,
    user_id uuid NOT NULL,
    event text NOT NULL,
    reserva_id uuid,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    status text DEFAULT 'pending_provider'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    lease_until timestamp with time zone,
    lease_token uuid,
    available_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    provider_accepted_at timestamp with time zone,
    CONSTRAINT push_outbox_status_check CHECK ((status = ANY (ARRAY['pending_provider'::text, 'queued'::text, 'leased'::text, 'accepted'::text, 'expired'::text, 'failed'::text])))
);


--
-- Name: push_outbox_id_seq; Type: SEQUENCE; Schema: meryo_private; Owner: -
--

ALTER TABLE meryo_private.push_outbox ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME meryo_private.push_outbox_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: push_subscriptions; Type: TABLE; Schema: meryo_private; Owner: -
--

CREATE TABLE meryo_private.push_subscriptions (
    endpoint text NOT NULL,
    user_id uuid NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    updated_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT push_subscriptions_endpoint_check CHECK (((endpoint ~ '^https://'::text) AND (length(endpoint) <= 2048)))
);


--
-- Name: reservation_events; Type: TABLE; Schema: meryo_private; Owner: -
--

CREATE TABLE meryo_private.reservation_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reserva_id uuid NOT NULL,
    actor_id uuid,
    action text NOT NULL,
    before_data jsonb,
    after_data jsonb,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);


--
-- Name: shop_content_settings; Type: TABLE; Schema: meryo_private; Owner: -
--

CREATE TABLE meryo_private.shop_content_settings (
    id integer NOT NULL,
    uploads_enabled boolean DEFAULT false NOT NULL,
    CONSTRAINT shop_content_settings_id_check CHECK ((id = 1))
);


--
-- Name: shop_events; Type: TABLE; Schema: meryo_private; Owner: -
--

CREATE TABLE meryo_private.shop_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    barberia_id bigint NOT NULL,
    actor_id uuid,
    action text NOT NULL,
    reason text,
    before_data jsonb,
    after_data jsonb,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);


--
-- Name: shop_owners; Type: TABLE; Schema: meryo_private; Owner: -
--

CREATE TABLE meryo_private.shop_owners (
    barberia_id bigint NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: team_invites; Type: TABLE; Schema: meryo_private; Owner: -
--

CREATE TABLE meryo_private.team_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    barberia_id bigint NOT NULL,
    email text NOT NULL,
    display_name text NOT NULL,
    token_hash text NOT NULL,
    created_by uuid NOT NULL,
    expires_at timestamp with time zone DEFAULT (clock_timestamp() + '7 days'::interval) NOT NULL,
    status text DEFAULT 'pendiente'::text NOT NULL,
    accepted_by uuid,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT team_invites_status_check CHECK ((status = ANY (ARRAY['pendiente'::text, 'aceptada'::text, 'revocada'::text])))
);


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

ALTER TABLE public.barberia_media ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
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

ALTER TABLE public.barberias ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
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

ALTER TABLE public.bloqueos ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
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

ALTER TABLE public.horarios ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.horarios_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: meryo_native_bootstrap; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meryo_native_bootstrap (
    version integer NOT NULL
);


--
-- Name: meryo_shop_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meryo_shop_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    barberia_id bigint NOT NULL,
    kind text NOT NULL,
    object_path text NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    mime text NOT NULL,
    bytes bigint NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    retired_at timestamp with time zone,
    CONSTRAINT meryo_shop_assets_bytes_check CHECK (((bytes > 0) AND (bytes <= 20971520))),
    CONSTRAINT meryo_shop_assets_kind_check CHECK ((kind = ANY (ARRAY['portada'::text, 'foto'::text, 'video'::text]))),
    CONSTRAINT meryo_shop_assets_object_path_check CHECK ((object_path ~ '^[0-9]+/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|mp4|webm)$'::text)),
    CONSTRAINT meryo_shop_assets_title_check CHECK ((length(title) <= 100))
);


--
-- Name: meryo_team_blocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meryo_team_blocks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    member_id uuid NOT NULL,
    starts timestamp with time zone NOT NULL,
    ends timestamp with time zone NOT NULL,
    reason text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT meryo_team_blocks_check CHECK ((ends > starts)),
    CONSTRAINT meryo_team_blocks_reason_check CHECK (((length(reason) >= 3) AND (length(reason) <= 300)))
);


--
-- Name: meryo_team_hours; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meryo_team_hours (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    member_id uuid NOT NULL,
    day integer NOT NULL,
    kind text NOT NULL,
    starts time without time zone NOT NULL,
    ends time without time zone NOT NULL,
    active boolean DEFAULT true NOT NULL,
    legacy_hour_id bigint,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT meryo_team_hours_check CHECK ((ends > starts)),
    CONSTRAINT meryo_team_hours_day_check CHECK (((day >= 0) AND (day <= 6))),
    CONSTRAINT meryo_team_hours_kind_check CHECK ((kind = ANY (ARRAY['jornada'::text, 'descanso'::text])))
);


--
-- Name: meryo_team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meryo_team_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    barberia_id bigint NOT NULL,
    user_id uuid NOT NULL,
    display_name text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT meryo_team_members_display_name_check CHECK (((length(TRIM(BOTH FROM display_name)) >= 2) AND (length(TRIM(BOTH FROM display_name)) <= 80)))
);


--
-- Name: meryo_team_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meryo_team_services (
    member_id uuid NOT NULL,
    service_id bigint NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL
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

ALTER TABLE public.notificaciones ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
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
    monto numeric NOT NULL,
    moneda text DEFAULT 'PEN'::text NOT NULL,
    metodo text,
    proveedor text NOT NULL,
    proveedor_ref text,
    estado text DEFAULT 'pagado'::text NOT NULL,
    comision_plataforma numeric,
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

ALTER TABLE public.resenas ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
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
    extra_personalizacion numeric DEFAULT 0 NOT NULL,
    precio_total numeric NOT NULL,
    monto_adelanto numeric NOT NULL,
    estado text DEFAULT 'solicitada'::text NOT NULL,
    expira_respuesta_en timestamp with time zone,
    expira_pago_en timestamp with time zone,
    aceptada_en timestamp with time zone,
    pagada_en timestamp with time zone,
    cerrada_en timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    barbero_id uuid,
    barbero_nombre text,
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
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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
    precio numeric NOT NULL,
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

ALTER TABLE public.servicios ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.servicios_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL,
    versioning_status text DEFAULT 'DISABLED'::text NOT NULL,
    lifecycle_configuration jsonb,
    lifecycle_configuration_generation uuid,
    CONSTRAINT buckets_lifecycle_configuration_pair_check CHECK (((lifecycle_configuration IS NULL) = (lifecycle_configuration_generation IS NULL))),
    CONSTRAINT buckets_lifecycle_configuration_shape_check CHECK (((lifecycle_configuration IS NULL) OR ((jsonb_typeof(lifecycle_configuration) = 'object'::text) AND (lifecycle_configuration ? 'rules'::text) AND
CASE
    WHEN (jsonb_typeof((lifecycle_configuration -> 'rules'::text)) = 'array'::text) THEN ((jsonb_array_length((lifecycle_configuration -> 'rules'::text)) >= 1) AND (jsonb_array_length((lifecycle_configuration -> 'rules'::text)) <= 1000))
    ELSE false
END))),
    CONSTRAINT buckets_lifecycle_configuration_standard_only_check CHECK (((type = 'STANDARD'::storage.buckettype) OR ((lifecycle_configuration IS NULL) AND (lifecycle_configuration_generation IS NULL)))),
    CONSTRAINT buckets_versioning_dark_check CHECK ((versioning_status = 'DISABLED'::text)),
    CONSTRAINT buckets_versioning_standard_only_check CHECK (((type = 'STANDARD'::storage.buckettype) OR (versioning_status = 'DISABLED'::text))),
    CONSTRAINT buckets_versioning_status_check CHECK ((versioning_status = ANY (ARRAY['DISABLED'::text, 'ENABLED'::text, 'SUSPENDED'::text])))
);


--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_analytics (
    name text NOT NULL,
    type storage.buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
    format text DEFAULT 'ICEBERG'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: buckets_vectors; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_vectors (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'VECTOR'::storage.buckettype NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb,
    archived_at timestamp with time zone,
    is_delete_marker boolean DEFAULT false NOT NULL,
    is_versioned boolean DEFAULT false NOT NULL
);


--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb,
    metadata jsonb
);


--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vector_indexes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.vector_indexes (
    id text DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    bucket_id text NOT NULL,
    data_type text NOT NULL,
    dimension integer NOT NULL,
    distance_metric text NOT NULL,
    metadata_configuration jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: custom_oauth_providers custom_oauth_providers_identifier_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_identifier_key UNIQUE (identifier);


--
-- Name: custom_oauth_providers custom_oauth_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: mfa_recovery_code_sets mfa_recovery_code_sets_mfa_factor_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_recovery_code_sets
    ADD CONSTRAINT mfa_recovery_code_sets_mfa_factor_id_key UNIQUE (mfa_factor_id);


--
-- Name: mfa_recovery_code_sets mfa_recovery_code_sets_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_recovery_code_sets
    ADD CONSTRAINT mfa_recovery_code_sets_pkey PRIMARY KEY (id);


--
-- Name: mfa_recovery_code_sets mfa_recovery_code_sets_user_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_recovery_code_sets
    ADD CONSTRAINT mfa_recovery_code_sets_user_id_key UNIQUE (user_id);


--
-- Name: mfa_recovery_codes mfa_recovery_codes_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_recovery_codes
    ADD CONSTRAINT mfa_recovery_codes_pkey PRIMARY KEY (id);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- Name: oauth_client_states oauth_client_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_client_states
    ADD CONSTRAINT oauth_client_states_pkey PRIMARY KEY (id);


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: scim_tokens scim_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.scim_tokens
    ADD CONSTRAINT scim_tokens_pkey PRIMARY KEY (id);


--
-- Name: scim_users scim_users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.scim_users
    ADD CONSTRAINT scim_users_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: webauthn_challenges webauthn_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_pkey PRIMARY KEY (id);


--
-- Name: webauthn_credentials webauthn_credentials_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_pkey PRIMARY KEY (id);


--
-- Name: catalog_exclusions catalog_exclusions_pkey; Type: CONSTRAINT; Schema: meryo_private; Owner: -
--

ALTER TABLE ONLY meryo_private.catalog_exclusions
    ADD CONSTRAINT catalog_exclusions_pkey PRIMARY KEY (barberia_id);


--
-- Name: launch_settings launch_settings_pkey; Type: CONSTRAINT; Schema: meryo_private; Owner: -
--

ALTER TABLE ONLY meryo_private.launch_settings
    ADD CONSTRAINT launch_settings_pkey PRIMARY KEY (id);


--
-- Name: payment_intents payment_intents_pkey; Type: CONSTRAINT; Schema: meryo_private; Owner: -
--

ALTER TABLE ONLY meryo_private.payment_intents
    ADD CONSTRAINT payment_intents_pkey PRIMARY KEY (id);


--
-- Name: payment_intents payment_intents_proveedor_referencia_key; Type: CONSTRAINT; Schema: meryo_private; Owner: -
--

ALTER TABLE ONLY meryo_private.payment_intents
    ADD CONSTRAINT payment_intents_proveedor_referencia_key UNIQUE (proveedor, referencia);


--
-- Name: payment_intents payment_intents_reserva_id_key; Type: CONSTRAINT; Schema: meryo_private; Owner: -
--

ALTER TABLE ONLY meryo_private.payment_intents
    ADD CONSTRAINT payment_intents_reserva_id_key UNIQUE (reserva_id);


--
-- Name: payment_receipts payment_receipts_intent_id_key; Type: CONSTRAINT; Schema: meryo_private; Owner: -
--

ALTER TABLE ONLY meryo_private.payment_receipts
    ADD CONSTRAINT payment_receipts_intent_id_key UNIQUE (intent_id);


--
-- Name: payment_receipts payment_receipts_pkey; Type: CONSTRAINT; Schema: meryo_private; Owner: -
--

ALTER TABLE ONLY meryo_private.payment_receipts
    ADD CONSTRAINT payment_receipts_pkey PRIMARY KEY (id);


--
-- Name: push_deliveries push_deliveries_outbox_id_endpoint_hash_key; Type: CONSTRAINT; Schema: meryo_private; Owner: -
--

ALTER TABLE ONLY meryo_private.push_deliveries
    ADD CONSTRAINT push_deliveries_outbox_id_endpoint_hash_key UNIQUE (outbox_id, endpoint_hash);


--
-- Name: push_deliveries push_deliveries_pkey; Type: CONSTRAINT; Schema: meryo_private; Owner: -
--

ALTER TABLE ONLY meryo_private.push_deliveries
    ADD CONSTRAINT push_deliveries_pkey PRIMARY KEY (id);


--
-- Name: push_outbox push_outbox_notification_id_key; Type: CONSTRAINT; Schema: meryo_private; Owner: -
--

ALTER TABLE ONLY meryo_private.push_outbox
    ADD CONSTRAINT push_outbox_notification_id_key UNIQUE (notification_id);


--
-- Name: push_outbox push_outbox_pkey; Type: CONSTRAINT; Schema: meryo_private; Owner: -
--

ALTER TABLE ONLY meryo_private.push_outbox
    ADD CONSTRAINT push_outbox_pkey PRIMARY KEY (id);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: meryo_private; Owner: -
--

ALTER TABLE ONLY meryo_private.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (endpoint);


--
-- Name: reservation_events reservation_events_pkey; Type: CONSTRAINT; Schema: meryo_private; Owner: -
--

ALTER TABLE ONLY meryo_private.reservation_events
    ADD CONSTRAINT reservation_events_pkey PRIMARY KEY (id);


--
-- Name: shop_content_settings shop_content_settings_pkey; Type: CONSTRAINT; Schema: meryo_private; Owner: -
--

ALTER TABLE ONLY meryo_private.shop_content_settings
    ADD CONSTRAINT shop_content_settings_pkey PRIMARY KEY (id);


--
-- Name: shop_events shop_events_pkey; Type: CONSTRAINT; Schema: meryo_private; Owner: -
--

ALTER TABLE ONLY meryo_private.shop_events
    ADD CONSTRAINT shop_events_pkey PRIMARY KEY (id);


--
-- Name: shop_owners shop_owners_pkey; Type: CONSTRAINT; Schema: meryo_private; Owner: -
--

ALTER TABLE ONLY meryo_private.shop_owners
    ADD CONSTRAINT shop_owners_pkey PRIMARY KEY (barberia_id);


--
-- Name: shop_owners shop_owners_user_id_key; Type: CONSTRAINT; Schema: meryo_private; Owner: -
--

ALTER TABLE ONLY meryo_private.shop_owners
    ADD CONSTRAINT shop_owners_user_id_key UNIQUE (user_id);


--
-- Name: team_invites team_invites_pkey; Type: CONSTRAINT; Schema: meryo_private; Owner: -
--

ALTER TABLE ONLY meryo_private.team_invites
    ADD CONSTRAINT team_invites_pkey PRIMARY KEY (id);


--
-- Name: team_invites team_invites_token_hash_key; Type: CONSTRAINT; Schema: meryo_private; Owner: -
--

ALTER TABLE ONLY meryo_private.team_invites
    ADD CONSTRAINT team_invites_token_hash_key UNIQUE (token_hash);


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
-- Name: meryo_shop_assets meryo_shop_assets_object_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meryo_shop_assets
    ADD CONSTRAINT meryo_shop_assets_object_path_key UNIQUE (object_path);


--
-- Name: meryo_shop_assets meryo_shop_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meryo_shop_assets
    ADD CONSTRAINT meryo_shop_assets_pkey PRIMARY KEY (id);


--
-- Name: meryo_team_blocks meryo_team_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meryo_team_blocks
    ADD CONSTRAINT meryo_team_blocks_pkey PRIMARY KEY (id);


--
-- Name: meryo_team_hours meryo_team_hours_legacy_hour_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meryo_team_hours
    ADD CONSTRAINT meryo_team_hours_legacy_hour_id_key UNIQUE (legacy_hour_id);


--
-- Name: meryo_team_hours meryo_team_hours_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meryo_team_hours
    ADD CONSTRAINT meryo_team_hours_pkey PRIMARY KEY (id);


--
-- Name: meryo_team_members meryo_team_members_id_barberia_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meryo_team_members
    ADD CONSTRAINT meryo_team_members_id_barberia_id_key UNIQUE (id, barberia_id);


--
-- Name: meryo_team_members meryo_team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meryo_team_members
    ADD CONSTRAINT meryo_team_members_pkey PRIMARY KEY (id);


--
-- Name: meryo_team_members meryo_team_members_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meryo_team_members
    ADD CONSTRAINT meryo_team_members_user_id_key UNIQUE (user_id);


--
-- Name: meryo_team_services meryo_team_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meryo_team_services
    ADD CONSTRAINT meryo_team_services_pkey PRIMARY KEY (member_id, service_id);


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
    ADD CONSTRAINT reservas_sin_cruce EXCLUDE USING gist (barberia_id WITH =, barbero_id WITH =, tstzrange(inicio, fin, '[)'::text) WITH &&) WHERE ((estado = ANY (ARRAY['solicitada'::text, 'aceptada'::text, 'confirmada'::text])));


--
-- Name: servicios servicios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicios
    ADD CONSTRAINT servicios_pkey PRIMARY KEY (id);


--
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: buckets_vectors buckets_vectors_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_vectors
    ADD CONSTRAINT buckets_vectors_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: vector_indexes vector_indexes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_pkey PRIMARY KEY (id);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: custom_oauth_providers_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_created_at_idx ON auth.custom_oauth_providers USING btree (created_at);


--
-- Name: custom_oauth_providers_enabled_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_enabled_idx ON auth.custom_oauth_providers USING btree (enabled);


--
-- Name: custom_oauth_providers_identifier_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_identifier_idx ON auth.custom_oauth_providers USING btree (identifier);


--
-- Name: custom_oauth_providers_provider_type_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_provider_type_idx ON auth.custom_oauth_providers USING btree (provider_type);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_oauth_client_states_created_at; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: mfa_recovery_codes_set_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_recovery_codes_set_id_idx ON auth.mfa_recovery_codes USING btree (mfa_recovery_code_set_id);


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: schema_migrations_version_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX schema_migrations_version_idx ON auth.schema_migrations USING btree (version);


--
-- Name: scim_tokens_expires_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX scim_tokens_expires_at_idx ON auth.scim_tokens USING btree (expires_at);


--
-- Name: scim_tokens_revoked_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX scim_tokens_revoked_at_idx ON auth.scim_tokens USING btree (revoked_at);


--
-- Name: scim_tokens_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX scim_tokens_sso_provider_id_idx ON auth.scim_tokens USING btree (sso_provider_id);


--
-- Name: scim_tokens_token_hash_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX scim_tokens_token_hash_key ON auth.scim_tokens USING btree (token_hash);


--
-- Name: scim_users_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX scim_users_created_at_idx ON auth.scim_users USING btree (sso_provider_id, created_at, id) WHERE (deleted_at IS NULL);


--
-- Name: scim_users_deleted_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX scim_users_deleted_at_idx ON auth.scim_users USING btree (deleted_at);


--
-- Name: scim_users_external_id_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX scim_users_external_id_key ON auth.scim_users USING btree (sso_provider_id, external_id) WHERE ((external_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: scim_users_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX scim_users_id_idx ON auth.scim_users USING btree (sso_provider_id, id) WHERE (deleted_at IS NULL);


--
-- Name: scim_users_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX scim_users_sso_provider_id_idx ON auth.scim_users USING btree (sso_provider_id);


--
-- Name: scim_users_updated_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX scim_users_updated_at_idx ON auth.scim_users USING btree (sso_provider_id, updated_at, id) WHERE (deleted_at IS NULL);


--
-- Name: scim_users_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX scim_users_user_id_idx ON auth.scim_users USING btree (user_id);


--
-- Name: scim_users_user_name_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX scim_users_user_name_idx ON auth.scim_users USING btree (sso_provider_id, user_name COLLATE "C", id) WHERE (deleted_at IS NULL);


--
-- Name: scim_users_user_name_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX scim_users_user_name_key ON auth.scim_users USING btree (sso_provider_id, user_name) WHERE (deleted_at IS NULL);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: webauthn_challenges_expires_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_challenges_expires_at_idx ON auth.webauthn_challenges USING btree (expires_at);


--
-- Name: webauthn_challenges_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_challenges_user_id_idx ON auth.webauthn_challenges USING btree (user_id);


--
-- Name: webauthn_credentials_credential_id_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX webauthn_credentials_credential_id_key ON auth.webauthn_credentials USING btree (credential_id);


--
-- Name: webauthn_credentials_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_credentials_user_id_idx ON auth.webauthn_credentials USING btree (user_id);


--
-- Name: reservation_events_reserva_id_created_at_idx; Type: INDEX; Schema: meryo_private; Owner: -
--

CREATE INDEX reservation_events_reserva_id_created_at_idx ON meryo_private.reservation_events USING btree (reserva_id, created_at);


--
-- Name: barberia_media_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX barberia_media_idx ON public.barberia_media USING btree (barberia_id, tipo, orden);


--
-- Name: barberias_distrito_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX barberias_distrito_idx ON public.barberias USING btree (distrito);


--
-- Name: meryo_single_cover; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX meryo_single_cover ON public.meryo_shop_assets USING btree (barberia_id) WHERE ((kind = 'portada'::text) AND active);


--
-- Name: meryo_single_video; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX meryo_single_video ON public.meryo_shop_assets USING btree (barberia_id) WHERE ((kind = 'video'::text) AND active);


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
-- Name: bname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: buckets_analytics_unique_name_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: idx_objects_bucket_id_name_lower; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name_lower ON storage.objects USING btree (bucket_id, lower(name) COLLATE "C");


--
-- Name: idx_objects_current_version; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX idx_objects_current_version ON storage.objects USING btree (bucket_id, name COLLATE "C") WHERE (archived_at IS NULL);


--
-- Name: idx_objects_delete_markers; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_delete_markers ON storage.objects USING btree (bucket_id, name COLLATE "C") WHERE is_delete_marker;


--
-- Name: idx_objects_null_version; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX idx_objects_null_version ON storage.objects USING btree (bucket_id, name COLLATE "C") WHERE (NOT is_versioned);


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: objects_bucket_id_name_version_key; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX objects_bucket_id_name_version_key ON storage.objects USING btree (bucket_id, name COLLATE "C", version) NULLS NOT DISTINCT;


--
-- Name: vector_indexes_name_bucket_id_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id);


--
-- Name: users on_auth_user_created; Type: TRIGGER; Schema: auth; Owner: -
--

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


--
-- Name: shop_owners meryo_initialize_owner; Type: TRIGGER; Schema: meryo_private; Owner: -
--

CREATE TRIGGER meryo_initialize_owner AFTER INSERT ON meryo_private.shop_owners FOR EACH ROW EXECUTE FUNCTION meryo_private.initialize_owner_team();


--
-- Name: servicios meryo_assign_owner_service; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER meryo_assign_owner_service AFTER INSERT ON public.servicios FOR EACH ROW EXECUTE FUNCTION meryo_private.assign_owner_service();


--
-- Name: bloqueos meryo_general_blocks_safe; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER meryo_general_blocks_safe AFTER INSERT OR DELETE OR UPDATE ON public.bloqueos DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION meryo_private.check_general_bookings();


--
-- Name: horarios meryo_general_hours_safe; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER meryo_general_hours_safe AFTER INSERT OR DELETE OR UPDATE ON public.horarios DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION meryo_private.check_general_bookings();


--
-- Name: reservas meryo_guard_individual_slot; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER meryo_guard_individual_slot BEFORE INSERT OR UPDATE ON public.reservas FOR EACH ROW EXECUTE FUNCTION meryo_private.guard_booking_slot();


--
-- Name: notificaciones meryo_queue_push; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER meryo_queue_push AFTER INSERT ON public.notificaciones FOR EACH ROW EXECUTE FUNCTION meryo_private.queue_push();


--
-- Name: reservas meryo_reservation_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER meryo_reservation_audit AFTER INSERT OR UPDATE ON public.reservas FOR EACH ROW EXECUTE FUNCTION meryo_private.audit_reservation();


--
-- Name: barberias meryo_shop_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER meryo_shop_audit AFTER UPDATE ON public.barberias FOR EACH ROW EXECUTE FUNCTION meryo_private.audit_shop();


--
-- Name: horarios meryo_sync_general_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER meryo_sync_general_delete BEFORE DELETE ON public.horarios FOR EACH ROW EXECUTE FUNCTION meryo_private.sync_general_hours();


--
-- Name: horarios meryo_sync_general_hours; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER meryo_sync_general_hours AFTER INSERT OR UPDATE ON public.horarios FOR EACH ROW EXECUTE FUNCTION meryo_private.sync_general_hours();


--
-- Name: resenas resenas_sync_rating; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER resenas_sync_rating AFTER INSERT ON public.resenas FOR EACH ROW EXECUTE FUNCTION public.sync_rating();


--
-- Name: servicios servicios_sync_precio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER servicios_sync_precio AFTER INSERT OR DELETE OR UPDATE ON public.servicios FOR EACH ROW EXECUTE FUNCTION public.sync_precio_desde();


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- Name: buckets protect_bucket_control_insert; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_bucket_control_insert BEFORE INSERT ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.protect_bucket_control_columns('service_role');


--
-- Name: buckets protect_bucket_control_update; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_bucket_control_update BEFORE UPDATE OF lifecycle_configuration, lifecycle_configuration_generation ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.protect_bucket_control_columns();


--
-- Name: buckets protect_bucket_control_update_role; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_bucket_control_update_role AFTER UPDATE OF lifecycle_configuration, lifecycle_configuration_generation ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_lifecycle_service_role('service_role');


--
-- Name: buckets protect_buckets_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects protect_objects_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_recovery_code_sets mfa_recovery_code_sets_mfa_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_recovery_code_sets
    ADD CONSTRAINT mfa_recovery_code_sets_mfa_factor_id_fkey FOREIGN KEY (mfa_factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_recovery_code_sets mfa_recovery_code_sets_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_recovery_code_sets
    ADD CONSTRAINT mfa_recovery_code_sets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_recovery_codes mfa_recovery_codes_mfa_recovery_code_set_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_recovery_codes
    ADD CONSTRAINT mfa_recovery_codes_mfa_recovery_code_set_id_fkey FOREIGN KEY (mfa_recovery_code_set_id) REFERENCES auth.mfa_recovery_code_sets(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: scim_tokens scim_tokens_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.scim_tokens
    ADD CONSTRAINT scim_tokens_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: scim_users scim_users_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.scim_users
    ADD CONSTRAINT scim_users_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: scim_users scim_users_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.scim_users
    ADD CONSTRAINT scim_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: webauthn_challenges webauthn_challenges_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: webauthn_credentials webauthn_credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: catalog_exclusions catalog_exclusions_barberia_id_fkey; Type: FK CONSTRAINT; Schema: meryo_private; Owner: -
--

ALTER TABLE ONLY meryo_private.catalog_exclusions
    ADD CONSTRAINT catalog_exclusions_barberia_id_fkey FOREIGN KEY (barberia_id) REFERENCES public.barberias(id) ON DELETE CASCADE;


--
-- Name: payment_intents payment_intents_reserva_id_fkey; Type: FK CONSTRAINT; Schema: meryo_private; Owner: -
--

ALTER TABLE ONLY meryo_private.payment_intents
    ADD CONSTRAINT payment_intents_reserva_id_fkey FOREIGN KEY (reserva_id) REFERENCES public.reservas(id);


--
-- Name: payment_receipts payment_receipts_intent_id_fkey; Type: FK CONSTRAINT; Schema: meryo_private; Owner: -
--

ALTER TABLE ONLY meryo_private.payment_receipts
    ADD CONSTRAINT payment_receipts_intent_id_fkey FOREIGN KEY (intent_id) REFERENCES meryo_private.payment_intents(id);


--
-- Name: push_deliveries push_deliveries_outbox_id_fkey; Type: FK CONSTRAINT; Schema: meryo_private; Owner: -
--

ALTER TABLE ONLY meryo_private.push_deliveries
    ADD CONSTRAINT push_deliveries_outbox_id_fkey FOREIGN KEY (outbox_id) REFERENCES meryo_private.push_outbox(id);


--
-- Name: push_outbox push_outbox_notification_id_fkey; Type: FK CONSTRAINT; Schema: meryo_private; Owner: -
--

ALTER TABLE ONLY meryo_private.push_outbox
    ADD CONSTRAINT push_outbox_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.notificaciones(id);


--
-- Name: push_outbox push_outbox_reserva_id_fkey; Type: FK CONSTRAINT; Schema: meryo_private; Owner: -
--

ALTER TABLE ONLY meryo_private.push_outbox
    ADD CONSTRAINT push_outbox_reserva_id_fkey FOREIGN KEY (reserva_id) REFERENCES public.reservas(id);


--
-- Name: push_outbox push_outbox_user_id_fkey; Type: FK CONSTRAINT; Schema: meryo_private; Owner: -
--

ALTER TABLE ONLY meryo_private.push_outbox
    ADD CONSTRAINT push_outbox_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: push_subscriptions push_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: meryo_private; Owner: -
--

ALTER TABLE ONLY meryo_private.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: reservation_events reservation_events_reserva_id_fkey; Type: FK CONSTRAINT; Schema: meryo_private; Owner: -
--

ALTER TABLE ONLY meryo_private.reservation_events
    ADD CONSTRAINT reservation_events_reserva_id_fkey FOREIGN KEY (reserva_id) REFERENCES public.reservas(id);


--
-- Name: shop_events shop_events_actor_id_fkey; Type: FK CONSTRAINT; Schema: meryo_private; Owner: -
--

ALTER TABLE ONLY meryo_private.shop_events
    ADD CONSTRAINT shop_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id);


--
-- Name: shop_events shop_events_barberia_id_fkey; Type: FK CONSTRAINT; Schema: meryo_private; Owner: -
--

ALTER TABLE ONLY meryo_private.shop_events
    ADD CONSTRAINT shop_events_barberia_id_fkey FOREIGN KEY (barberia_id) REFERENCES public.barberias(id);


--
-- Name: shop_owners shop_owners_barberia_id_fkey; Type: FK CONSTRAINT; Schema: meryo_private; Owner: -
--

ALTER TABLE ONLY meryo_private.shop_owners
    ADD CONSTRAINT shop_owners_barberia_id_fkey FOREIGN KEY (barberia_id) REFERENCES public.barberias(id);


--
-- Name: shop_owners shop_owners_user_id_fkey; Type: FK CONSTRAINT; Schema: meryo_private; Owner: -
--

ALTER TABLE ONLY meryo_private.shop_owners
    ADD CONSTRAINT shop_owners_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: team_invites team_invites_accepted_by_fkey; Type: FK CONSTRAINT; Schema: meryo_private; Owner: -
--

ALTER TABLE ONLY meryo_private.team_invites
    ADD CONSTRAINT team_invites_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES public.profiles(id);


--
-- Name: team_invites team_invites_barberia_id_fkey; Type: FK CONSTRAINT; Schema: meryo_private; Owner: -
--

ALTER TABLE ONLY meryo_private.team_invites
    ADD CONSTRAINT team_invites_barberia_id_fkey FOREIGN KEY (barberia_id) REFERENCES public.barberias(id);


--
-- Name: team_invites team_invites_created_by_fkey; Type: FK CONSTRAINT; Schema: meryo_private; Owner: -
--

ALTER TABLE ONLY meryo_private.team_invites
    ADD CONSTRAINT team_invites_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


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
-- Name: reservas meryo_booking_member_shop; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas
    ADD CONSTRAINT meryo_booking_member_shop FOREIGN KEY (barbero_id, barberia_id) REFERENCES public.meryo_team_members(id, barberia_id);


--
-- Name: meryo_shop_assets meryo_shop_assets_barberia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meryo_shop_assets
    ADD CONSTRAINT meryo_shop_assets_barberia_id_fkey FOREIGN KEY (barberia_id) REFERENCES public.barberias(id);


--
-- Name: meryo_team_blocks meryo_team_blocks_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meryo_team_blocks
    ADD CONSTRAINT meryo_team_blocks_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.meryo_team_members(id);


--
-- Name: meryo_team_hours meryo_team_hours_legacy_hour_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meryo_team_hours
    ADD CONSTRAINT meryo_team_hours_legacy_hour_id_fkey FOREIGN KEY (legacy_hour_id) REFERENCES public.horarios(id) ON DELETE SET NULL;


--
-- Name: meryo_team_hours meryo_team_hours_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meryo_team_hours
    ADD CONSTRAINT meryo_team_hours_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.meryo_team_members(id);


--
-- Name: meryo_team_members meryo_team_members_barberia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meryo_team_members
    ADD CONSTRAINT meryo_team_members_barberia_id_fkey FOREIGN KEY (barberia_id) REFERENCES public.barberias(id);


--
-- Name: meryo_team_members meryo_team_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meryo_team_members
    ADD CONSTRAINT meryo_team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: meryo_team_services meryo_team_services_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meryo_team_services
    ADD CONSTRAINT meryo_team_services_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.meryo_team_members(id);


--
-- Name: meryo_team_services meryo_team_services_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meryo_team_services
    ADD CONSTRAINT meryo_team_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.servicios(id);


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
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: vector_indexes vector_indexes_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id);


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: catalog_exclusions; Type: ROW SECURITY; Schema: meryo_private; Owner: -
--

ALTER TABLE meryo_private.catalog_exclusions ENABLE ROW LEVEL SECURITY;

--
-- Name: reservation_events; Type: ROW SECURITY; Schema: meryo_private; Owner: -
--

ALTER TABLE meryo_private.reservation_events ENABLE ROW LEVEL SECURITY;

--
-- Name: shop_content_settings; Type: ROW SECURITY; Schema: meryo_private; Owner: -
--

ALTER TABLE meryo_private.shop_content_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: shop_events; Type: ROW SECURITY; Schema: meryo_private; Owner: -
--

ALTER TABLE meryo_private.shop_events ENABLE ROW LEVEL SECURITY;

--
-- Name: shop_owners; Type: ROW SECURITY; Schema: meryo_private; Owner: -
--

ALTER TABLE meryo_private.shop_owners ENABLE ROW LEVEL SECURITY;

--
-- Name: team_invites; Type: ROW SECURITY; Schema: meryo_private; Owner: -
--

ALTER TABLE meryo_private.team_invites ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "barberias: ver verificadas, la propia, o todas si admin" ON public.barberias FOR SELECT TO anon, authenticated USING (((verificada = true) OR (id = public.mi_barberia_id()) OR public.es_admin()));


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

CREATE POLICY "config: lectura publica" ON public.configuracion FOR SELECT TO anon, authenticated USING (true);


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

CREATE POLICY "horarios: ver publicos o propios" ON public.horarios FOR SELECT TO anon, authenticated USING (((barberia_id = public.mi_barberia_id()) OR public.es_admin() OR (EXISTS ( SELECT 1
   FROM public.barberias b
  WHERE ((b.id = horarios.barberia_id) AND b.verificada)))));


--
-- Name: barberia_media media: el dueño administra; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "media: el dueño administra" ON public.barberia_media TO authenticated USING ((barberia_id = public.mi_barberia_id())) WITH CHECK ((barberia_id = public.mi_barberia_id()));


--
-- Name: barberia_media media: ver publica o propia; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "media: ver publica o propia" ON public.barberia_media FOR SELECT TO anon, authenticated USING (((barberia_id = public.mi_barberia_id()) OR public.es_admin() OR (EXISTS ( SELECT 1
   FROM public.barberias b
  WHERE ((b.id = barberia_media.barberia_id) AND b.verificada)))));


--
-- Name: notificaciones meryo_active_account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meryo_active_account ON public.notificaciones AS RESTRICTIVE TO authenticated USING (public.meryo_cuenta_activa()) WITH CHECK (public.meryo_cuenta_activa());


--
-- Name: pagos meryo_active_account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meryo_active_account ON public.pagos AS RESTRICTIVE FOR SELECT TO authenticated USING (public.meryo_cuenta_activa());


--
-- Name: reservas meryo_active_account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meryo_active_account ON public.reservas AS RESTRICTIVE FOR SELECT TO authenticated USING (public.meryo_cuenta_activa());


--
-- Name: barberia_media meryo_active_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meryo_active_delete ON public.barberia_media AS RESTRICTIVE FOR DELETE TO authenticated USING (public.meryo_cuenta_activa());


--
-- Name: barberias meryo_active_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meryo_active_delete ON public.barberias AS RESTRICTIVE FOR DELETE TO authenticated USING (public.meryo_cuenta_activa());


--
-- Name: bloqueos meryo_active_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meryo_active_delete ON public.bloqueos AS RESTRICTIVE FOR DELETE TO authenticated USING (public.meryo_cuenta_activa());


--
-- Name: horarios meryo_active_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meryo_active_delete ON public.horarios AS RESTRICTIVE FOR DELETE TO authenticated USING (public.meryo_cuenta_activa());


--
-- Name: profiles meryo_active_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meryo_active_delete ON public.profiles AS RESTRICTIVE FOR DELETE TO authenticated USING (public.meryo_cuenta_activa());


--
-- Name: servicios meryo_active_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meryo_active_delete ON public.servicios AS RESTRICTIVE FOR DELETE TO authenticated USING (public.meryo_cuenta_activa());


--
-- Name: barberia_media meryo_active_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meryo_active_insert ON public.barberia_media AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.meryo_cuenta_activa());


--
-- Name: barberias meryo_active_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meryo_active_insert ON public.barberias AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.meryo_cuenta_activa());


--
-- Name: bloqueos meryo_active_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meryo_active_insert ON public.bloqueos AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.meryo_cuenta_activa());


--
-- Name: horarios meryo_active_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meryo_active_insert ON public.horarios AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.meryo_cuenta_activa());


--
-- Name: profiles meryo_active_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meryo_active_insert ON public.profiles AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.meryo_cuenta_activa());


--
-- Name: servicios meryo_active_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meryo_active_insert ON public.servicios AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.meryo_cuenta_activa());


--
-- Name: barberia_media meryo_active_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meryo_active_update ON public.barberia_media AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.meryo_cuenta_activa()) WITH CHECK (public.meryo_cuenta_activa());


--
-- Name: barberias meryo_active_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meryo_active_update ON public.barberias AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.meryo_cuenta_activa()) WITH CHECK (public.meryo_cuenta_activa());


--
-- Name: bloqueos meryo_active_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meryo_active_update ON public.bloqueos AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.meryo_cuenta_activa()) WITH CHECK (public.meryo_cuenta_activa());


--
-- Name: horarios meryo_active_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meryo_active_update ON public.horarios AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.meryo_cuenta_activa()) WITH CHECK (public.meryo_cuenta_activa());


--
-- Name: profiles meryo_active_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meryo_active_update ON public.profiles AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.meryo_cuenta_activa()) WITH CHECK (public.meryo_cuenta_activa());


--
-- Name: servicios meryo_active_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meryo_active_update ON public.servicios AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.meryo_cuenta_activa()) WITH CHECK (public.meryo_cuenta_activa());


--
-- Name: meryo_shop_assets meryo_assets_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meryo_assets_read ON public.meryo_shop_assets FOR SELECT TO anon, authenticated USING (((active AND (EXISTS ( SELECT 1
   FROM public.barberias b
  WHERE ((b.id = meryo_shop_assets.barberia_id) AND b.verificada AND (b.estado = 'activa'::text) AND public.meryo_barberia_publicable(b.id))))) OR public.es_admin() OR (barberia_id = public.mi_barberia_id())));


--
-- Name: reservas meryo_assigned_reservation_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meryo_assigned_reservation_read ON public.reservas AS RESTRICTIVE FOR SELECT TO authenticated USING (((cliente_id = auth.uid()) OR public.es_admin() OR public.meryo_es_propietario(barberia_id) OR public.meryo_es_cita_asignada(barbero_id)));


--
-- Name: barberias meryo_catalog_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meryo_catalog_anon ON public.barberias AS RESTRICTIVE FOR SELECT TO anon USING (public.meryo_barberia_publicable(id));


--
-- Name: barberias meryo_catalog_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meryo_catalog_authenticated ON public.barberias AS RESTRICTIVE FOR SELECT TO authenticated USING ((public.meryo_barberia_publicable(id) OR public.es_admin() OR (id = public.mi_barberia_id())));


--
-- Name: barberia_media meryo_owner_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meryo_owner_delete ON public.barberia_media AS RESTRICTIVE FOR DELETE TO authenticated USING (public.meryo_es_propietario(barberia_id));


--
-- Name: bloqueos meryo_owner_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meryo_owner_delete ON public.bloqueos AS RESTRICTIVE FOR DELETE TO authenticated USING (public.meryo_es_propietario(barberia_id));


--
-- Name: horarios meryo_owner_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meryo_owner_delete ON public.horarios AS RESTRICTIVE FOR DELETE TO authenticated USING (public.meryo_es_propietario(barberia_id));


--
-- Name: servicios meryo_owner_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meryo_owner_delete ON public.servicios AS RESTRICTIVE FOR DELETE TO authenticated USING (public.meryo_es_propietario(barberia_id));


--
-- Name: barberia_media meryo_owner_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meryo_owner_insert ON public.barberia_media AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.meryo_es_propietario(barberia_id));


--
-- Name: bloqueos meryo_owner_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meryo_owner_insert ON public.bloqueos AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.meryo_es_propietario(barberia_id));


--
-- Name: horarios meryo_owner_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meryo_owner_insert ON public.horarios AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.meryo_es_propietario(barberia_id));


--
-- Name: servicios meryo_owner_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meryo_owner_insert ON public.servicios AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.meryo_es_propietario(barberia_id));


--
-- Name: barberia_media meryo_owner_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meryo_owner_update ON public.barberia_media AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.meryo_es_propietario(barberia_id)) WITH CHECK (public.meryo_es_propietario(barberia_id));


--
-- Name: bloqueos meryo_owner_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meryo_owner_update ON public.bloqueos AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.meryo_es_propietario(barberia_id)) WITH CHECK (public.meryo_es_propietario(barberia_id));


--
-- Name: horarios meryo_owner_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meryo_owner_update ON public.horarios AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.meryo_es_propietario(barberia_id)) WITH CHECK (public.meryo_es_propietario(barberia_id));


--
-- Name: servicios meryo_owner_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meryo_owner_update ON public.servicios AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.meryo_es_propietario(barberia_id)) WITH CHECK (public.meryo_es_propietario(barberia_id));


--
-- Name: meryo_shop_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.meryo_shop_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: meryo_team_blocks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.meryo_team_blocks ENABLE ROW LEVEL SECURITY;

--
-- Name: meryo_team_hours; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.meryo_team_hours ENABLE ROW LEVEL SECURITY;

--
-- Name: meryo_team_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.meryo_team_members ENABLE ROW LEVEL SECURITY;

--
-- Name: meryo_team_services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.meryo_team_services ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "resenas: lectura publica" ON public.resenas FOR SELECT TO anon, authenticated USING ((EXISTS ( SELECT 1
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

CREATE POLICY "servicios: ver publicos o propios" ON public.servicios FOR SELECT TO anon, authenticated USING (((barberia_id = public.mi_barberia_id()) OR public.es_admin() OR (activo AND (EXISTS ( SELECT 1
   FROM public.barberias b
  WHERE ((b.id = servicios.barberia_id) AND b.verificada))))));


--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_vectors; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;

--
-- Name: objects media: el barbero borra de su carpeta; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "media: el barbero borra de su carpeta" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'barberias-media'::text) AND ((storage.foldername(name))[1] = (( SELECT public.mi_barberia_id() AS mi_barberia_id))::text)));


--
-- Name: objects media: el barbero edita su carpeta; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "media: el barbero edita su carpeta" ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'barberias-media'::text) AND ((storage.foldername(name))[1] = (( SELECT public.mi_barberia_id() AS mi_barberia_id))::text)));


--
-- Name: objects media: el barbero sube a su carpeta; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "media: el barbero sube a su carpeta" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'barberias-media'::text) AND ((storage.foldername(name))[1] = (( SELECT public.mi_barberia_id() AS mi_barberia_id))::text)));


--
-- Name: objects meryo_content_insert; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY meryo_content_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'meryo-shop-content'::text) AND ((public.meryo_contenido_config() ->> 'uploads_enabled'::text))::boolean AND (name ~ '^[0-9]+/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|mp4|webm)$'::text) AND public.meryo_es_propietario((NULLIF(split_part(name, '/'::text, 1), ''::text))::bigint)));


--
-- Name: objects meryo_content_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY meryo_content_read ON storage.objects FOR SELECT TO anon, authenticated USING (((bucket_id = 'meryo-shop-content'::text) AND ((EXISTS ( SELECT 1
   FROM public.meryo_shop_assets a
  WHERE ((a.object_path = objects.name) AND a.active))) OR public.es_admin() OR (split_part(name, '/'::text, 1) = (public.mi_barberia_id())::text))));


--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: vector_indexes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA auth; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA auth TO anon;
GRANT USAGE ON SCHEMA auth TO authenticated;


--
-- Name: SCHEMA meryo_private; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA meryo_private TO service_role;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO meryo_auth_owner;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;


--
-- Name: SCHEMA storage; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA storage TO anon;
GRANT USAGE ON SCHEMA storage TO authenticated;


--
-- Name: FUNCTION uid(); Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON FUNCTION auth.uid() TO anon;
GRANT ALL ON FUNCTION auth.uid() TO authenticated;


--
-- Name: FUNCTION cancelar_reserva_barbero(p_reserva_id uuid); Type: ACL; Schema: meryo_private; Owner: -
--

REVOKE ALL ON FUNCTION meryo_private.cancelar_reserva_barbero(p_reserva_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION meryo_private.cancelar_reserva_barbero(p_reserva_id uuid) TO service_role;


--
-- Name: FUNCTION marcar_asistencia(p_reserva_id uuid, p_asistio boolean); Type: ACL; Schema: meryo_private; Owner: -
--

REVOKE ALL ON FUNCTION meryo_private.marcar_asistencia(p_reserva_id uuid, p_asistio boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION meryo_private.marcar_asistencia(p_reserva_id uuid, p_asistio boolean) TO service_role;


--
-- Name: FUNCTION queue_push(); Type: ACL; Schema: meryo_private; Owner: -
--

REVOKE ALL ON FUNCTION meryo_private.queue_push() FROM PUBLIC;


--
-- Name: FUNCTION responder_reserva(p_reserva_id uuid, p_aceptar boolean); Type: ACL; Schema: meryo_private; Owner: -
--

REVOKE ALL ON FUNCTION meryo_private.responder_reserva(p_reserva_id uuid, p_aceptar boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION meryo_private.responder_reserva(p_reserva_id uuid, p_aceptar boolean) TO service_role;


--
-- Name: FUNCTION activar_barberia(p_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.activar_barberia(p_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.activar_barberia(p_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.activar_barberia(p_id bigint) TO service_role;


--
-- Name: FUNCTION cancelar_reserva_barbero(p_reserva_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cancelar_reserva_barbero(p_reserva_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cancelar_reserva_barbero(p_reserva_id uuid) TO authenticated;


--
-- Name: FUNCTION cancelar_reserva_cliente(p_reserva_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cancelar_reserva_cliente(p_reserva_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cancelar_reserva_cliente(p_reserva_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.cancelar_reserva_cliente(p_reserva_id uuid) TO service_role;


--
-- Name: FUNCTION cfg(p_clave text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cfg(p_clave text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cfg(p_clave text) TO service_role;


--
-- Name: FUNCTION confirmar_pago_interno(p_reserva uuid, p_proveedor text, p_ref text, p_metodo text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.confirmar_pago_interno(p_reserva uuid, p_proveedor text, p_ref text, p_metodo text) FROM PUBLIC;


--
-- Name: FUNCTION confirmar_pago_reserva(p_reserva_id uuid, p_proveedor text, p_ref text, p_metodo text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.confirmar_pago_reserva(p_reserva_id uuid, p_proveedor text, p_ref text, p_metodo text) FROM PUBLIC;


--
-- Name: FUNCTION confirmar_pago_verificado(p_intent uuid, p_proveedor text, p_referencia text, p_merchant text, p_monto_centimos bigint, p_moneda text, p_live boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.confirmar_pago_verificado(p_intent uuid, p_proveedor text, p_referencia text, p_merchant text, p_monto_centimos bigint, p_moneda text, p_live boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.confirmar_pago_verificado(p_intent uuid, p_proveedor text, p_referencia text, p_merchant text, p_monto_centimos bigint, p_moneda text, p_live boolean) TO service_role;


--
-- Name: FUNCTION crear_reserva(p_barberia_id bigint, p_servicio_id bigint, p_inicio timestamp with time zone, p_nombre text, p_telefono text, p_pedido text, p_extra numeric); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.crear_reserva(p_barberia_id bigint, p_servicio_id bigint, p_inicio timestamp with time zone, p_nombre text, p_telefono text, p_pedido text, p_extra numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION public.crear_reserva(p_barberia_id bigint, p_servicio_id bigint, p_inicio timestamp with time zone, p_nombre text, p_telefono text, p_pedido text, p_extra numeric) TO authenticated;
GRANT ALL ON FUNCTION public.crear_reserva(p_barberia_id bigint, p_servicio_id bigint, p_inicio timestamp with time zone, p_nombre text, p_telefono text, p_pedido text, p_extra numeric) TO service_role;


--
-- Name: FUNCTION dejar_resena(p_reserva_id uuid, p_calificacion integer, p_comentario text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.dejar_resena(p_reserva_id uuid, p_calificacion integer, p_comentario text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.dejar_resena(p_reserva_id uuid, p_calificacion integer, p_comentario text) TO authenticated;
GRANT ALL ON FUNCTION public.dejar_resena(p_reserva_id uuid, p_calificacion integer, p_comentario text) TO service_role;


--
-- Name: FUNCTION es_admin(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.es_admin() FROM PUBLIC;
GRANT ALL ON FUNCTION public.es_admin() TO anon;
GRANT ALL ON FUNCTION public.es_admin() TO authenticated;
GRANT ALL ON FUNCTION public.es_admin() TO service_role;


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
GRANT ALL ON FUNCTION public.horarios_disponibles(p_barberia_id bigint, p_servicio_id bigint, p_fecha date) TO anon;
GRANT ALL ON FUNCTION public.horarios_disponibles(p_barberia_id bigint, p_servicio_id bigint, p_fecha date) TO authenticated;
GRANT ALL ON FUNCTION public.horarios_disponibles(p_barberia_id bigint, p_servicio_id bigint, p_fecha date) TO service_role;


--
-- Name: FUNCTION marcar_asistencia(p_reserva_id uuid, p_asistio boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.marcar_asistencia(p_reserva_id uuid, p_asistio boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.marcar_asistencia(p_reserva_id uuid, p_asistio boolean) TO authenticated;


--
-- Name: FUNCTION meryo_aceptar_invitacion(p_token text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.meryo_aceptar_invitacion(p_token text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.meryo_aceptar_invitacion(p_token text) TO authenticated;


--
-- Name: FUNCTION meryo_actualizar_integrante(p_member uuid, p_name text, p_active boolean, p_services bigint[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.meryo_actualizar_integrante(p_member uuid, p_name text, p_active boolean, p_services bigint[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.meryo_actualizar_integrante(p_member uuid, p_name text, p_active boolean, p_services bigint[]) TO authenticated;


--
-- Name: FUNCTION meryo_admin_barberias(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.meryo_admin_barberias() FROM PUBLIC;
GRANT ALL ON FUNCTION public.meryo_admin_barberias() TO authenticated;


--
-- Name: FUNCTION meryo_admin_reserva_detalle(p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.meryo_admin_reserva_detalle(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.meryo_admin_reserva_detalle(p_id uuid) TO authenticated;


--
-- Name: FUNCTION meryo_admin_reservas(p_from date, p_to date, p_shop bigint, p_status text, p_search text, p_offset integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.meryo_admin_reservas(p_from date, p_to date, p_shop bigint, p_status text, p_search text, p_offset integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.meryo_admin_reservas(p_from date, p_to date, p_shop bigint, p_status text, p_search text, p_offset integer) TO authenticated;


--
-- Name: FUNCTION meryo_admin_resumen(p_from date, p_to date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.meryo_admin_resumen(p_from date, p_to date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.meryo_admin_resumen(p_from date, p_to date) TO authenticated;


--
-- Name: FUNCTION meryo_admin_usuarios(p_search text, p_role text, p_active text, p_offset integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.meryo_admin_usuarios(p_search text, p_role text, p_active text, p_offset integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.meryo_admin_usuarios(p_search text, p_role text, p_active text, p_offset integer) TO authenticated;


--
-- Name: FUNCTION meryo_agregar_bloqueo(p_member uuid, p_start timestamp with time zone, p_end timestamp with time zone, p_reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.meryo_agregar_bloqueo(p_member uuid, p_start timestamp with time zone, p_end timestamp with time zone, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.meryo_agregar_bloqueo(p_member uuid, p_start timestamp with time zone, p_end timestamp with time zone, p_reason text) TO authenticated;


--
-- Name: FUNCTION meryo_agregar_tramo(p_member uuid, p_day integer, p_kind text, p_start time without time zone, p_end time without time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.meryo_agregar_tramo(p_member uuid, p_day integer, p_kind text, p_start time without time zone, p_end time without time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.meryo_agregar_tramo(p_member uuid, p_day integer, p_kind text, p_start time without time zone, p_end time without time zone) TO authenticated;


--
-- Name: FUNCTION meryo_barberia_publicable(p_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.meryo_barberia_publicable(p_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.meryo_barberia_publicable(p_id bigint) TO anon;
GRANT ALL ON FUNCTION public.meryo_barberia_publicable(p_id bigint) TO authenticated;


--
-- Name: FUNCTION meryo_barberos_servicio(p_shop bigint, p_service bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.meryo_barberos_servicio(p_shop bigint, p_service bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.meryo_barberos_servicio(p_shop bigint, p_service bigint) TO anon;
GRANT ALL ON FUNCTION public.meryo_barberos_servicio(p_shop bigint, p_service bigint) TO authenticated;


--
-- Name: FUNCTION meryo_catalogo_base_011(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.meryo_catalogo_base_011() FROM PUBLIC;


--
-- Name: FUNCTION meryo_catalogo_base_012(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.meryo_catalogo_base_012() FROM PUBLIC;


--
-- Name: FUNCTION meryo_catalogo_publico(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.meryo_catalogo_publico() FROM PUBLIC;
GRANT ALL ON FUNCTION public.meryo_catalogo_publico() TO anon;
GRANT ALL ON FUNCTION public.meryo_catalogo_publico() TO authenticated;


--
-- Name: FUNCTION meryo_contenido_config(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.meryo_contenido_config() FROM PUBLIC;
GRANT ALL ON FUNCTION public.meryo_contenido_config() TO anon;
GRANT ALL ON FUNCTION public.meryo_contenido_config() TO authenticated;


--
-- Name: FUNCTION meryo_cuenta_activa(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.meryo_cuenta_activa() FROM PUBLIC;
GRANT ALL ON FUNCTION public.meryo_cuenta_activa() TO authenticated;


--
-- Name: FUNCTION meryo_editar_tramo(p_id uuid, p_start time without time zone, p_end time without time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.meryo_editar_tramo(p_id uuid, p_start time without time zone, p_end time without time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.meryo_editar_tramo(p_id uuid, p_start time without time zone, p_end time without time zone) TO authenticated;


--
-- Name: FUNCTION meryo_equipo(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.meryo_equipo() FROM PUBLIC;
GRANT ALL ON FUNCTION public.meryo_equipo() TO authenticated;


--
-- Name: FUNCTION meryo_es_cita_asignada(p_member uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.meryo_es_cita_asignada(p_member uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.meryo_es_cita_asignada(p_member uuid) TO authenticated;


--
-- Name: FUNCTION meryo_es_propietario(p_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.meryo_es_propietario(p_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.meryo_es_propietario(p_id bigint) TO authenticated;


--
-- Name: FUNCTION meryo_guardar_perfil(p_data jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.meryo_guardar_perfil(p_data jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.meryo_guardar_perfil(p_data jsonb) TO authenticated;


--
-- Name: FUNCTION meryo_historial_barberia(p_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.meryo_historial_barberia(p_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.meryo_historial_barberia(p_id bigint) TO authenticated;


--
-- Name: FUNCTION meryo_horarios_barbero(p_shop bigint, p_service bigint, p_date date, p_member uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.meryo_horarios_barbero(p_shop bigint, p_service bigint, p_date date, p_member uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.meryo_horarios_barbero(p_shop bigint, p_service bigint, p_date date, p_member uuid) TO anon;
GRANT ALL ON FUNCTION public.meryo_horarios_barbero(p_shop bigint, p_service bigint, p_date date, p_member uuid) TO authenticated;


--
-- Name: FUNCTION meryo_invitar_integrante(p_email text, p_name text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.meryo_invitar_integrante(p_email text, p_name text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.meryo_invitar_integrante(p_email text, p_name text) TO authenticated;


--
-- Name: FUNCTION meryo_moderar_barberia(p_id bigint, p_action text, p_reason text, p_expected text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.meryo_moderar_barberia(p_id bigint, p_action text, p_reason text, p_expected text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.meryo_moderar_barberia(p_id bigint, p_action text, p_reason text, p_expected text) TO authenticated;


--
-- Name: FUNCTION meryo_publicar_archivo(p_path text, p_kind text, p_title text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.meryo_publicar_archivo(p_path text, p_kind text, p_title text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.meryo_publicar_archivo(p_path text, p_kind text, p_title text) TO authenticated;


--
-- Name: FUNCTION meryo_quitar_push(p_endpoint text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.meryo_quitar_push(p_endpoint text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.meryo_quitar_push(p_endpoint text) TO authenticated;


--
-- Name: FUNCTION meryo_registrar_push(p_subscription jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.meryo_registrar_push(p_subscription jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.meryo_registrar_push(p_subscription jsonb) TO authenticated;


--
-- Name: FUNCTION meryo_reservas_config(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.meryo_reservas_config() FROM PUBLIC;
GRANT ALL ON FUNCTION public.meryo_reservas_config() TO anon;
GRANT ALL ON FUNCTION public.meryo_reservas_config() TO authenticated;


--
-- Name: FUNCTION meryo_reservas_estado(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.meryo_reservas_estado() FROM PUBLIC;
GRANT ALL ON FUNCTION public.meryo_reservas_estado() TO authenticated;


--
-- Name: FUNCTION meryo_retirar_archivo(p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.meryo_retirar_archivo(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.meryo_retirar_archivo(p_id uuid) TO authenticated;


--
-- Name: FUNCTION meryo_retirar_bloqueo(p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.meryo_retirar_bloqueo(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.meryo_retirar_bloqueo(p_id uuid) TO authenticated;


--
-- Name: FUNCTION meryo_retirar_tramo(p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.meryo_retirar_tramo(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.meryo_retirar_tramo(p_id uuid) TO authenticated;


--
-- Name: FUNCTION meryo_revocar_invitacion(p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.meryo_revocar_invitacion(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.meryo_revocar_invitacion(p_id uuid) TO authenticated;


--
-- Name: FUNCTION meryo_sesion_activa(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.meryo_sesion_activa() FROM PUBLIC;
GRANT ALL ON FUNCTION public.meryo_sesion_activa() TO authenticated;


--
-- Name: FUNCTION meryo_solicitar_cita(p_barberia_id bigint, p_servicio_id bigint, p_inicio timestamp with time zone, p_nombre text, p_telefono text, p_pedido text, p_extra numeric, p_barbero_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.meryo_solicitar_cita(p_barberia_id bigint, p_servicio_id bigint, p_inicio timestamp with time zone, p_nombre text, p_telefono text, p_pedido text, p_extra numeric, p_barbero_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.meryo_solicitar_cita(p_barberia_id bigint, p_servicio_id bigint, p_inicio timestamp with time zone, p_nombre text, p_telefono text, p_pedido text, p_extra numeric, p_barbero_id uuid) TO authenticated;


--
-- Name: FUNCTION mi_barberia_id(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.mi_barberia_id() FROM PUBLIC;
GRANT ALL ON FUNCTION public.mi_barberia_id() TO anon;
GRANT ALL ON FUNCTION public.mi_barberia_id() TO authenticated;
GRANT ALL ON FUNCTION public.mi_barberia_id() TO service_role;


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


--
-- Name: FUNCTION registrar_barberia(p_nombre text, p_distrito text, p_direccion text, p_descripcion text, p_lat double precision, p_lng double precision, p_whatsapp text, p_correo text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.registrar_barberia(p_nombre text, p_distrito text, p_direccion text, p_descripcion text, p_lat double precision, p_lng double precision, p_whatsapp text, p_correo text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.registrar_barberia(p_nombre text, p_distrito text, p_direccion text, p_descripcion text, p_lat double precision, p_lng double precision, p_whatsapp text, p_correo text) TO authenticated;
GRANT ALL ON FUNCTION public.registrar_barberia(p_nombre text, p_distrito text, p_direccion text, p_descripcion text, p_lat double precision, p_lng double precision, p_whatsapp text, p_correo text) TO service_role;


--
-- Name: FUNCTION registrar_intento_pago_verificado(p_reserva uuid, p_cliente uuid, p_proveedor text, p_referencia text, p_merchant text, p_live boolean, p_metodo text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.registrar_intento_pago_verificado(p_reserva uuid, p_cliente uuid, p_proveedor text, p_referencia text, p_merchant text, p_live boolean, p_metodo text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.registrar_intento_pago_verificado(p_reserva uuid, p_cliente uuid, p_proveedor text, p_referencia text, p_merchant text, p_live boolean, p_metodo text) TO service_role;


--
-- Name: FUNCTION responder_reserva(p_reserva_id uuid, p_aceptar boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.responder_reserva(p_reserva_id uuid, p_aceptar boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.responder_reserva(p_reserva_id uuid, p_aceptar boolean) TO authenticated;


--
-- Name: FUNCTION suspender_barberia(p_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.suspender_barberia(p_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.suspender_barberia(p_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.suspender_barberia(p_id bigint) TO service_role;


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
-- Name: TABLE audit_log_entries; Type: ACL; Schema: auth; Owner: -
--

GRANT SELECT ON TABLE auth.audit_log_entries TO postgres WITH GRANT OPTION;


--
-- Name: TABLE flow_state; Type: ACL; Schema: auth; Owner: -
--

GRANT SELECT ON TABLE auth.flow_state TO postgres WITH GRANT OPTION;


--
-- Name: TABLE identities; Type: ACL; Schema: auth; Owner: -
--

GRANT SELECT ON TABLE auth.identities TO postgres WITH GRANT OPTION;


--
-- Name: TABLE instances; Type: ACL; Schema: auth; Owner: -
--

GRANT SELECT ON TABLE auth.instances TO postgres WITH GRANT OPTION;


--
-- Name: TABLE mfa_amr_claims; Type: ACL; Schema: auth; Owner: -
--

GRANT SELECT ON TABLE auth.mfa_amr_claims TO postgres WITH GRANT OPTION;


--
-- Name: TABLE mfa_challenges; Type: ACL; Schema: auth; Owner: -
--

GRANT SELECT ON TABLE auth.mfa_challenges TO postgres WITH GRANT OPTION;


--
-- Name: TABLE mfa_factors; Type: ACL; Schema: auth; Owner: -
--

GRANT SELECT ON TABLE auth.mfa_factors TO postgres WITH GRANT OPTION;


--
-- Name: TABLE one_time_tokens; Type: ACL; Schema: auth; Owner: -
--

GRANT SELECT ON TABLE auth.one_time_tokens TO postgres WITH GRANT OPTION;


--
-- Name: TABLE refresh_tokens; Type: ACL; Schema: auth; Owner: -
--

GRANT SELECT ON TABLE auth.refresh_tokens TO postgres WITH GRANT OPTION;


--
-- Name: TABLE saml_providers; Type: ACL; Schema: auth; Owner: -
--

GRANT SELECT ON TABLE auth.saml_providers TO postgres WITH GRANT OPTION;


--
-- Name: TABLE saml_relay_states; Type: ACL; Schema: auth; Owner: -
--

GRANT SELECT ON TABLE auth.saml_relay_states TO postgres WITH GRANT OPTION;


--
-- Name: TABLE schema_migrations; Type: ACL; Schema: auth; Owner: -
--

GRANT SELECT ON TABLE auth.schema_migrations TO postgres WITH GRANT OPTION;


--
-- Name: TABLE sessions; Type: ACL; Schema: auth; Owner: -
--

GRANT SELECT ON TABLE auth.sessions TO postgres WITH GRANT OPTION;


--
-- Name: TABLE sso_domains; Type: ACL; Schema: auth; Owner: -
--

GRANT SELECT ON TABLE auth.sso_domains TO postgres WITH GRANT OPTION;


--
-- Name: TABLE sso_providers; Type: ACL; Schema: auth; Owner: -
--

GRANT SELECT ON TABLE auth.sso_providers TO postgres WITH GRANT OPTION;


--
-- Name: TABLE users; Type: ACL; Schema: auth; Owner: -
--

GRANT SELECT ON TABLE auth.users TO postgres WITH GRANT OPTION;


--
-- Name: TABLE launch_settings; Type: ACL; Schema: meryo_private; Owner: -
--

GRANT SELECT,UPDATE ON TABLE meryo_private.launch_settings TO service_role;


--
-- Name: TABLE payment_intents; Type: ACL; Schema: meryo_private; Owner: -
--

GRANT SELECT ON TABLE meryo_private.payment_intents TO service_role;


--
-- Name: TABLE payment_receipts; Type: ACL; Schema: meryo_private; Owner: -
--

GRANT SELECT ON TABLE meryo_private.payment_receipts TO service_role;


--
-- Name: TABLE barberia_media; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.barberia_media TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.barberia_media TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.barberia_media TO service_role;


--
-- Name: COLUMN barberia_media.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.barberia_media TO anon;
GRANT SELECT(id),INSERT(id),UPDATE(id) ON TABLE public.barberia_media TO authenticated;
GRANT ALL(id) ON TABLE public.barberia_media TO service_role;


--
-- Name: COLUMN barberia_media.barberia_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(barberia_id) ON TABLE public.barberia_media TO anon;
GRANT SELECT(barberia_id),INSERT(barberia_id),UPDATE(barberia_id) ON TABLE public.barberia_media TO authenticated;
GRANT ALL(barberia_id) ON TABLE public.barberia_media TO service_role;


--
-- Name: COLUMN barberia_media.tipo; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(tipo) ON TABLE public.barberia_media TO anon;
GRANT SELECT(tipo),INSERT(tipo),UPDATE(tipo) ON TABLE public.barberia_media TO authenticated;
GRANT ALL(tipo) ON TABLE public.barberia_media TO service_role;


--
-- Name: COLUMN barberia_media.url; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(url) ON TABLE public.barberia_media TO anon;
GRANT SELECT(url),INSERT(url),UPDATE(url) ON TABLE public.barberia_media TO authenticated;
GRANT ALL(url) ON TABLE public.barberia_media TO service_role;


--
-- Name: COLUMN barberia_media.titulo; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(titulo) ON TABLE public.barberia_media TO anon;
GRANT SELECT(titulo),INSERT(titulo),UPDATE(titulo) ON TABLE public.barberia_media TO authenticated;
GRANT ALL(titulo) ON TABLE public.barberia_media TO service_role;


--
-- Name: COLUMN barberia_media.orden; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(orden) ON TABLE public.barberia_media TO anon;
GRANT SELECT(orden),INSERT(orden),UPDATE(orden) ON TABLE public.barberia_media TO authenticated;
GRANT ALL(orden) ON TABLE public.barberia_media TO service_role;


--
-- Name: COLUMN barberia_media.created_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(created_at) ON TABLE public.barberia_media TO anon;
GRANT SELECT(created_at),INSERT(created_at),UPDATE(created_at) ON TABLE public.barberia_media TO authenticated;
GRANT ALL(created_at) ON TABLE public.barberia_media TO service_role;


--
-- Name: SEQUENCE barberia_media_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT USAGE ON SEQUENCE public.barberia_media_id_seq TO authenticated;


--
-- Name: TABLE barberias; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.barberias TO anon;
GRANT SELECT ON TABLE public.barberias TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.barberias TO service_role;


--
-- Name: COLUMN barberias.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.barberias TO anon;
GRANT SELECT(id) ON TABLE public.barberias TO authenticated;
GRANT ALL(id) ON TABLE public.barberias TO service_role;


--
-- Name: COLUMN barberias.nombre; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(nombre) ON TABLE public.barberias TO anon;
GRANT SELECT(nombre) ON TABLE public.barberias TO authenticated;
GRANT ALL(nombre) ON TABLE public.barberias TO service_role;


--
-- Name: COLUMN barberias.distrito; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(distrito) ON TABLE public.barberias TO anon;
GRANT SELECT(distrito) ON TABLE public.barberias TO authenticated;
GRANT ALL(distrito) ON TABLE public.barberias TO service_role;


--
-- Name: COLUMN barberias.direccion; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(direccion) ON TABLE public.barberias TO anon;
GRANT SELECT(direccion) ON TABLE public.barberias TO authenticated;
GRANT ALL(direccion) ON TABLE public.barberias TO service_role;


--
-- Name: COLUMN barberias.descripcion; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(descripcion) ON TABLE public.barberias TO anon;
GRANT SELECT(descripcion) ON TABLE public.barberias TO authenticated;
GRANT ALL(descripcion) ON TABLE public.barberias TO service_role;


--
-- Name: COLUMN barberias.imagen_url; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(imagen_url) ON TABLE public.barberias TO anon;
GRANT SELECT(imagen_url) ON TABLE public.barberias TO authenticated;
GRANT ALL(imagen_url) ON TABLE public.barberias TO service_role;


--
-- Name: COLUMN barberias.rating; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(rating) ON TABLE public.barberias TO anon;
GRANT SELECT(rating) ON TABLE public.barberias TO authenticated;
GRANT ALL(rating) ON TABLE public.barberias TO service_role;


--
-- Name: COLUMN barberias.total_resenas; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(total_resenas) ON TABLE public.barberias TO anon;
GRANT SELECT(total_resenas) ON TABLE public.barberias TO authenticated;
GRANT ALL(total_resenas) ON TABLE public.barberias TO service_role;


--
-- Name: COLUMN barberias.precio_desde; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(precio_desde) ON TABLE public.barberias TO anon;
GRANT SELECT(precio_desde) ON TABLE public.barberias TO authenticated;
GRANT ALL(precio_desde) ON TABLE public.barberias TO service_role;


--
-- Name: COLUMN barberias.estado; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(estado) ON TABLE public.barberias TO anon;
GRANT SELECT(estado) ON TABLE public.barberias TO authenticated;
GRANT ALL(estado) ON TABLE public.barberias TO service_role;


--
-- Name: COLUMN barberias.verificada; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(verificada) ON TABLE public.barberias TO anon;
GRANT SELECT(verificada) ON TABLE public.barberias TO authenticated;
GRANT ALL(verificada) ON TABLE public.barberias TO service_role;


--
-- Name: COLUMN barberias.lat; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(lat) ON TABLE public.barberias TO anon;
GRANT SELECT(lat) ON TABLE public.barberias TO authenticated;
GRANT ALL(lat) ON TABLE public.barberias TO service_role;


--
-- Name: COLUMN barberias.lng; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(lng) ON TABLE public.barberias TO anon;
GRANT SELECT(lng) ON TABLE public.barberias TO authenticated;
GRANT ALL(lng) ON TABLE public.barberias TO service_role;


--
-- Name: COLUMN barberias.whatsapp; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(whatsapp) ON TABLE public.barberias TO anon;
GRANT SELECT(whatsapp) ON TABLE public.barberias TO authenticated;
GRANT ALL(whatsapp) ON TABLE public.barberias TO service_role;


--
-- Name: COLUMN barberias.correo_contacto; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(correo_contacto) ON TABLE public.barberias TO anon;
GRANT SELECT(correo_contacto) ON TABLE public.barberias TO authenticated;
GRANT ALL(correo_contacto) ON TABLE public.barberias TO service_role;


--
-- Name: COLUMN barberias.video_presentacion_url; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(video_presentacion_url) ON TABLE public.barberias TO anon;
GRANT SELECT(video_presentacion_url) ON TABLE public.barberias TO authenticated;
GRANT ALL(video_presentacion_url) ON TABLE public.barberias TO service_role;


--
-- Name: COLUMN barberias.acepta_auto; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(acepta_auto) ON TABLE public.barberias TO anon;
GRANT SELECT(acepta_auto) ON TABLE public.barberias TO authenticated;
GRANT ALL(acepta_auto) ON TABLE public.barberias TO service_role;


--
-- Name: COLUMN barberias.disponible_ahora; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(disponible_ahora) ON TABLE public.barberias TO anon;
GRANT SELECT(disponible_ahora) ON TABLE public.barberias TO authenticated;
GRANT ALL(disponible_ahora) ON TABLE public.barberias TO service_role;


--
-- Name: COLUMN barberias.created_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(created_at) ON TABLE public.barberias TO anon;
GRANT SELECT(created_at) ON TABLE public.barberias TO authenticated;
GRANT ALL(created_at) ON TABLE public.barberias TO service_role;


--
-- Name: TABLE bloqueos; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.bloqueos TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.bloqueos TO service_role;


--
-- Name: COLUMN bloqueos.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id),INSERT(id),UPDATE(id) ON TABLE public.bloqueos TO authenticated;
GRANT ALL(id) ON TABLE public.bloqueos TO service_role;


--
-- Name: COLUMN bloqueos.barberia_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(barberia_id),INSERT(barberia_id),UPDATE(barberia_id) ON TABLE public.bloqueos TO authenticated;
GRANT ALL(barberia_id) ON TABLE public.bloqueos TO service_role;


--
-- Name: COLUMN bloqueos.inicio; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(inicio),INSERT(inicio),UPDATE(inicio) ON TABLE public.bloqueos TO authenticated;
GRANT ALL(inicio) ON TABLE public.bloqueos TO service_role;


--
-- Name: COLUMN bloqueos.fin; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(fin),INSERT(fin),UPDATE(fin) ON TABLE public.bloqueos TO authenticated;
GRANT ALL(fin) ON TABLE public.bloqueos TO service_role;


--
-- Name: COLUMN bloqueos.motivo; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(motivo),INSERT(motivo),UPDATE(motivo) ON TABLE public.bloqueos TO authenticated;
GRANT ALL(motivo) ON TABLE public.bloqueos TO service_role;


--
-- Name: COLUMN bloqueos.created_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(created_at),INSERT(created_at),UPDATE(created_at) ON TABLE public.bloqueos TO authenticated;
GRANT ALL(created_at) ON TABLE public.bloqueos TO service_role;


--
-- Name: SEQUENCE bloqueos_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT USAGE ON SEQUENCE public.bloqueos_id_seq TO authenticated;


--
-- Name: TABLE configuracion; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.configuracion TO anon;
GRANT SELECT ON TABLE public.configuracion TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.configuracion TO service_role;


--
-- Name: COLUMN configuracion.clave; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(clave) ON TABLE public.configuracion TO anon;
GRANT SELECT(clave) ON TABLE public.configuracion TO authenticated;
GRANT ALL(clave) ON TABLE public.configuracion TO service_role;


--
-- Name: COLUMN configuracion.valor; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(valor) ON TABLE public.configuracion TO anon;
GRANT SELECT(valor),UPDATE(valor) ON TABLE public.configuracion TO authenticated;
GRANT ALL(valor) ON TABLE public.configuracion TO service_role;


--
-- Name: COLUMN configuracion.descripcion; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(descripcion) ON TABLE public.configuracion TO anon;
GRANT SELECT(descripcion) ON TABLE public.configuracion TO authenticated;
GRANT ALL(descripcion) ON TABLE public.configuracion TO service_role;


--
-- Name: TABLE horarios; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.horarios TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.horarios TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.horarios TO service_role;


--
-- Name: COLUMN horarios.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.horarios TO anon;
GRANT SELECT(id),INSERT(id),UPDATE(id) ON TABLE public.horarios TO authenticated;
GRANT ALL(id) ON TABLE public.horarios TO service_role;


--
-- Name: COLUMN horarios.barberia_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(barberia_id) ON TABLE public.horarios TO anon;
GRANT SELECT(barberia_id),INSERT(barberia_id),UPDATE(barberia_id) ON TABLE public.horarios TO authenticated;
GRANT ALL(barberia_id) ON TABLE public.horarios TO service_role;


--
-- Name: COLUMN horarios.dia_semana; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(dia_semana) ON TABLE public.horarios TO anon;
GRANT SELECT(dia_semana),INSERT(dia_semana),UPDATE(dia_semana) ON TABLE public.horarios TO authenticated;
GRANT ALL(dia_semana) ON TABLE public.horarios TO service_role;


--
-- Name: COLUMN horarios.hora_apertura; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(hora_apertura) ON TABLE public.horarios TO anon;
GRANT SELECT(hora_apertura),INSERT(hora_apertura),UPDATE(hora_apertura) ON TABLE public.horarios TO authenticated;
GRANT ALL(hora_apertura) ON TABLE public.horarios TO service_role;


--
-- Name: COLUMN horarios.hora_cierre; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(hora_cierre) ON TABLE public.horarios TO anon;
GRANT SELECT(hora_cierre),INSERT(hora_cierre),UPDATE(hora_cierre) ON TABLE public.horarios TO authenticated;
GRANT ALL(hora_cierre) ON TABLE public.horarios TO service_role;


--
-- Name: SEQUENCE horarios_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT USAGE ON SEQUENCE public.horarios_id_seq TO authenticated;


--
-- Name: TABLE meryo_shop_assets; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.meryo_shop_assets TO anon;
GRANT SELECT ON TABLE public.meryo_shop_assets TO authenticated;


--
-- Name: TABLE notificaciones; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.notificaciones TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.notificaciones TO service_role;


--
-- Name: COLUMN notificaciones.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.notificaciones TO authenticated;
GRANT ALL(id) ON TABLE public.notificaciones TO service_role;


--
-- Name: COLUMN notificaciones.user_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(user_id) ON TABLE public.notificaciones TO authenticated;
GRANT ALL(user_id) ON TABLE public.notificaciones TO service_role;


--
-- Name: COLUMN notificaciones.titulo; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(titulo) ON TABLE public.notificaciones TO authenticated;
GRANT ALL(titulo) ON TABLE public.notificaciones TO service_role;


--
-- Name: COLUMN notificaciones.mensaje; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(mensaje) ON TABLE public.notificaciones TO authenticated;
GRANT ALL(mensaje) ON TABLE public.notificaciones TO service_role;


--
-- Name: COLUMN notificaciones.leida; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(leida),UPDATE(leida) ON TABLE public.notificaciones TO authenticated;
GRANT ALL(leida) ON TABLE public.notificaciones TO service_role;


--
-- Name: COLUMN notificaciones.created_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(created_at) ON TABLE public.notificaciones TO authenticated;
GRANT ALL(created_at) ON TABLE public.notificaciones TO service_role;


--
-- Name: COLUMN notificaciones.tipo; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(tipo) ON TABLE public.notificaciones TO authenticated;
GRANT ALL(tipo) ON TABLE public.notificaciones TO service_role;


--
-- Name: COLUMN notificaciones.reserva_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(reserva_id) ON TABLE public.notificaciones TO authenticated;
GRANT ALL(reserva_id) ON TABLE public.notificaciones TO service_role;


--
-- Name: TABLE pagos; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.pagos TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.pagos TO service_role;


--
-- Name: COLUMN pagos.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.pagos TO authenticated;
GRANT ALL(id) ON TABLE public.pagos TO service_role;


--
-- Name: COLUMN pagos.reserva_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(reserva_id) ON TABLE public.pagos TO authenticated;
GRANT ALL(reserva_id) ON TABLE public.pagos TO service_role;


--
-- Name: COLUMN pagos.monto; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(monto) ON TABLE public.pagos TO authenticated;
GRANT ALL(monto) ON TABLE public.pagos TO service_role;


--
-- Name: COLUMN pagos.moneda; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(moneda) ON TABLE public.pagos TO authenticated;
GRANT ALL(moneda) ON TABLE public.pagos TO service_role;


--
-- Name: COLUMN pagos.metodo; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(metodo) ON TABLE public.pagos TO authenticated;
GRANT ALL(metodo) ON TABLE public.pagos TO service_role;


--
-- Name: COLUMN pagos.proveedor; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(proveedor) ON TABLE public.pagos TO authenticated;
GRANT ALL(proveedor) ON TABLE public.pagos TO service_role;


--
-- Name: COLUMN pagos.proveedor_ref; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(proveedor_ref) ON TABLE public.pagos TO authenticated;
GRANT ALL(proveedor_ref) ON TABLE public.pagos TO service_role;


--
-- Name: COLUMN pagos.estado; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(estado) ON TABLE public.pagos TO authenticated;
GRANT ALL(estado) ON TABLE public.pagos TO service_role;


--
-- Name: COLUMN pagos.comision_plataforma; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(comision_plataforma) ON TABLE public.pagos TO authenticated;
GRANT ALL(comision_plataforma) ON TABLE public.pagos TO service_role;


--
-- Name: COLUMN pagos.created_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(created_at) ON TABLE public.pagos TO authenticated;
GRANT ALL(created_at) ON TABLE public.pagos TO service_role;


--
-- Name: COLUMN pagos.pagado_en; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(pagado_en) ON TABLE public.pagos TO authenticated;
GRANT ALL(pagado_en) ON TABLE public.pagos TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.profiles TO service_role;


--
-- Name: COLUMN profiles.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.profiles TO authenticated;
GRANT ALL(id) ON TABLE public.profiles TO service_role;


--
-- Name: COLUMN profiles.email; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(email) ON TABLE public.profiles TO authenticated;
GRANT ALL(email) ON TABLE public.profiles TO service_role;


--
-- Name: COLUMN profiles.rol; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(rol) ON TABLE public.profiles TO authenticated;
GRANT ALL(rol) ON TABLE public.profiles TO service_role;


--
-- Name: COLUMN profiles.barberia_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(barberia_id) ON TABLE public.profiles TO authenticated;
GRANT ALL(barberia_id) ON TABLE public.profiles TO service_role;


--
-- Name: COLUMN profiles.activo; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(activo) ON TABLE public.profiles TO authenticated;
GRANT ALL(activo) ON TABLE public.profiles TO service_role;


--
-- Name: COLUMN profiles.nombre; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(nombre),UPDATE(nombre) ON TABLE public.profiles TO authenticated;
GRANT ALL(nombre) ON TABLE public.profiles TO service_role;


--
-- Name: COLUMN profiles.telefono; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(telefono),UPDATE(telefono) ON TABLE public.profiles TO authenticated;
GRANT ALL(telefono) ON TABLE public.profiles TO service_role;


--
-- Name: TABLE resenas; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.resenas TO anon;
GRANT SELECT ON TABLE public.resenas TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.resenas TO service_role;


--
-- Name: COLUMN resenas.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.resenas TO anon;
GRANT SELECT(id) ON TABLE public.resenas TO authenticated;
GRANT ALL(id) ON TABLE public.resenas TO service_role;


--
-- Name: COLUMN resenas.barberia_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(barberia_id) ON TABLE public.resenas TO anon;
GRANT SELECT(barberia_id) ON TABLE public.resenas TO authenticated;
GRANT ALL(barberia_id) ON TABLE public.resenas TO service_role;


--
-- Name: COLUMN resenas.reserva_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(reserva_id) ON TABLE public.resenas TO anon;
GRANT SELECT(reserva_id) ON TABLE public.resenas TO authenticated;
GRANT ALL(reserva_id) ON TABLE public.resenas TO service_role;


--
-- Name: COLUMN resenas.cliente_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(cliente_id) ON TABLE public.resenas TO anon;
GRANT SELECT(cliente_id) ON TABLE public.resenas TO authenticated;
GRANT ALL(cliente_id) ON TABLE public.resenas TO service_role;


--
-- Name: COLUMN resenas.autor; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(autor) ON TABLE public.resenas TO anon;
GRANT SELECT(autor) ON TABLE public.resenas TO authenticated;
GRANT ALL(autor) ON TABLE public.resenas TO service_role;


--
-- Name: COLUMN resenas.calificacion; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(calificacion) ON TABLE public.resenas TO anon;
GRANT SELECT(calificacion) ON TABLE public.resenas TO authenticated;
GRANT ALL(calificacion) ON TABLE public.resenas TO service_role;


--
-- Name: COLUMN resenas.comentario; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(comentario) ON TABLE public.resenas TO anon;
GRANT SELECT(comentario) ON TABLE public.resenas TO authenticated;
GRANT ALL(comentario) ON TABLE public.resenas TO service_role;


--
-- Name: COLUMN resenas.created_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(created_at) ON TABLE public.resenas TO anon;
GRANT SELECT(created_at) ON TABLE public.resenas TO authenticated;
GRANT ALL(created_at) ON TABLE public.resenas TO service_role;


--
-- Name: TABLE reservas; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.reservas TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.reservas TO service_role;


--
-- Name: COLUMN reservas.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.reservas TO authenticated;
GRANT ALL(id) ON TABLE public.reservas TO service_role;


--
-- Name: COLUMN reservas.barberia_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(barberia_id) ON TABLE public.reservas TO authenticated;
GRANT ALL(barberia_id) ON TABLE public.reservas TO service_role;


--
-- Name: COLUMN reservas.servicio_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(servicio_id) ON TABLE public.reservas TO authenticated;
GRANT ALL(servicio_id) ON TABLE public.reservas TO service_role;


--
-- Name: COLUMN reservas.cliente_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(cliente_id) ON TABLE public.reservas TO authenticated;
GRANT ALL(cliente_id) ON TABLE public.reservas TO service_role;


--
-- Name: COLUMN reservas.cliente_nombre; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(cliente_nombre) ON TABLE public.reservas TO authenticated;
GRANT ALL(cliente_nombre) ON TABLE public.reservas TO service_role;


--
-- Name: COLUMN reservas.cliente_telefono; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(cliente_telefono) ON TABLE public.reservas TO authenticated;
GRANT ALL(cliente_telefono) ON TABLE public.reservas TO service_role;


--
-- Name: COLUMN reservas.servicio_nombre; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(servicio_nombre) ON TABLE public.reservas TO authenticated;
GRANT ALL(servicio_nombre) ON TABLE public.reservas TO service_role;


--
-- Name: COLUMN reservas.duracion_min; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(duracion_min) ON TABLE public.reservas TO authenticated;
GRANT ALL(duracion_min) ON TABLE public.reservas TO service_role;


--
-- Name: COLUMN reservas.inicio; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(inicio) ON TABLE public.reservas TO authenticated;
GRANT ALL(inicio) ON TABLE public.reservas TO service_role;


--
-- Name: COLUMN reservas.fin; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(fin) ON TABLE public.reservas TO authenticated;
GRANT ALL(fin) ON TABLE public.reservas TO service_role;


--
-- Name: COLUMN reservas.pedido_especial; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(pedido_especial) ON TABLE public.reservas TO authenticated;
GRANT ALL(pedido_especial) ON TABLE public.reservas TO service_role;


--
-- Name: COLUMN reservas.extra_personalizacion; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(extra_personalizacion) ON TABLE public.reservas TO authenticated;
GRANT ALL(extra_personalizacion) ON TABLE public.reservas TO service_role;


--
-- Name: COLUMN reservas.precio_total; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(precio_total) ON TABLE public.reservas TO authenticated;
GRANT ALL(precio_total) ON TABLE public.reservas TO service_role;


--
-- Name: COLUMN reservas.monto_adelanto; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(monto_adelanto) ON TABLE public.reservas TO authenticated;
GRANT ALL(monto_adelanto) ON TABLE public.reservas TO service_role;


--
-- Name: COLUMN reservas.estado; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(estado) ON TABLE public.reservas TO authenticated;
GRANT ALL(estado) ON TABLE public.reservas TO service_role;


--
-- Name: COLUMN reservas.expira_respuesta_en; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(expira_respuesta_en) ON TABLE public.reservas TO authenticated;
GRANT ALL(expira_respuesta_en) ON TABLE public.reservas TO service_role;


--
-- Name: COLUMN reservas.expira_pago_en; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(expira_pago_en) ON TABLE public.reservas TO authenticated;
GRANT ALL(expira_pago_en) ON TABLE public.reservas TO service_role;


--
-- Name: COLUMN reservas.aceptada_en; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(aceptada_en) ON TABLE public.reservas TO authenticated;
GRANT ALL(aceptada_en) ON TABLE public.reservas TO service_role;


--
-- Name: COLUMN reservas.pagada_en; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(pagada_en) ON TABLE public.reservas TO authenticated;
GRANT ALL(pagada_en) ON TABLE public.reservas TO service_role;


--
-- Name: COLUMN reservas.cerrada_en; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(cerrada_en) ON TABLE public.reservas TO authenticated;
GRANT ALL(cerrada_en) ON TABLE public.reservas TO service_role;


--
-- Name: COLUMN reservas.created_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(created_at) ON TABLE public.reservas TO authenticated;
GRANT ALL(created_at) ON TABLE public.reservas TO service_role;


--
-- Name: TABLE reservas_legacy; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.reservas_legacy TO service_role;


--
-- Name: COLUMN reservas_legacy.id; Type: ACL; Schema: public; Owner: -
--

GRANT ALL(id) ON TABLE public.reservas_legacy TO service_role;


--
-- Name: COLUMN reservas_legacy.shop_id; Type: ACL; Schema: public; Owner: -
--

GRANT ALL(shop_id) ON TABLE public.reservas_legacy TO service_role;


--
-- Name: COLUMN reservas_legacy.cliente; Type: ACL; Schema: public; Owner: -
--

GRANT ALL(cliente) ON TABLE public.reservas_legacy TO service_role;


--
-- Name: COLUMN reservas_legacy.servicio; Type: ACL; Schema: public; Owner: -
--

GRANT ALL(servicio) ON TABLE public.reservas_legacy TO service_role;


--
-- Name: COLUMN reservas_legacy.fecha; Type: ACL; Schema: public; Owner: -
--

GRANT ALL(fecha) ON TABLE public.reservas_legacy TO service_role;


--
-- Name: COLUMN reservas_legacy.hora; Type: ACL; Schema: public; Owner: -
--

GRANT ALL(hora) ON TABLE public.reservas_legacy TO service_role;


--
-- Name: COLUMN reservas_legacy.pedido; Type: ACL; Schema: public; Owner: -
--

GRANT ALL(pedido) ON TABLE public.reservas_legacy TO service_role;


--
-- Name: COLUMN reservas_legacy.total; Type: ACL; Schema: public; Owner: -
--

GRANT ALL(total) ON TABLE public.reservas_legacy TO service_role;


--
-- Name: COLUMN reservas_legacy.created_at; Type: ACL; Schema: public; Owner: -
--

GRANT ALL(created_at) ON TABLE public.reservas_legacy TO service_role;


--
-- Name: COLUMN reservas_legacy.estado; Type: ACL; Schema: public; Owner: -
--

GRANT ALL(estado) ON TABLE public.reservas_legacy TO service_role;


--
-- Name: COLUMN reservas_legacy.fecha_creacion; Type: ACL; Schema: public; Owner: -
--

GRANT ALL(fecha_creacion) ON TABLE public.reservas_legacy TO service_role;


--
-- Name: COLUMN reservas_legacy.expira_en; Type: ACL; Schema: public; Owner: -
--

GRANT ALL(expira_en) ON TABLE public.reservas_legacy TO service_role;


--
-- Name: COLUMN reservas_legacy.cliente_id; Type: ACL; Schema: public; Owner: -
--

GRANT ALL(cliente_id) ON TABLE public.reservas_legacy TO service_role;


--
-- Name: TABLE servicios; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.servicios TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.servicios TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.servicios TO service_role;


--
-- Name: COLUMN servicios.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.servicios TO anon;
GRANT SELECT(id),INSERT(id),UPDATE(id) ON TABLE public.servicios TO authenticated;
GRANT ALL(id) ON TABLE public.servicios TO service_role;


--
-- Name: COLUMN servicios.barberia_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(barberia_id) ON TABLE public.servicios TO anon;
GRANT SELECT(barberia_id),INSERT(barberia_id),UPDATE(barberia_id) ON TABLE public.servicios TO authenticated;
GRANT ALL(barberia_id) ON TABLE public.servicios TO service_role;


--
-- Name: COLUMN servicios.nombre; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(nombre) ON TABLE public.servicios TO anon;
GRANT SELECT(nombre),INSERT(nombre),UPDATE(nombre) ON TABLE public.servicios TO authenticated;
GRANT ALL(nombre) ON TABLE public.servicios TO service_role;


--
-- Name: COLUMN servicios.descripcion; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(descripcion) ON TABLE public.servicios TO anon;
GRANT SELECT(descripcion),INSERT(descripcion),UPDATE(descripcion) ON TABLE public.servicios TO authenticated;
GRANT ALL(descripcion) ON TABLE public.servicios TO service_role;


--
-- Name: COLUMN servicios.precio; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(precio) ON TABLE public.servicios TO anon;
GRANT SELECT(precio),INSERT(precio),UPDATE(precio) ON TABLE public.servicios TO authenticated;
GRANT ALL(precio) ON TABLE public.servicios TO service_role;


--
-- Name: COLUMN servicios.duracion_min; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(duracion_min) ON TABLE public.servicios TO anon;
GRANT SELECT(duracion_min),INSERT(duracion_min),UPDATE(duracion_min) ON TABLE public.servicios TO authenticated;
GRANT ALL(duracion_min) ON TABLE public.servicios TO service_role;


--
-- Name: COLUMN servicios.activo; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(activo) ON TABLE public.servicios TO anon;
GRANT SELECT(activo),INSERT(activo),UPDATE(activo) ON TABLE public.servicios TO authenticated;
GRANT ALL(activo) ON TABLE public.servicios TO service_role;


--
-- Name: COLUMN servicios.created_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(created_at) ON TABLE public.servicios TO anon;
GRANT SELECT(created_at),INSERT(created_at),UPDATE(created_at) ON TABLE public.servicios TO authenticated;
GRANT ALL(created_at) ON TABLE public.servicios TO service_role;


--
-- Name: SEQUENCE servicios_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT USAGE ON SEQUENCE public.servicios_id_seq TO authenticated;


--
-- Name: TABLE objects; Type: ACL; Schema: storage; Owner: -
--

GRANT SELECT ON TABLE storage.objects TO anon;
GRANT SELECT,INSERT ON TABLE storage.objects TO authenticated;


--
-- PostgreSQL database dump complete
--



