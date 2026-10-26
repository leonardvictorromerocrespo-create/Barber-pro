-- Incremental from 001/002; apply ONLY after comparing the destination contract.
-- Acceptance window changes only NEW requests. Historical reservations/payments remain intact.
begin;
do $$ begin
 if to_regclass('meryo_private.launch_settings') is null or not exists(select 1 from pg_constraint where conrelid='public.reservas'::regclass and conname='reservas_sin_cruce') then raise exception 'Missing manual booking baseline'; end if;
end $$;
alter table meryo_private.launch_settings alter column plazo_pago_segundos drop not null,
 alter column plazo_pago_segundos drop default,
 add column modelo_comercial text not null default 'mensualidad' check(modelo_comercial='mensualidad'),
 add column precios_planes_propuestos jsonb,
 add column push_public_key text;
-- An undecided payment deadline is NULL, never an invented default. Existing booking deadlines are retained.
update meryo_private.launch_settings set plazo_pago_segundos=null;
-- Preserve applied migration history and old payment rows. If the optional
-- verified-payment contract is already installed, NEW receipts carry zero fee.
do $monthly$
declare source text;
begin
 if to_regprocedure('public.confirmar_pago_verificado(uuid,text,text,text,bigint,text,boolean)') is not null then
  source:=pg_get_functiondef('public.confirmar_pago_verificado(uuid,text,text,text,bigint,text,boolean)'::regprocedure);
  if position('s.comision_centimos/100.0' in source)=0 then raise exception 'Payment function drift: compare before changing'; end if;
  execute replace(source,'s.comision_centimos/100.0','0');
 end if;
end $monthly$;
insert into public.configuracion(clave,valor) values('minutos_anticipacion_minima','30'),('paso_minutos','30'),('max_reservas_pendientes','2') on conflict(clave) do nothing;
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
  if coalesce(p_extra, 0) <> 0 then raise exception 'El cliente no puede asignarse recargos'; end if;

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

  v_total := v_serv.precio;
  v_adelanto := round(v_total * 0.5, 2);
  v_estado := 'solicitada'; -- Acceptance is always manual.

  begin
    insert into public.reservas (barberia_id, servicio_id, cliente_id, cliente_nombre, cliente_telefono,
      servicio_nombre, duracion_min, inicio, fin, pedido_especial, extra_personalizacion,
      precio_total, monto_adelanto, estado, expira_respuesta_en, expira_pago_en, aceptada_en)
    values (p_barberia_id, p_servicio_id, v_uid, p_nombre, p_telefono,
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
      'Tu solicitud fue aceptada. Adelanto del 50 %: S/ ' || v_r.monto_adelanto || '. Pago bloqueado hasta integrar la pasarela. Plazo de pago pendiente de definir.',
      'reserva_aceptada', v_r.id);
    return 'aceptada';
  end if;

  update public.reservas set estado = 'rechazada', cerrada_en = clock_timestamp(), expira_respuesta_en = null where id = v_r.id;
  perform public.notificar(v_r.cliente_id, 'Reserva rechazada', 'La barberia no puede atenderte a esa hora. Elige otra.', 'reserva_rechazada', v_r.id);
  return 'rechazada';
end;
$function$
;

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
  if not exists (select 1 from public.barberias b where b.id = p_barberia_id and b.verificada and b.estado='activa' and b.disponible_ahora) then return; end if;

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
             or (r.estado = 'aceptada' and (r.expira_pago_en is null or r.expira_pago_en > now()))))
    and not exists (
      select 1 from public.bloqueos bl
      where bl.barberia_id = p_barberia_id
        and tstzrange(bl.inicio, bl.fin, '[)') && tstzrange(g.t, g.t + make_interval(mins => v_dur), '[)'))
  order by 1;
end;
$function$
;
-- Server clock and RLS-protected snapshot; browser time never decides a transition.
create function public.meryo_reservas_estado() returns jsonb language sql volatile security invoker set search_path='' as $$
 select jsonb_build_object('server_now',clock_timestamp(),'reservas',coalesce(jsonb_agg(
  to_jsonb(r)||jsonb_build_object('barberias',jsonb_build_object('nombre',b.nombre),
  'pagos',(select coalesce(jsonb_agg(jsonb_build_object('proveedor',p.proveedor,'estado',p.estado)),'[]'::jsonb) from public.pagos p where p.reserva_id=r.id))
  order by (r.estado in ('solicitada','aceptada')) desc,r.inicio desc),'[]'::jsonb))
 from public.reservas r join public.barberias b on b.id=r.barberia_id
 where r.cliente_id=(select auth.uid()) or r.barberia_id=public.mi_barberia_id();
$$;
revoke all on function public.meryo_reservas_estado() from public,anon;
grant execute on function public.meryo_reservas_estado() to authenticated;

create function public.meryo_reservas_config() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('respuesta_segundos',900,'plazo_pago_segundos',plazo_pago_segundos,
 'modelo_comercial',modelo_comercial,'comision_por_corte',0,'cobros_habilitados',false,
 'push_disponible',false,'push_public_key',null) from meryo_private.launch_settings where id=1;
$$;
revoke all on function public.meryo_reservas_config() from public;
grant execute on function public.meryo_reservas_config() to anon,authenticated;

-- Push preparation: transactional queue for both barber and customer events.
-- No sender/provider is enabled and no queued event is claimed as delivered.
create table meryo_private.push_subscriptions (
 endpoint text primary key check(endpoint ~ '^https://' and length(endpoint)<=2048),
 user_id uuid not null references auth.users(id),
 p256dh text not null, auth text not null,
 updated_at timestamptz not null default clock_timestamp()
);
create table meryo_private.push_outbox (
 id bigint generated always as identity primary key,
 notification_id bigint not null unique references public.notificaciones(id),
 user_id uuid not null references auth.users(id),
 event text not null, reserva_id uuid references public.reservas(id),
 created_at timestamptz not null default clock_timestamp(),
 status text not null default 'pending_provider' check(status in ('pending_provider','queued','accepted','expired','failed'))
);
revoke all on meryo_private.push_subscriptions,meryo_private.push_outbox from public,anon,authenticated,service_role;
create function meryo_private.queue_push() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.tipo in ('reserva_solicitada','reserva_aceptada','reserva_rechazada','reserva_expirada','reserva_confirmada') then
  insert into meryo_private.push_outbox(notification_id,user_id,event,reserva_id) values(new.id,new.user_id,new.tipo,new.reserva_id);
 end if;
 return new;
end $$;
revoke all on function meryo_private.queue_push() from public,anon,authenticated,service_role;
create trigger meryo_queue_push after insert on public.notificaciones for each row execute function meryo_private.queue_push();

create function public.meryo_registrar_push(p_subscription jsonb) returns boolean language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); ep text:=p_subscription->>'endpoint'; pk text:=p_subscription->'keys'->>'p256dh'; ak text:=p_subscription->'keys'->>'auth';
begin
 if uid is null or not public.meryo_cuenta_activa() then raise exception 'No autorizado' using errcode='42501'; end if;
 if ep is null or ep !~ '^https://' or length(ep)>2048 or pk is null or pk !~ '^[A-Za-z0-9_-]{80,150}$' or ak is null or ak !~ '^[A-Za-z0-9_-]{20,30}$' then raise exception 'Suscripcion invalida'; end if;
 insert into meryo_private.push_subscriptions(endpoint,user_id,p256dh,auth) values(ep,uid,pk,ak)
 on conflict(endpoint) do update set p256dh=excluded.p256dh,auth=excluded.auth,updated_at=clock_timestamp()
 where meryo_private.push_subscriptions.user_id=uid;
 if not found then raise exception 'Suscripcion pertenece a otra cuenta' using errcode='42501'; end if;
 return true;
end $$;
revoke all on function public.meryo_registrar_push(jsonb) from public,anon;
grant execute on function public.meryo_registrar_push(jsonb) to authenticated;

-- Expiration is callable only by a server worker, never as a browser maintenance task.
revoke all on function public.expirar_reservas_vencidas() from public,anon,authenticated;
grant execute on function public.expirar_reservas_vencidas() to service_role;
notify pgrst,'reload schema';
commit;
