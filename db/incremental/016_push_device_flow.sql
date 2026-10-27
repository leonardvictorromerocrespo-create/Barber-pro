begin;
alter table meryo_private.push_deliveries add column clicked_at timestamptz;
create table meryo_private.push_dispatch_settings(
 id integer primary key check(id=1),enabled boolean not null default false,
 url text not null check(url ~ '^https://barber-pro-phi-taupe\.vercel\.app/api/push/worker$|^http://127\.0\.0\.1:[0-9]+/api/push/worker$'),
 secret text not null check(length(secret)>=43),last_signal timestamptz
);
alter table meryo_private.push_dispatch_settings enable row level security;
revoke all on meryo_private.push_dispatch_settings from public,anon,authenticated,service_role;
create function meryo_private.wake_push() returns boolean language plpgsql security definer set search_path='' as $$
declare destination text;credential text;begin
 if not exists(select 1 from pg_extension where extname='pg_net') then return false;end if;
 update meryo_private.push_dispatch_settings set last_signal=clock_timestamp() where id=1 and enabled and (last_signal is null or last_signal<clock_timestamp()-interval '2 seconds') returning url,secret into destination,credential;
 if destination is null then return false;end if;
 execute 'select net.http_post(url:=$1,body:=$2,headers:=$3,timeout_milliseconds:=25000)' using destination,'{}'::jsonb,jsonb_build_object('Authorization','Bearer '||credential,'Content-Type','application/json');
 return true;
end$$;
revoke all on function meryo_private.wake_push() from public,anon,authenticated,service_role;
create function meryo_private.signal_push() returns trigger language plpgsql security definer set search_path='' as $$begin perform meryo_private.wake_push();return new;end$$;
revoke all on function meryo_private.signal_push() from public,anon,authenticated,service_role;
create trigger meryo_signal_push after insert on meryo_private.push_outbox for each statement execute function meryo_private.signal_push();
create or replace function meryo_private.queue_push() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.tipo in ('reserva_solicitada','reserva_aceptada','reserva_rechazada','reserva_expirada','reserva_confirmada','push_diagnostico') then
 insert into meryo_private.push_outbox(notification_id,user_id,event,reserva_id,available_at) values(new.id,new.user_id,new.tipo,new.reserva_id,clock_timestamp()+case when new.tipo='push_diagnostico' then interval '30 seconds' else interval '0 seconds' end);end if;return new;
end$$;
create function public.meryo_push_estado() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not public.meryo_cuenta_activa() or (exists(select 1 from public.profiles where id=auth.uid() and rol='admin') and not public.es_admin()) then raise exception 'Inicia sesión; administración requiere MFA' using errcode='42501';end if;
 return jsonb_build_object('dispositivos',(select count(*) from meryo_private.push_subscriptions where user_id=auth.uid()),'ultimos',coalesce((select jsonb_agg(j order by j->>'created_at' desc) from (
 select jsonb_build_object('id',o.id,'notification_id',o.notification_id,'evento',o.event,'estado',o.status,'created_at',o.created_at,'provider_accepted_at',o.provider_accepted_at,'recibida_en',max(d.received_at),'abierta_en',max(d.clicked_at)) j from meryo_private.push_outbox o left join meryo_private.push_deliveries d on d.outbox_id=o.id where o.user_id=auth.uid() group by o.id order by o.created_at desc limit 10) q),'[]'::jsonb));
end$$;
create function public.meryo_probar_push() returns bigint language plpgsql security definer set search_path='' as $$declare result bigint;begin
 perform public.meryo_push_estado();
 perform pg_advisory_xact_lock(hashtextextended('meryo-self-push-'||auth.uid()::text,0));
 if not (public.meryo_reservas_config()->>'push_disponible')::boolean or not exists(select 1 from meryo_private.push_subscriptions where user_id=auth.uid()) then raise exception 'Activa primero los avisos en este dispositivo';end if;
 if exists(select 1 from meryo_private.push_outbox where user_id=auth.uid() and event='push_diagnostico' and created_at>clock_timestamp()-interval '1 minute') then raise exception 'Espera un minuto antes de solicitar otra comprobación';end if;
 insert into public.notificaciones(user_id,titulo,mensaje,tipo) values(auth.uid(),'Comprobación push MERYO','Comprobación solicitada por ti. No es una cita ni un cobro.','push_diagnostico') returning id into result;return result;
end$$;
revoke all on function public.meryo_push_estado(),public.meryo_probar_push() from public,anon;
grant execute on function public.meryo_push_estado(),public.meryo_probar_push() to authenticated;
-- Existing subscription binding already rejects reuse by a different account.
-- Administrators may only subscribe after the same server MFA gate as their panel.
do $$declare source text;begin
 source:=pg_get_functiondef('public.meryo_registrar_push(jsonb)'::regprocedure);
 source:=replace(source,'if uid is null or not public.meryo_cuenta_activa()', 'if uid is null or not public.meryo_cuenta_activa() or (exists(select 1 from public.profiles where id=uid and rol=''admin'') and not public.es_admin())');source:=replace(source,'insert into meryo_private.push_subscriptions(endpoint', 'if not exists(select 1 from meryo_private.push_subscriptions where endpoint=ep and user_id=uid) and (select count(*) from meryo_private.push_subscriptions where user_id=uid)>=5 then raise exception ''Máximo cinco dispositivos; desactiva uno anterior'';end if; insert into meryo_private.push_subscriptions(endpoint');execute source;
end$$;
notify pgrst,'reload schema';
commit;
