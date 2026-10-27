begin;
create extension if not exists pg_net;
revoke usage on schema net from public,anon,authenticated;
-- Private wake function is the only application entry point. Its credential
-- stays in meryo_private; no URL, bearer or recipient can be supplied by clients.
select cron.schedule('meryo-push-dispatch','* * * * *','select meryo_private.wake_push()');
commit;
