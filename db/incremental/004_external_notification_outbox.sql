-- DRAFT. Durable server delivery, independent of an open browser.
-- Requires a scheduled worker, verified sender and consented recipient in staging.
begin;
create table meryo_private.notification_contacts (
  user_id uuid primary key references public.profiles(id),
  email text not null check(email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  consented_at timestamptz not null,
  verified_at timestamptz not null,
  enabled boolean not null default false
);
create table meryo_private.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id bigint not null unique references public.notificaciones(id),
  user_id uuid not null references public.profiles(id),
  reserva_id uuid references public.reservas(id),
  event text not null,
  status text not null default 'queued' check(status in ('queued','leased','accepted','dead','expired')),
  attempts integer not null default 0,
  available_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  lease_token uuid,
  lease_until timestamptz,
  provider_id text,
  last_error text,
  created_at timestamptz not null default clock_timestamp()
);
create index notification_outbox_pending on meryo_private.notification_outbox(available_at)
  where status in ('queued','leased');
revoke all on meryo_private.notification_contacts,meryo_private.notification_outbox from public,anon,authenticated;
grant select,insert,update,delete on meryo_private.notification_contacts to service_role;
grant select,update on meryo_private.notification_outbox to service_role;

create function meryo_private.enqueue_barber_notification() returns trigger
language plpgsql security definer set search_path='' as $$
declare deadline timestamptz;
begin
  if not exists(select 1 from public.profiles where id=new.user_id and rol='barbero' and activo is true) then return new; end if;
  if new.tipo='reserva_solicitada' then
    select expira_respuesta_en into deadline from public.reservas where id=new.reserva_id and estado='solicitada';
    if deadline is null then return new; end if;
  else deadline:=clock_timestamp()+interval '1 hour'; end if;
  insert into meryo_private.notification_outbox(notification_id,user_id,reserva_id,event,expires_at)
  values(new.id,new.user_id,new.reserva_id,coalesce(new.tipo,'aviso'),deadline);
  return new;
end;
$$;
revoke all on function meryo_private.enqueue_barber_notification() from public,anon,authenticated;
create trigger enqueue_barber_notification after insert on public.notificaciones
for each row execute function meryo_private.enqueue_barber_notification();
commit;
