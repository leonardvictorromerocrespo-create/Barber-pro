-- CANDIDATE ONLY. New isolated schema, NOT a migration of the unknown legacy schema.
-- Requires Supabase auth.uid(), roles anon/authenticated/service_role and btree_gist.
-- Never run against production until legacy schema/data mapping and grants are reviewed.
begin;
create extension if not exists btree_gist;
create schema meryo;
revoke all on schema meryo from public;
grant usage on schema meryo to authenticated, service_role;

create table meryo.shops (id uuid primary key default gen_random_uuid(), name text not null);
create table meryo.accounts (
 id uuid primary key, role text not null check(role in ('cliente','barbero','admin')),
 shop_id uuid references meryo.shops, active boolean not null default true,
 check ((role = 'barbero') = (shop_id is not null))
);
-- Accounts are provisioned ONLY by a trusted server/admin. No signup metadata roles.
create table meryo.settings (
 singleton boolean primary key default true check(singleton),
 payment_seconds integer not null default 300 check(payment_seconds between 60 and 1800),
 commission_cents integer check(commission_cents in (100,200))
);
insert into meryo.settings(singleton) values(true);
create table meryo.services (
 id uuid primary key default gen_random_uuid(), shop_id uuid not null references meryo.shops,
 name text not null, price_cents integer not null check(price_cents > 0),
 duration_minutes integer not null check(duration_minutes between 1 and 60), active boolean not null default true
);
-- Pilot contract: one bookable resource per shop, explicit server-managed slots.
create table meryo.slots (
 id uuid primary key default gen_random_uuid(), shop_id uuid not null references meryo.shops,
 starts_at timestamptz not null, ends_at timestamptz not null,
 check(ends_at > starts_at),
 exclude using gist (shop_id with =, tstzrange(starts_at, ends_at, '[)') with &&)
);
create table meryo.bookings (
 id uuid primary key default gen_random_uuid(), slot_id uuid not null references meryo.slots,
 shop_id uuid not null references meryo.shops, service_id uuid not null references meryo.services,
 customer_id uuid not null references meryo.accounts, customer_name text not null check(length(customer_name) between 1 and 150),
 customer_phone text not null check(length(customer_phone) between 1 and 40), note text check(length(note) <= 2000),
 status text not null default 'solicitada' check(status in ('solicitada','pendiente_pago','confirmada','rechazada','vencida','cancelada')),
 total_cents integer not null check(total_cents > 0), deposit_cents integer not null check(deposit_cents > 0),
 commission_cents integer check(commission_cents in (100,200)),
 accept_by timestamptz not null, pay_by timestamptz,
 payment_provider text, payment_reference text, created_at timestamptz not null default clock_timestamp(),
 check(deposit_cents = (total_cents + 1) / 2),
 check(status <> 'pendiente_pago' or pay_by is not null),
 check(status <> 'confirmada' or (payment_reference is not null and payment_provider is not null)),
 unique(payment_provider,payment_reference)
);
create unique index one_live_booking_per_slot on meryo.bookings(slot_id)
 where status in ('solicitada','pendiente_pago','confirmada');
create index booking_expiration on meryo.bookings(status,accept_by,pay_by);
create table meryo.notifications (
 id uuid primary key default gen_random_uuid(), booking_id uuid not null references meryo.bookings,
 user_id uuid not null references meryo.accounts, event text not null,
 created_at timestamptz not null default clock_timestamp(), unique(booking_id,user_id,event)
);

create function meryo.has_role(wanted text, shop uuid default null) returns boolean
 language sql stable security definer set search_path = pg_catalog,meryo as $$
 select exists(select 1 from meryo.accounts where id=auth.uid() and active and role=wanted and (shop is null or shop_id=shop));
$$;

create function meryo.notify_booking() returns trigger
 language plpgsql security definer set search_path = pg_catalog,meryo as $$
begin
 if TG_OP='INSERT' or new.status is distinct from old.status then
   insert into meryo.notifications(booking_id,user_id,event)
   select new.id,id,new.status from meryo.accounts
   where active and (id=new.customer_id or (role='barbero' and shop_id=new.shop_id))
   on conflict do nothing;
 end if;
 return new;
end $$;
create trigger booking_notification after insert or update of status on meryo.bookings
 for each row execute function meryo.notify_booking();

create function meryo.expire_bookings() returns integer
 language plpgsql security definer set search_path = pg_catalog,meryo as $$
declare n integer;
begin
 update meryo.bookings set status='vencida'
 where (status='solicitada' and accept_by <= clock_timestamp())
    or (status='pendiente_pago' and pay_by <= clock_timestamp());
 get diagnostics n = row_count;
 return n;
end $$;

create function meryo.request_booking(slot_id uuid, service_id uuid, customer_name text, customer_phone text, note text default '')
 returns meryo.bookings language plpgsql security definer set search_path = pg_catalog,meryo as $$
declare s meryo.slots; v meryo.services; b meryo.bookings; fee integer;
begin
 if not meryo.has_role('cliente') then raise exception 'Cliente activo requerido' using errcode='42501'; end if;
 select * into s from meryo.slots where id=request_booking.slot_id for update;
 if not found or s.starts_at <= clock_timestamp() then raise exception 'Horario no disponible'; end if;
 select * into v from meryo.services where id=request_booking.service_id and shop_id=s.shop_id and active;
 if not found or v.duration_minutes * interval '1 minute' > s.ends_at-s.starts_at then raise exception 'Servicio no disponible'; end if;
 update meryo.bookings set status='vencida' where bookings.slot_id=s.id and
 ((status='solicitada' and accept_by<=clock_timestamp()) or (status='pendiente_pago' and pay_by<=clock_timestamp()));
 select commission_cents into fee from meryo.settings;
 insert into meryo.bookings(slot_id,shop_id,service_id,customer_id,customer_name,customer_phone,note,total_cents,deposit_cents,commission_cents,accept_by)
 values(s.id,s.shop_id,v.id,auth.uid(),trim(request_booking.customer_name),trim(request_booking.customer_phone),request_booking.note,
 v.price_cents,(v.price_cents+1)/2,fee,clock_timestamp()+interval '5 minutes') returning * into b;
 return b;
end $$;

create function meryo.decide_booking(booking_id uuid, accept_booking boolean) returns meryo.bookings
 language plpgsql security definer set search_path = pg_catalog,meryo as $$
declare b meryo.bookings; seconds integer;
begin
 select * into b from meryo.bookings where id=booking_id;
 if not found or not meryo.has_role('barbero',b.shop_id) then raise exception 'No autorizado' using errcode='42501'; end if;
 perform 1 from meryo.slots where id=b.slot_id for update;
 select * into b from meryo.bookings where id=booking_id for update;
 if b.status<>'solicitada' then raise exception 'Transición no permitida'; end if;
 if b.accept_by<=clock_timestamp() then
   update meryo.bookings set status='vencida' where id=b.id returning * into b;
 else
   select payment_seconds into seconds from meryo.settings;
   update meryo.bookings set status=case when accept_booking then 'pendiente_pago' else 'rechazada' end,
     pay_by=case when accept_booking then clock_timestamp()+make_interval(secs=>seconds) end
   where id=b.id returning * into b;
 end if;
 return b;
end $$;

-- Only a trusted payment verifier may invoke this. No provider is configured here.
-- Verifier MUST validate signature + query provider, merchant, amount, PEN, booking ID.
create function meryo.verify_payment(booking_id uuid, provider text, reference text, amount_cents integer, currency text)
 returns meryo.bookings language plpgsql security definer set search_path = pg_catalog,meryo as $$
declare b meryo.bookings;
begin
 select * into b from meryo.bookings where id=booking_id;
 if not found then raise exception 'Reserva inexistente'; end if;
 perform 1 from meryo.slots where id=b.slot_id for update;
 select * into b from meryo.bookings where id=booking_id for update;
 if provider is null or trim(provider)='' or reference is null or trim(reference)='' or currency is distinct from 'PEN' or amount_cents is distinct from b.deposit_cents then
   raise exception 'Pago inválido';
 end if;
 if b.status='confirmada' and b.payment_provider=provider and b.payment_reference=reference then return b; end if;
 if b.status<>'pendiente_pago' then raise exception 'Transición no permitida'; end if;
 if b.pay_by<=clock_timestamp() then
   update meryo.bookings set status='vencida' where id=b.id returning * into b;
   -- Late funds require reconciliation/refund; never resurrect an expired booking.
   return b;
 end if;
 update meryo.bookings set status='confirmada',payment_provider=provider,payment_reference=reference where id=b.id returning * into b;
 return b;
end $$;

create function meryo.cancel_booking(booking_id uuid) returns meryo.bookings
 language plpgsql security definer set search_path = pg_catalog,meryo as $$
declare b meryo.bookings;
begin
 select * into b from meryo.bookings where id=booking_id;
 if not found or not ((b.customer_id=auth.uid() and meryo.has_role('cliente')) or meryo.has_role('barbero',b.shop_id)) then
   raise exception 'No autorizado' using errcode='42501';
 end if;
 perform 1 from meryo.slots where id=b.slot_id for update;
 select * into b from meryo.bookings where id=booking_id for update;
 if b.status not in ('solicitada','pendiente_pago') then raise exception 'Cancelación requiere revisión de pagos'; end if;
 update meryo.bookings set status=case when (b.status='solicitada' and b.accept_by<=clock_timestamp()) or (b.status='pendiente_pago' and b.pay_by<=clock_timestamp()) then 'vencida' else 'cancelada' end where id=b.id returning * into b;
 return b;
end $$;

alter table meryo.shops enable row level security;
alter table meryo.accounts enable row level security;
alter table meryo.settings enable row level security;
alter table meryo.services enable row level security;
alter table meryo.slots enable row level security;
alter table meryo.bookings enable row level security;
alter table meryo.notifications enable row level security;
create policy own_account on meryo.accounts for select to authenticated using(id=auth.uid() and active);
create policy read_shops on meryo.shops for select to authenticated using(true);
create policy read_services on meryo.services for select to authenticated using(active);
create policy read_slots on meryo.slots for select to authenticated using(true);
create policy own_bookings on meryo.bookings for select to authenticated using(
 (customer_id=auth.uid() and meryo.has_role('cliente')) or meryo.has_role('barbero',shop_id));
create policy own_notifications on meryo.notifications for select to authenticated using(user_id=auth.uid() and exists(select 1 from meryo.accounts where id=auth.uid() and active));
grant select on meryo.shops,meryo.accounts,meryo.services,meryo.slots,meryo.bookings,meryo.notifications to authenticated;
-- Availability exposes only slot IDs, not customer data. Expiry evaluated on server clock.
create function meryo.occupied_slots() returns table(slot_id uuid)
 language sql stable security definer set search_path = pg_catalog,meryo as $$
 select b.slot_id from meryo.bookings b where status='confirmada'
 or (status='solicitada' and accept_by>statement_timestamp())
 or (status='pendiente_pago' and pay_by>statement_timestamp());
$$;
revoke all on all functions in schema meryo from public,anon,authenticated,service_role;
grant execute on function meryo.has_role(text,uuid),meryo.request_booking(uuid,uuid,text,text,text),meryo.decide_booking(uuid,boolean),meryo.cancel_booking(uuid),meryo.occupied_slots() to authenticated;
grant execute on function meryo.verify_payment(uuid,text,text,integer,text),meryo.expire_bookings() to service_role;
-- All table writes, account roles, prices and settings remain server-admin only.
commit;
