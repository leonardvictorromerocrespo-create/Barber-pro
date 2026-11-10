begin;

-- The stored start is part of the idempotency key and lets the push worker
-- reject a reminder for an appointment that was moved after enqueueing.
alter table meryo_private.push_outbox add column reminder_starts_at timestamptz;
alter table meryo_private.push_outbox add constraint meryo_reminder_requires_start
  check ((event='reserva_recordatorio')=(reminder_starts_at is not null));
create unique index meryo_reminder_recipient_start_idx
  on meryo_private.push_outbox(reserva_id,reminder_starts_at,user_id)
  where event='reserva_recordatorio';
create index meryo_confirmed_start_idx on public.reservas(inicio)
  where estado='confirmada' and pagada_en is not null and llegada_en is null;

create function meryo_private.enqueue_booking_reminders()
returns integer language plpgsql security definer set search_path='' as $$
declare
  v_now timestamptz:=clock_timestamp();
  v_enqueued integer;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('meryo-booking-reminders-v1',0)) then
    return 0;
  end if;

  with appointments as materialized (
    select r.id,r.inicio,r.cliente_id,r.barbero_id,r.barberia_id
    from public.reservas r
    where r.estado='confirmada' and r.pagada_en is not null and r.llegada_en is null
      -- Minute-based cron tolerates a short delay but does not send stale alerts.
      and r.inicio>v_now+interval '22 minutes'
      and r.inicio<=v_now+interval '25 minutes'
      and r.pagada_en<=r.inicio-interval '25 minutes'
      and not exists (
        select 1 from meryo_private.push_outbox o
        where o.event='reserva_recordatorio' and o.reserva_id=r.id and o.reminder_starts_at=r.inicio
      )
    order by r.inicio,r.id
    limit 200 for update of r skip locked
  ), recipients as (
    select a.id,a.inicio,a.barberia_id,a.cliente_id user_id from appointments a
    union
    select a.id,a.inicio,a.barberia_id,m.user_id from appointments a
    join public.meryo_team_members m on m.id=a.barbero_id and m.barberia_id=a.barberia_id and m.active
  ), notices as (
    insert into public.notificaciones(user_id,titulo,mensaje,tipo,reserva_id)
    select x.user_id,'Tu cita se acerca',
      'Cita en '||coalesce(nullif(left(b.nombre,100),''),'tu barbería')||' · '
      ||to_char(x.inicio at time zone 'America/Lima','DD/MM "a las" HH24:MI')||' (hora de Lima).',
      'reserva_recordatorio',x.id
    from recipients x
    join public.profiles p on p.id=x.user_id and p.activo
    join public.barberias b on b.id=x.barberia_id
    returning id,user_id,reserva_id
  )
  insert into meryo_private.push_outbox(notification_id,user_id,event,reserva_id,reminder_starts_at)
  select n.id,n.user_id,'reserva_recordatorio',n.reserva_id,a.inicio
  from notices n join appointments a on a.id=n.reserva_id;

  get diagnostics v_enqueued=row_count;
  return v_enqueued;
end;
$$;
revoke all on function meryo_private.enqueue_booking_reminders() from public,anon,authenticated,service_role;

select cron.schedule('meryo-booking-reminders','* * * * *','select meryo_private.enqueue_booking_reminders()');
commit;
