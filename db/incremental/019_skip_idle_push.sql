begin;
-- Preserve the one-minute retry job and the insert trigger, but do not write
-- dispatch settings / pg_net requests when no queued work can run yet.
create function meryo_private.push_work_due() returns boolean language sql volatile security definer set search_path='' as $$
 select exists(select 1 from meryo_private.push_outbox
  where status in ('pending_provider','queued','leased')
  and available_at<=clock_timestamp()
  and (lease_until is null or lease_until<clock_timestamp()));
$$;
revoke all on function meryo_private.push_work_due() from public,anon,authenticated,service_role;
do $guard$
declare source text;needle text:='declare destination text;credential text;begin';
begin
 source:=pg_get_functiondef('meryo_private.wake_push()'::regprocedure);
 if position(needle in source)=0 or position('push_work_due' in source)>0 then raise exception 'Unexpected push wake definition; compare before applying';end if;
 execute replace(source,needle,needle||E'\n if not meryo_private.push_work_due() then return false;end if;');
end $guard$;
commit;
