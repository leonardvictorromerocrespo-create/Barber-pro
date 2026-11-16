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
          or public.meryo_es_cita_asignada(r.barbero_id)
        )
    )
  );

comment on table public.reserva_mensajes is
  'Mensajes de una reserva aceptada; RLS limita lectura y envío al cliente y al profesional asignado.';

notify pgrst, 'reload schema';
commit;
