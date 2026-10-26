begin;
create table meryo_private.push_deliveries (
 id uuid primary key default gen_random_uuid(),outbox_id bigint not null references meryo_private.push_outbox(id),
 endpoint_hash text not null,ack_hash text not null,expires_at timestamptz not null,
 provider_accepted_at timestamptz,received_at timestamptz,unique(outbox_id,endpoint_hash)
);
revoke all on meryo_private.push_deliveries from public,anon,authenticated,service_role;
commit;
