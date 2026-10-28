begin;
-- A pending notice without a registered recipient device is not sendable work.
-- Keep periodic cleanup eligible after a day, just as the existing worker does.
create or replace function meryo_private.push_work_due() returns boolean language sql volatile security definer set search_path='' as $$
 select exists(select 1 from meryo_private.push_outbox o
  where o.status in ('pending_provider','queued','leased')
  and o.available_at<=clock_timestamp()
  and (o.lease_until is null or o.lease_until<clock_timestamp())
  and (o.created_at<clock_timestamp()-interval '1 day'
   or exists(select 1 from meryo_private.push_subscriptions s join public.profiles p on p.id=s.user_id and p.activo where s.user_id=o.user_id)));
$$;
revoke all on function meryo_private.push_work_due() from public,anon,authenticated,service_role;
commit;
