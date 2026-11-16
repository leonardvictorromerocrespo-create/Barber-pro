begin;

do $chat_guard$
begin
  if to_regclass('public.reservas') is null
     or to_regclass('public.meryo_team_members') is null then
    raise exception 'Reservation chat requires the team scheduling schema (migration 014)';
  end if;
  if to_regprocedure('public.meryo_cuenta_activa()') is null
     or to_regprocedure('public.meryo_es_cita_asignada(uuid)') is null then
    raise exception 'Reservation chat requires active-account and assigned-professional checks';
  end if;
  if to_regprocedure('public.meryo_reservas_estado()') is null
     or to_regclass('meryo_private.push_outbox') is null
     or not exists (
       select 1 from information_schema.columns
       where table_schema='meryo_private' and table_name='push_outbox'
         and column_name in ('notification_id','user_id','event','reserva_id','pedido_id','available_at')
       group by table_schema,table_name having count(*)=6
     ) then
    raise exception 'Reservation chat notices require the current booking snapshot and push outbox schema';
  end if;
  if not exists (
    select 1
    from information_schema.columns
    where table_schema='public' and table_name='reservas'
      and column_name in ('id','cliente_id','barbero_id','aceptada_en')
    group by table_schema,table_name
    having count(*)=4
  ) then
    raise exception 'Reservation chat requires reservation id, client, assigned professional, and acceptance timestamp';
  end if;
end;
$chat_guard$;

create table public.reserva_mensajes (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references public.reservas(id) on delete restrict,
  autor_id uuid not null references auth.users(id) on delete restrict,
  contenido text not null check (char_length(contenido) <= 2000 and char_length(btrim(contenido)) > 0),
  creado_en timestamptz not null default clock_timestamp()
);

create index reserva_mensajes_reserva_creado_idx
  on public.reserva_mensajes(reserva_id, creado_en desc, id desc);

alter table public.reserva_mensajes enable row level security;
revoke all on table public.reserva_mensajes from public, anon, authenticated;
grant select on table public.reserva_mensajes to authenticated;
grant insert (reserva_id, autor_id, contenido) on table public.reserva_mensajes to authenticated;

create policy reserva_mensajes_participantes_select
  on public.reserva_mensajes
  for select to authenticated
  using (
    (select public.meryo_cuenta_activa())
    and exists (
      select 1
      from public.reservas r
      where r.id = reserva_mensajes.reserva_id
        and r.aceptada_en is not null
        and r.barbero_id is not null
        and (
          r.cliente_id = (select auth.uid())
          or public.meryo_es_cita_asignada(r.barbero_id)
        )
    )
  );

create policy reserva_mensajes_participantes_insert
  on public.reserva_mensajes
  for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and (select public.meryo_cuenta_activa())
    and exists (
      select 1
      from public.reservas r
      where r.id = reserva_mensajes.reserva_id
        and r.aceptada_en is not null
        and r.barbero_id is not null
        and (
          r.cliente_id = (select auth.uid())
          or (
            public.meryo_es_cita_asignada(r.barbero_id)
            and exists (
              select 1 from public.reserva_mensajes started
              where started.reserva_id = r.id and started.autor_id = r.cliente_id
            )
          )
        )
    )
  );

comment on table public.reserva_mensajes is
  'Mensajes de una reserva aceptada; el cliente inicia y RLS limita lectura y envío al cliente y al profesional asignado.';

-- The professional sees the existing booking card only after the client starts its conversation.
do $chat_snapshot$
declare source text; patched text; is_definer boolean;
begin
  select p.prosecdef into is_definer
  from pg_catalog.pg_proc p
  where p.oid = 'public.meryo_reservas_estado()'::regprocedure;
  if is_definer then
    raise exception 'Booking snapshot must remain SECURITY INVOKER for chat visibility';
  end if;
  source := pg_get_functiondef('public.meryo_reservas_estado()'::regprocedure);
  if position('chat_disponible' in source) = 0 then
    patched := replace(
      source,
      'to_jsonb(r)||jsonb_build_object(''barberias''',
      'to_jsonb(r)||jsonb_build_object(''chat_disponible'',exists(select 1 from public.reserva_mensajes cm where cm.reserva_id=r.id and cm.autor_id=r.cliente_id),''barberias'''
    );
    if patched = source then
      raise exception 'Could not add chat activity to the existing booking snapshot';
    end if;
    execute patched;
  end if;
end
$chat_snapshot$;

-- A client message creates the first and only conversation notification for that appointment.
create function meryo_private.notify_reservation_chat_first_message()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_client uuid; v_barber_user uuid;
begin
  if (select auth.uid()) is null or new.autor_id is distinct from (select auth.uid()) then
    raise exception 'Reservation chat author does not match the authenticated user' using errcode='42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.reserva_id::text,340));
  select r.cliente_id,m.user_id into v_client,v_barber_user
  from public.reservas r
  join public.meryo_team_members m on m.id=r.barbero_id and m.barberia_id=r.barberia_id and m.active
  join public.profiles p on p.id=m.user_id and p.activo and p.rol='barbero'
  where r.id=new.reserva_id and r.aceptada_en is not null;
  if not found or new.autor_id is distinct from v_client then return new; end if;
  if exists(select 1 from public.reserva_mensajes prior where prior.reserva_id=new.reserva_id and prior.id<>new.id) then return new; end if;
  insert into public.notificaciones(user_id,titulo,mensaje,tipo,reserva_id)
  values(v_barber_user,'Nuevo mensaje de una cita','El cliente escribió por una cita. Abre la reserva para responder.','reserva_chat',new.reserva_id);
  return new;
end;
$$;
revoke all on function meryo_private.notify_reservation_chat_first_message() from public,anon,authenticated,service_role;

create trigger meryo_notify_reservation_chat_first_message
after insert on public.reserva_mensajes
for each row execute function meryo_private.notify_reservation_chat_first_message();

-- Keep the existing push pipeline and queue only the new chat notification event.
create function meryo_private.queue_reservation_chat_push()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.tipo='reserva_chat' and new.reserva_id is not null and exists(
    select 1 from public.reservas r
    join public.meryo_team_members m on m.id=r.barbero_id and m.barberia_id=r.barberia_id and m.user_id=new.user_id and m.active
    where r.id=new.reserva_id and r.aceptada_en is not null
  ) then
    insert into meryo_private.push_outbox(notification_id,user_id,event,reserva_id,pedido_id,available_at)
    values(new.id,new.user_id,'reserva_chat',new.reserva_id,null,clock_timestamp());
  end if;
  return new;
end;
$$;
revoke all on function meryo_private.queue_reservation_chat_push() from public,anon,authenticated,service_role;

create trigger meryo_queue_reservation_chat_push
after insert on public.notificaciones
for each row execute function meryo_private.queue_reservation_chat_push();

notify pgrst, 'reload schema';
commit;
