-- OPTIONAL CANDIDATE: requires an approved environment with pg_cron installed.
-- Not run by local tests. Review existing jobs before installation; never auto-deploy.
-- Lazy expiry in request/decision/payment + occupied_slots remains authoritative
-- even when this cleanup job is delayed. This job persists expiry/notifications.
select cron.schedule('meryo-expiry', '* * * * *', 'select meryo.expire_bookings();');
