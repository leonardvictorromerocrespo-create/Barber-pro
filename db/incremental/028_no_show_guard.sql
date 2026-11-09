begin;

-- Keep a durable, explicit arrival marker separate from appointment completion.
alter table public.reservas add column if not exists llegada_en timestamptz;

create or replace function meryo_private.marcar_llegada(p_reserva_id uuid)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare v_bar bigint:=public.mi_barberia_id(); v_r public.reservas%rowtype; v_arrival timestamptz;
begin
  if not public.meryo_cuenta_activa() then raise exception 'Sesion inactiva' using errcode='42501'; end if;
  if v_bar is null then raise exception 'No autorizado' using errcode='42501'; end if;
  select * into v_r from public.reservas where id=p_reserva_id and barberia_id=v_bar for update;
  if not found then raise exception 'Reserva no encontrada'; end if;
  if not public.meryo_es_cita_asignada(v_r.barbero_id) then
    raise exception 'Solo el profesional asignado puede registrar la llegada' using errcode='42501';
  end if;
  if v_r.estado<>'confirmada' then raise exception 'Solo se registra llegada para una cita confirmada'; end if;
  if v_r.llegada_en is not null then return v_r.llegada_en; end if;
  update public.reservas set llegada_en=clock_timestamp() where id=v_r.id returning llegada_en into v_arrival;
  return v_arrival;
end;
$$;
revoke all on function meryo_private.marcar_llegada(uuid) from public,anon,authenticated;

create or replace function public.marcar_llegada(p_reserva_id uuid)
returns timestamptz language plpgsql security definer set search_path='' as $$
begin
  perform meryo_private.require_booking_member(p_reserva_id);
  return meryo_private.marcar_llegada(p_reserva_id);
end;
$$;
revoke all on function public.marcar_llegada(uuid) from public,anon;
grant execute on function public.marcar_llegada(uuid) to authenticated;

-- Preserve the existing attended-completion path. A no-show is a separate,
-- explicit barber action and must never change a verified payment row.
create or replace function meryo_private.marcar_asistencia(p_reserva_id uuid,p_asistio boolean)
returns void language plpgsql security definer set search_path='' as $$
declare v_bar bigint:=public.mi_barberia_id(); v_r public.reservas%rowtype;
begin
  if not public.meryo_cuenta_activa() then raise exception 'Sesion inactiva' using errcode='42501'; end if;
  if p_asistio is null then raise exception 'Confirma si el cliente asistió'; end if;
  if v_bar is null then raise exception 'No autorizado' using errcode='42501'; end if;
  select * into v_r from public.reservas where id=p_reserva_id and barberia_id=v_bar for update;
  if not found then raise exception 'Reserva no encontrada'; end if;
  if v_r.estado<>'confirmada' then raise exception 'Solo se marcan citas confirmadas'; end if;

  if p_asistio then
    -- Existing completion behavior remains unchanged.
    if v_r.inicio>now() then raise exception 'La cita aun no empieza'; end if;
    update public.reservas set estado='completada',cerrada_en=now() where id=v_r.id;
    perform public.notificar(v_r.cliente_id,'Cuentanos como te fue','Deja tu reseña de '||v_r.servicio_nombre||'.','pedir_resena',v_r.id);
  else
    if not public.meryo_es_cita_asignada(v_r.barbero_id) then
      raise exception 'Solo el profesional asignado puede registrar la inasistencia' using errcode='42501';
    end if;
    if v_r.llegada_en is not null then
      raise exception 'No se puede marcar la inasistencia: la llegada ya fue registrada';
    end if;
    if clock_timestamp()<v_r.inicio+interval '15 minutes' then
      raise exception 'Solo puedes marcar la inasistencia después de 15 minutos desde la hora de la cita';
    end if;
    if v_r.pagada_en is null or not exists(
      select 1 from public.pagos p
      where p.reserva_id=v_r.id and p.estado='pagado' and p.pagado_en is not null
        and p.moneda='PEN' and p.monto=v_r.monto_adelanto
    ) then
      raise exception 'Solo se puede marcar una cita con el adelanto verificado y pagado';
    end if;

    -- Keep the paid advance unchanged for the business; do not create or alter
    -- a charge. `confirmada` also excludes appointments already marked attended.
    update public.reservas set estado='no_asistio',cerrada_en=clock_timestamp() where id=v_r.id;
    perform public.notificar(
      v_r.cliente_id,
      'Inasistencia registrada',
      'El barbero registró que no asististe a la cita. El adelanto pagado queda para la barbería; no se generó otro cobro.',
      'reserva_no_asistio',
      v_r.id
    );
  end if;
end;
$$;

-- Reuse the installed queue function and preserve its current schema-specific
-- branches (including store pickup where installed); add only this event.
do $queue_push$
declare definition text;
begin
  if to_regprocedure('meryo_private.queue_push()') is null then
    raise exception 'The existing push queue function is required for no-show notifications';
  end if;
  definition:=pg_get_functiondef('meryo_private.queue_push()'::regprocedure);
  if position('reserva_no_asistio' in definition)>0 then
    raise exception 'The no-show push event is already enabled';
  end if;
  if position('reserva_confirmada' in definition)=0 then
    raise exception 'The installed push queue contract is not recognized';
  end if;
  definition:=replace(definition,'''reserva_confirmada''','''reserva_confirmada'',''reserva_no_asistio''');
  if position('reserva_no_asistio' in definition)=0 then
    raise exception 'Could not extend the existing push queue event list';
  end if;
  execute definition;
end;
$queue_push$;

notify pgrst,'reload schema';
commit;
