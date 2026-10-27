begin;
create table public.meryo_team_members(
 id uuid primary key default gen_random_uuid(),barberia_id bigint not null references public.barberias(id),
 user_id uuid not null unique references public.profiles(id),display_name text not null check(length(trim(display_name)) between 2 and 80),
 active boolean not null default true,created_at timestamptz not null default clock_timestamp(),unique(id,barberia_id)
);
create table public.meryo_team_services(
 member_id uuid not null references public.meryo_team_members(id),service_id bigint not null references public.servicios(id),
 active boolean not null default true,created_at timestamptz not null default clock_timestamp(),primary key(member_id,service_id)
);
create table public.meryo_team_hours(
 id uuid primary key default gen_random_uuid(),member_id uuid not null references public.meryo_team_members(id),
 day integer not null check(day between 0 and 6),kind text not null check(kind in ('jornada','descanso')),
 starts time not null,ends time not null check(ends>starts),active boolean not null default true,
 legacy_hour_id bigint unique references public.horarios(id) on delete set null,
 created_at timestamptz not null default clock_timestamp()
);
create table public.meryo_team_blocks(
 id uuid primary key default gen_random_uuid(),member_id uuid not null references public.meryo_team_members(id),
 starts timestamptz not null,ends timestamptz not null check(ends>starts),reason text not null check(length(reason) between 3 and 300),
 active boolean not null default true,created_at timestamptz not null default clock_timestamp()
);
create table meryo_private.team_invites(
 id uuid primary key default gen_random_uuid(),barberia_id bigint not null references public.barberias(id),
 email text not null,display_name text not null,token_hash text not null unique,created_by uuid not null references public.profiles(id),
 expires_at timestamptz not null default clock_timestamp()+interval '7 days',status text not null default 'pendiente' check(status in ('pendiente','aceptada','revocada')),
 accepted_by uuid references public.profiles(id),created_at timestamptz not null default clock_timestamp()
);
alter table public.meryo_team_members enable row level security;
alter table public.meryo_team_services enable row level security;
alter table public.meryo_team_hours enable row level security;
alter table public.meryo_team_blocks enable row level security;
alter table meryo_private.team_invites enable row level security;
revoke all on public.meryo_team_members,public.meryo_team_services,public.meryo_team_hours,public.meryo_team_blocks,meryo_private.team_invites from public,anon,authenticated;
insert into public.meryo_team_members(barberia_id,user_id,display_name)
select o.barberia_id,o.user_id,left(coalesce(nullif(trim(p.nombre),''),b.nombre,'Propietario'),80)
from meryo_private.shop_owners o join public.profiles p on p.id=o.user_id join public.barberias b on b.id=o.barberia_id;
insert into public.meryo_team_services(member_id,service_id)
select m.id,s.id from public.meryo_team_members m join meryo_private.shop_owners o on o.user_id=m.user_id and o.barberia_id=m.barberia_id join public.servicios s on s.barberia_id=m.barberia_id;
insert into public.meryo_team_hours(member_id,day,kind,starts,ends,legacy_hour_id)
select m.id,h.dia_semana,'jornada',h.hora_apertura,h.hora_cierre,h.id from public.meryo_team_members m join meryo_private.shop_owners o on o.user_id=m.user_id join public.horarios h on h.barberia_id=m.barberia_id;

create function meryo_private.initialize_owner_team() returns trigger language plpgsql security definer set search_path='' as $$
declare member uuid;begin
 insert into public.meryo_team_members(barberia_id,user_id,display_name) select new.barberia_id,new.user_id,left(coalesce(nullif(trim(p.nombre),''),b.nombre,'Propietario'),80) from public.profiles p join public.barberias b on b.id=new.barberia_id where p.id=new.user_id returning id into member;
 insert into public.meryo_team_hours(member_id,day,kind,starts,ends,legacy_hour_id) select member,dia_semana,'jornada',hora_apertura,hora_cierre,id from public.horarios where barberia_id=new.barberia_id;
 return new;
end$$;
create trigger meryo_initialize_owner after insert on meryo_private.shop_owners for each row execute function meryo_private.initialize_owner_team();
create function meryo_private.assign_owner_service() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.meryo_team_services(member_id,service_id) select m.id,new.id from public.meryo_team_members m join meryo_private.shop_owners o on o.user_id=m.user_id and o.barberia_id=m.barberia_id where m.barberia_id=new.barberia_id on conflict do nothing;return new;
end$$;
create trigger meryo_assign_owner_service after insert on public.servicios for each row execute function meryo_private.assign_owner_service();
create or replace function public.mi_barberia_id() returns bigint language sql stable security definer set search_path='' as $$
 select p.barberia_id from public.profiles p join public.meryo_team_members m on m.user_id=p.id and m.barberia_id=p.barberia_id
 where p.id=auth.uid() and p.rol='barbero' and p.activo and m.active and public.meryo_sesion_activa();
$$;
alter table public.reservas add column barbero_id uuid,add column barbero_nombre text,
 add constraint meryo_booking_member_shop foreign key(barbero_id,barberia_id) references public.meryo_team_members(id,barberia_id);
revoke insert,update,delete on public.reservas from anon,authenticated;
-- Preserve all historical NULL assignments. Their holds block every member of that shop.
alter table public.reservas drop constraint reservas_sin_cruce;
alter table public.reservas add constraint reservas_sin_cruce exclude using gist(
 barberia_id with =,barbero_id with =,tstzrange(inicio,fin,'[)') with &&
) where (estado in ('solicitada','aceptada','confirmada'));
create policy meryo_assigned_reservation_read on public.reservas as restrictive for select to authenticated using(
 cliente_id=auth.uid() or public.es_admin() or public.meryo_es_propietario(barberia_id) or exists(select 1 from public.meryo_team_members m where m.id=barbero_id and m.user_id=auth.uid() and m.active and m.barberia_id=public.mi_barberia_id())
);
-- RLS predicates must not require direct access to the private roster table.
create function public.meryo_es_cita_asignada(p_member uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.meryo_cuenta_activa() and exists(select 1 from public.meryo_team_members where id=p_member and user_id=auth.uid() and active and barberia_id=public.mi_barberia_id());
$$;
revoke all on function public.meryo_es_cita_asignada(uuid) from public,anon;
grant execute on function public.meryo_es_cita_asignada(uuid) to authenticated;
alter policy meryo_assigned_reservation_read on public.reservas using(cliente_id=auth.uid() or public.es_admin() or public.meryo_es_propietario(barberia_id) or public.meryo_es_cita_asignada(barbero_id));

create function meryo_private.member_time_ok(p_member uuid,p_start timestamptz,p_end timestamptz) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.meryo_team_members m where m.id=p_member
 and (p_start at time zone 'America/Lima')::date=(p_end at time zone 'America/Lima')::date
 and exists(select 1 from public.horarios h where h.barberia_id=m.barberia_id and h.dia_semana=extract(dow from p_start at time zone 'America/Lima')::int and h.hora_apertura<=(p_start at time zone 'America/Lima')::time and h.hora_cierre>=(p_end at time zone 'America/Lima')::time)
 and exists(select 1 from public.meryo_team_hours h where h.member_id=m.id and h.active and h.kind='jornada' and h.day=extract(dow from p_start at time zone 'America/Lima')::int and h.starts<=(p_start at time zone 'America/Lima')::time and h.ends>=(p_end at time zone 'America/Lima')::time)
 and not exists(select 1 from public.meryo_team_hours h where h.member_id=m.id and h.active and h.kind='descanso' and h.day=extract(dow from p_start at time zone 'America/Lima')::int and tstzrange(((p_start at time zone 'America/Lima')::date+h.starts) at time zone 'America/Lima',((p_start at time zone 'America/Lima')::date+h.ends) at time zone 'America/Lima','[)') && tstzrange(p_start,p_end,'[)'))
 and not exists(select 1 from public.bloqueos b where b.barberia_id=m.barberia_id and tstzrange(b.inicio,b.fin,'[)')&&tstzrange(p_start,p_end,'[)'))
 and not exists(select 1 from public.meryo_team_blocks b where b.member_id=m.id and b.active and tstzrange(b.starts,b.ends,'[)')&&tstzrange(p_start,p_end,'[)')));
$$;
create function meryo_private.guard_booking_slot() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.estado not in ('solicitada','aceptada','confirmada') then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended('meryo-shop-slot-'||new.barberia_id::text,0));
 if tg_op='INSERT' or row(new.barbero_id,new.inicio,new.fin) is distinct from row(old.barbero_id,old.inicio,old.fin) then
  if new.barbero_id is null or not meryo_private.member_time_ok(new.barbero_id,new.inicio,new.fin) then raise exception 'Horario individual no disponible';end if;
 end if;
 if exists(select 1 from public.reservas r where r.id<>new.id and r.estado in ('solicitada','aceptada','confirmada') and tstzrange(r.inicio,r.fin,'[)')&&tstzrange(new.inicio,new.fin,'[)')
 and ((r.barberia_id=new.barberia_id and (r.barbero_id=new.barbero_id or r.barbero_id is null or new.barbero_id is null)) or r.cliente_id=new.cliente_id)) then raise exception 'Esa hora ya fue tomada o coincide con otra cita del cliente' using errcode='23P01';end if;
 return new;
end$$;
create trigger meryo_guard_individual_slot before insert or update on public.reservas for each row execute function meryo_private.guard_booking_slot();

create function public.meryo_barberos_servicio(p_shop bigint,p_service bigint) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'nombre',m.display_name) order by m.display_name,m.id),'[]'::jsonb)
 from public.meryo_team_members m join public.profiles p on p.id=m.user_id join public.barberias b on b.id=m.barberia_id
 where m.barberia_id=p_shop and m.active and p.activo and b.verificada and b.estado='activa' and public.meryo_barberia_publicable(b.id)
 and exists(select 1 from public.meryo_team_services ms join public.servicios s on s.id=ms.service_id where ms.member_id=m.id and ms.service_id=p_service and ms.active and s.activo and s.barberia_id=p_shop);
$$;
create function public.meryo_horarios_barbero(p_shop bigint,p_service bigint,p_date date,p_member uuid) returns table(hora_inicio timestamptz) language plpgsql stable security definer set search_path='' as $$
declare duration integer;step integer:=public.cfg('paso_minutos')::int;
begin
 if p_date is null or p_date<(clock_timestamp() at time zone 'America/Lima')::date or p_date>(clock_timestamp() at time zone 'America/Lima')::date+30 then return;end if;
 if not exists(select 1 from jsonb_array_elements(public.meryo_barberos_servicio(p_shop,p_service)) m where m->>'id'=p_member::text) then return;end if;
 select duracion_min into duration from public.servicios where id=p_service and barberia_id=p_shop and activo;
 return query select t from generate_series(p_date::timestamp at time zone 'America/Lima',((p_date+1)::timestamp at time zone 'America/Lima')-make_interval(mins=>duration),make_interval(mins=>step)) t
 where t>=clock_timestamp()+make_interval(mins=>public.cfg('minutos_anticipacion_minima')::int) and t<=clock_timestamp()+interval '30 days'
 and meryo_private.member_time_ok(p_member,t,t+make_interval(mins=>duration))
 and not exists(select 1 from public.reservas r where r.barberia_id=p_shop and (r.barbero_id=p_member or r.barbero_id is null)
 and tstzrange(r.inicio,r.fin,'[)')&&tstzrange(t,t+make_interval(mins=>duration),'[)')
 and (r.estado='confirmada' or(r.estado='solicitada' and r.expira_respuesta_en>clock_timestamp()) or(r.estado='aceptada' and(r.expira_pago_en is null or r.expira_pago_en>clock_timestamp())))) order by t;
end$$;
revoke all on function public.meryo_barberos_servicio(bigint,bigint),public.meryo_horarios_barbero(bigint,bigint,date,uuid) from public;
grant execute on function public.meryo_barberos_servicio(bigint,bigint),public.meryo_horarios_barbero(bigint,bigint,date,uuid) to anon,authenticated;

-- Extend the already verified request contract rather than changing its payment/expiry rules.
do $request$declare source text;begin
 source:=pg_get_functiondef('public.crear_reserva(bigint,bigint,timestamptz,text,text,text,numeric)'::regprocedure);
 if position('interval ''15 minutes''' in source)=0 or position('v_total * 0.5' in source)=0 then raise exception 'Unexpected reservation contract';end if;
 source:=replace(source,'public.crear_reserva(','public.meryo_solicitar_cita(');
 source:=replace(source,'p_pedido text DEFAULT NULL::text, p_extra numeric DEFAULT 0)','p_pedido text, p_extra numeric, p_barbero_id uuid)');
 source:=replace(source,'  perform public.expirar_reservas_vencidas();',E'  perform public.expirar_reservas_vencidas();\n  perform pg_advisory_xact_lock(hashtextextended(''meryo-shop-slot-''||p_barberia_id::text,0));\n  if not exists(select 1 from jsonb_array_elements(public.meryo_barberos_servicio(p_barberia_id,p_servicio_id)) m where m->>''id''=p_barbero_id::text) then raise exception ''Elige un barbero habilitado para este servicio'';end if;');
 source:=replace(source,'insert into public.reservas (barberia_id, servicio_id, cliente_id,','insert into public.reservas (barbero_id,barbero_nombre,barberia_id, servicio_id, cliente_id,');
 source:=replace(source,'values (p_barberia_id, p_servicio_id, v_uid,','values (p_barbero_id,(select display_name from public.meryo_team_members where id=p_barbero_id),p_barberia_id, p_servicio_id, v_uid,');
 if position('p_barbero_id uuid)' in source)=0 or position('barbero_nombre,barberia_id' in source)=0 then raise exception 'Request transformation failed';end if;
 execute source;
end $request$;
revoke all on function public.meryo_solicitar_cita(bigint,bigint,timestamptz,text,text,text,numeric,uuid) from public,anon;
grant execute on function public.meryo_solicitar_cita(bigint,bigint,timestamptz,text,text,text,numeric,uuid) to authenticated;
create or replace function public.crear_reserva(p_barberia_id bigint,p_servicio_id bigint,p_inicio timestamptz,p_nombre text,p_telefono text,p_pedido text default null,p_extra numeric default 0) returns uuid language plpgsql security definer set search_path='' as $$
declare member uuid;begin
 select m.id into member from public.meryo_team_members m join meryo_private.shop_owners o on o.user_id=m.user_id where m.barberia_id=p_barberia_id;
 return public.meryo_solicitar_cita(p_barberia_id,p_servicio_id,p_inicio,p_nombre,p_telefono,p_pedido,p_extra,member);
end$$;
create or replace function public.horarios_disponibles(p_barberia_id bigint,p_servicio_id bigint,p_fecha date) returns table(hora_inicio timestamptz) language sql stable security definer set search_path='' as $$
 select * from public.meryo_horarios_barbero(p_barberia_id,p_servicio_id,p_fecha,(select m.id from public.meryo_team_members m join meryo_private.shop_owners o on o.user_id=m.user_id where m.barberia_id=p_barberia_id));
$$;

create or replace function public.notificar_barberia(p_barberia bigint,p_titulo text,p_mensaje text,p_tipo text,p_reserva uuid) returns void language sql security definer set search_path='' as $$
 insert into public.notificaciones(user_id,titulo,mensaje,tipo,reserva_id)
 select distinct p.id,p_titulo,p_mensaje,p_tipo,p_reserva from public.profiles p join public.meryo_team_members m on m.user_id=p.id
 where m.barberia_id=p_barberia and m.active and p.activo and (exists(select 1 from meryo_private.shop_owners o where o.user_id=p.id and o.barberia_id=p_barberia) or exists(select 1 from public.reservas r where r.id=p_reserva and r.barbero_id=m.id));
$$;
create function meryo_private.require_booking_member(p_id uuid,p_accept boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare r public.reservas%rowtype;begin
 select * into r from public.reservas where id=p_id;if not found then raise exception 'Reserva no encontrada';end if;
 perform pg_advisory_xact_lock(hashtextextended('meryo-shop-slot-'||r.barberia_id::text,0));
 if not public.meryo_es_propietario(r.barberia_id) and not public.meryo_es_cita_asignada(r.barbero_id) then raise exception 'No autorizado para esta cita' using errcode='42501';end if;
 if p_accept and r.barbero_id is not null and not exists(select 1 from public.meryo_team_members m join public.profiles p on p.id=m.user_id where m.id=r.barbero_id and m.active and p.activo) then raise exception 'El integrante está inactivo; revisa la asignación antes de aceptar';end if;
end$$;
alter function public.responder_reserva(uuid,boolean) set schema meryo_private;
alter function public.cancelar_reserva_barbero(uuid) set schema meryo_private;
alter function public.marcar_asistencia(uuid,boolean) set schema meryo_private;
revoke all on function meryo_private.responder_reserva(uuid,boolean),meryo_private.cancelar_reserva_barbero(uuid),meryo_private.marcar_asistencia(uuid,boolean) from public,anon,authenticated;
create function public.responder_reserva(p_reserva_id uuid,p_aceptar boolean) returns text language plpgsql security definer set search_path='' as $$begin perform meryo_private.require_booking_member(p_reserva_id,p_aceptar);return meryo_private.responder_reserva(p_reserva_id,p_aceptar);end$$;
create function public.cancelar_reserva_barbero(p_reserva_id uuid) returns void language plpgsql security definer set search_path='' as $$begin perform meryo_private.require_booking_member(p_reserva_id);perform meryo_private.cancelar_reserva_barbero(p_reserva_id);end$$;
create function public.marcar_asistencia(p_reserva_id uuid,p_asistio boolean) returns void language plpgsql security definer set search_path='' as $$begin perform meryo_private.require_booking_member(p_reserva_id);perform meryo_private.marcar_asistencia(p_reserva_id,p_asistio);end$$;
revoke all on function public.responder_reserva(uuid,boolean),public.cancelar_reserva_barbero(uuid),public.marcar_asistencia(uuid,boolean) from public,anon;
grant execute on function public.responder_reserva(uuid,boolean),public.cancelar_reserva_barbero(uuid),public.marcar_asistencia(uuid,boolean) to authenticated;

create function public.meryo_equipo() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare shop bigint:=public.mi_barberia_id();is_owner boolean;begin
 if shop is null then raise exception 'Tu cuenta no tiene acceso activo a un equipo' using errcode='42501';end if;
 is_owner:=public.meryo_es_propietario(shop);
 return jsonb_build_object('shop',shop,'owner',is_owner,'server_now',clock_timestamp(),
 'members',coalesce((select jsonb_agg(to_jsonb(x) order by x.display_name) from (select m.id,m.display_name,m.active,m.user_id,
 case when is_owner or m.user_id=auth.uid() then p.email end email,
 exists(select 1 from meryo_private.shop_owners o where o.user_id=m.user_id and o.barberia_id=shop) propietario,
 coalesce((select jsonb_agg(s.service_id) from public.meryo_team_services s where s.member_id=m.id and s.active),'[]'::jsonb) services,
 coalesce((select jsonb_agg(to_jsonb(h) order by h.day,h.starts) from public.meryo_team_hours h where h.member_id=m.id and h.active),'[]'::jsonb) hours,
 coalesce((select jsonb_agg(to_jsonb(b) order by b.starts) from public.meryo_team_blocks b where b.member_id=m.id and b.active and b.ends>clock_timestamp()),'[]'::jsonb) blocks
 from public.meryo_team_members m join public.profiles p on p.id=m.user_id where m.barberia_id=shop and (is_owner or m.user_id=auth.uid())) x),'[]'::jsonb),
 'invites',case when is_owner then coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'email',i.email,'display_name',i.display_name,'expires_at',i.expires_at,'status',case when i.status='pendiente' and i.expires_at<=clock_timestamp() then 'vencida' else i.status end) order by i.created_at desc) from meryo_private.team_invites i where i.barberia_id=shop),'[]'::jsonb) else '[]'::jsonb end);
end$$;
create function public.meryo_invitar_integrante(p_email text,p_name text) returns jsonb language plpgsql security definer set search_path='' as $$
declare shop bigint:=public.mi_barberia_id();token text;invitation meryo_private.team_invites%rowtype;begin
 if not public.meryo_es_propietario(shop) then raise exception 'Solo el propietario puede invitar' using errcode='42501';end if;
 p_email:=lower(trim(p_email));p_name:=trim(p_name);
 if p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(p_email)>254 or length(p_name) not between 2 and 80 then raise exception 'Revisa correo y nombre profesional';end if;
 perform pg_advisory_xact_lock(hashtextextended('meryo-shop-slot-'||shop::text,0));
 if (select count(*) from meryo_private.team_invites where barberia_id=shop and created_at>clock_timestamp()-interval '1 day')>=50 then raise exception 'Límite diario de invitaciones alcanzado';end if;
 token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
 insert into meryo_private.team_invites(barberia_id,email,display_name,token_hash,created_by) values(shop,p_email,p_name,encode(sha256(convert_to(token,'UTF8')),'hex'),auth.uid()) returning * into invitation;
 insert into meryo_private.shop_events(barberia_id,actor_id,action,after_data) values(shop,auth.uid(),'invitar_integrante',jsonb_build_object('invite',invitation.id,'email',p_email));
 return jsonb_build_object('id',invitation.id,'token',token,'expires_at',invitation.expires_at);
end$$;
create function public.meryo_revocar_invitacion(p_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare shop bigint:=public.mi_barberia_id();begin
 if not public.meryo_es_propietario(shop) then raise exception 'No autorizado' using errcode='42501';end if;
 update meryo_private.team_invites set status='revocada' where id=p_id and barberia_id=shop and status='pendiente';if not found then raise exception 'Invitación pendiente no encontrada';end if;
 insert into meryo_private.shop_events(barberia_id,actor_id,action,after_data) values(shop,auth.uid(),'revocar_invitacion',jsonb_build_object('invite',p_id));return true;
end$$;
create function public.meryo_aceptar_invitacion(p_token text) returns uuid language plpgsql security definer set search_path='' as $$
declare invitation meryo_private.team_invites%rowtype;p public.profiles%rowtype;member uuid;email text;begin
 if not public.meryo_cuenta_activa() or p_token !~ '^[0-9a-f]{64}$' then raise exception 'Inicia sesión con la cuenta invitada' using errcode='42501';end if;
 select * into invitation from meryo_private.team_invites where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') for update;
 if not found or invitation.status<>'pendiente' or invitation.expires_at<=clock_timestamp() then raise exception 'Invitación inválida, usada o vencida';end if;
 select lower(u.email) into email from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null;
 if email is distinct from invitation.email then raise exception 'La invitación pertenece a otro correo verificado' using errcode='42501';end if;
 select * into p from public.profiles where id=auth.uid() for update;
 if p.rol='admin' or (p.barberia_id is not null and p.barberia_id<>invitation.barberia_id) or exists(select 1 from meryo_private.shop_owners where user_id=p.id) then raise exception 'Esta cuenta no puede vincularse a ese equipo';end if;
 perform pg_advisory_xact_lock(hashtextextended('meryo-shop-slot-'||invitation.barberia_id::text,0));
 insert into public.meryo_team_members(barberia_id,user_id,display_name) values(invitation.barberia_id,p.id,invitation.display_name)
 on conflict(user_id) do update set active=true,display_name=excluded.display_name where meryo_team_members.barberia_id=excluded.barberia_id returning id into member;
 if member is null then raise exception 'La cuenta ya pertenece a otro equipo';end if;
 update public.profiles set rol='barbero',barberia_id=invitation.barberia_id where id=p.id;
 update meryo_private.team_invites set status='aceptada',accepted_by=p.id where id=invitation.id;
 insert into meryo_private.shop_events(barberia_id,actor_id,action,after_data) values(invitation.barberia_id,p.id,'aceptar_invitacion',jsonb_build_object('member',member));return member;
end$$;
create function public.meryo_actualizar_integrante(p_member uuid,p_name text,p_active boolean,p_services bigint[]) returns boolean language plpgsql security definer set search_path='' as $$
declare shop bigint:=public.mi_barberia_id();m public.meryo_team_members%rowtype;begin
 if not public.meryo_es_propietario(shop) then raise exception 'Solo el propietario puede gestionar el equipo' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('meryo-shop-slot-'||shop::text,0));
 select * into m from public.meryo_team_members where id=p_member and barberia_id=shop for update;if not found then raise exception 'Integrante no encontrado';end if;
 if p_active is null or length(trim(p_name)) not between 2 and 80 then raise exception 'Nombre o estado inválido';end if;
 if not p_active and exists(select 1 from meryo_private.shop_owners where user_id=m.user_id) then raise exception 'No se puede desactivar al propietario';end if;
 if not p_active and exists(select 1 from public.reservas where barbero_id=m.id and fin>clock_timestamp() and estado in ('solicitada','aceptada','confirmada')) then raise exception 'Primero resuelve las citas pendientes de este integrante; no se cancela ni se cobra automáticamente';end if;
 if exists(select 1 from unnest(coalesce(p_services,'{}'::bigint[])) requested(service_id) where not exists(select 1 from public.servicios s where s.id=requested.service_id and s.barberia_id=shop)) then raise exception 'Servicio de otra barbería' using errcode='42501';end if;
 update public.meryo_team_members set display_name=trim(p_name),active=p_active where id=m.id;
 update public.meryo_team_services set active=false where member_id=m.id;
 insert into public.meryo_team_services(member_id,service_id) select m.id,id from (select distinct unnest(coalesce(p_services,'{}'::bigint[])) id) s on conflict(member_id,service_id) do update set active=true;
 insert into meryo_private.shop_events(barberia_id,actor_id,action,before_data,after_data) values(shop,auth.uid(),'actualizar_integrante',jsonb_build_object('member',m.id,'active',m.active,'name',m.display_name),jsonb_build_object('member',m.id,'active',p_active,'name',trim(p_name),'services',p_services));return true;
end$$;

create function meryo_private.require_owner_member(p_member uuid) returns bigint language plpgsql security definer set search_path='' as $$
declare shop bigint;begin
 select barberia_id into shop from public.meryo_team_members where id=p_member;
 if not public.meryo_es_propietario(shop) then raise exception 'Integrante de otra barbería o cuenta no propietaria' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('meryo-shop-slot-'||shop::text,0));return shop;
end$$;
create function meryo_private.check_member_existing_bookings(p_member uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.reservas r where r.barbero_id=p_member and r.fin>clock_timestamp() and r.estado in ('solicitada','aceptada','confirmada') and not meryo_private.member_time_ok(p_member,r.inicio,r.fin)) then raise exception 'El cambio afectaría citas vigentes. Resuélvelas antes de cambiar la agenda';end if;
end$$;
create function public.meryo_agregar_tramo(p_member uuid,p_day integer,p_kind text,p_start time,p_end time) returns uuid language plpgsql security definer set search_path='' as $$
declare shop bigint;result uuid;begin
 shop:=meryo_private.require_owner_member(p_member);
 if p_start is null or p_end is null or p_end<=p_start or p_day not between 0 and 6 or p_kind not in ('jornada','descanso') then raise exception 'Tramo inválido';end if;
 if exists(select 1 from public.meryo_team_hours where member_id=p_member and day=p_day and kind=p_kind and active and starts<p_end and ends>p_start) then raise exception 'Este tramo se superpone con otro del mismo tipo';end if;
 if p_kind='descanso' and not exists(select 1 from public.meryo_team_hours where member_id=p_member and day=p_day and kind='jornada' and active and starts<=p_start and ends>=p_end) then raise exception 'El descanso debe estar dentro de una jornada';end if;
 insert into public.meryo_team_hours(member_id,day,kind,starts,ends) values(p_member,p_day,p_kind,p_start,p_end) returning id into result;
 perform meryo_private.check_member_existing_bookings(p_member);
 insert into meryo_private.shop_events(barberia_id,actor_id,action,after_data) values(shop,auth.uid(),'agregar_tramo',jsonb_build_object('member',p_member,'id',result,'kind',p_kind,'day',p_day,'start',p_start,'end',p_end));return result;
end$$;
create function public.meryo_retirar_tramo(p_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare member uuid;shop bigint;begin
 select member_id into member from public.meryo_team_hours where id=p_id and active;if member is null then raise exception 'Tramo activo no encontrado';end if;
 shop:=meryo_private.require_owner_member(member);update public.meryo_team_hours set active=false where id=p_id;
 perform meryo_private.check_member_existing_bookings(member);
 insert into meryo_private.shop_events(barberia_id,actor_id,action,after_data) values(shop,auth.uid(),'retirar_tramo',jsonb_build_object('id',p_id,'member',member));return true;
end$$;
create function public.meryo_editar_tramo(p_id uuid,p_start time,p_end time) returns boolean language plpgsql security definer set search_path='' as $$
declare h public.meryo_team_hours%rowtype;shop bigint;begin
 select * into h from public.meryo_team_hours where id=p_id and active;if not found then raise exception 'Tramo no encontrado';end if;
 shop:=meryo_private.require_owner_member(h.member_id);
 if p_start is null or p_end is null or p_end<=p_start then raise exception 'Tramo inválido';end if;
 if exists(select 1 from public.meryo_team_hours where member_id=h.member_id and day=h.day and kind=h.kind and active and id<>h.id and starts<p_end and ends>p_start) then raise exception 'Este tramo se superpone con otro del mismo tipo';end if;
 if h.kind='descanso' and not exists(select 1 from public.meryo_team_hours where member_id=h.member_id and day=h.day and kind='jornada' and active and starts<=p_start and ends>=p_end) then raise exception 'El descanso debe estar dentro de una jornada';end if;
 update public.meryo_team_hours set starts=p_start,ends=p_end where id=h.id;
 perform meryo_private.check_member_existing_bookings(h.member_id);
 insert into meryo_private.shop_events(barberia_id,actor_id,action,before_data,after_data) values(shop,auth.uid(),'editar_tramo',jsonb_build_object('id',p_id,'start',h.starts,'end',h.ends),jsonb_build_object('id',p_id,'start',p_start,'end',p_end));return true;
end$$;
create function public.meryo_agregar_bloqueo(p_member uuid,p_start timestamptz,p_end timestamptz,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare shop bigint;result uuid;begin
 shop:=meryo_private.require_owner_member(p_member);
 if p_start is null or p_end is null or p_end<=p_start or p_end<=clock_timestamp() or p_end-p_start>interval '366 days' or length(trim(coalesce(p_reason,''))) not between 3 and 300 then raise exception 'Revisa fechas y motivo del bloqueo; debe terminar en el futuro';end if;
 insert into public.meryo_team_blocks(member_id,starts,ends,reason) values(p_member,p_start,p_end,trim(p_reason)) returning id into result;
 perform meryo_private.check_member_existing_bookings(p_member);
 insert into meryo_private.shop_events(barberia_id,actor_id,action,after_data) values(shop,auth.uid(),'agregar_bloqueo',jsonb_build_object('id',result,'member',p_member,'start',p_start,'end',p_end,'reason',trim(p_reason)));return result;
end$$;
create function public.meryo_retirar_bloqueo(p_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare member uuid;shop bigint;begin
 select member_id into member from public.meryo_team_blocks where id=p_id and active;if member is null then raise exception 'Bloqueo activo no encontrado';end if;
 shop:=meryo_private.require_owner_member(member);update public.meryo_team_blocks set active=false where id=p_id;
 insert into meryo_private.shop_events(barberia_id,actor_id,action,after_data) values(shop,auth.uid(),'retirar_bloqueo',jsonb_build_object('id',p_id,'member',member));return true;
end$$;
revoke all on function public.meryo_equipo(),public.meryo_invitar_integrante(text,text),public.meryo_revocar_invitacion(uuid),public.meryo_aceptar_invitacion(text),public.meryo_actualizar_integrante(uuid,text,boolean,bigint[]),public.meryo_agregar_tramo(uuid,integer,text,time,time),public.meryo_retirar_tramo(uuid),public.meryo_agregar_bloqueo(uuid,timestamptz,timestamptz,text),public.meryo_retirar_bloqueo(uuid) from public,anon;
grant execute on function public.meryo_equipo(),public.meryo_invitar_integrante(text,text),public.meryo_revocar_invitacion(uuid),public.meryo_aceptar_invitacion(text),public.meryo_actualizar_integrante(uuid,text,boolean,bigint[]),public.meryo_agregar_tramo(uuid,integer,text,time,time),public.meryo_retirar_tramo(uuid),public.meryo_agregar_bloqueo(uuid,timestamptz,timestamptz,text),public.meryo_retirar_bloqueo(uuid) to authenticated;
revoke all on function public.meryo_editar_tramo(uuid,time,time) from public,anon;
grant execute on function public.meryo_editar_tramo(uuid,time,time) to authenticated;

-- Keep the existing general-hours editor and owner calendar consistent.
create function meryo_private.sync_general_hours() returns trigger language plpgsql security definer set search_path='' as $$
declare shop bigint:=coalesce(new.barberia_id,old.barberia_id);member uuid;begin
 perform pg_advisory_xact_lock(hashtextextended('meryo-shop-slot-'||shop::text,0));
 select m.id into member from public.meryo_team_members m join meryo_private.shop_owners o on o.user_id=m.user_id where m.barberia_id=shop;
 if tg_op='DELETE' then update public.meryo_team_hours set active=false,legacy_hour_id=null where legacy_hour_id=old.id;return old;end if;
 if member is not null then
  insert into public.meryo_team_hours(member_id,day,kind,starts,ends,legacy_hour_id) values(member,new.dia_semana,'jornada',new.hora_apertura,new.hora_cierre,new.id)
  on conflict(legacy_hour_id) do nothing;
 end if;return new;
end$$;
create trigger meryo_sync_general_hours after insert or update on public.horarios for each row execute function meryo_private.sync_general_hours();
create trigger meryo_sync_general_delete before delete on public.horarios for each row execute function meryo_private.sync_general_hours();
create function meryo_private.check_general_bookings() returns trigger language plpgsql security definer set search_path='' as $$
declare shop bigint:=coalesce(new.barberia_id,old.barberia_id);begin
 perform pg_advisory_xact_lock(hashtextextended('meryo-shop-slot-'||shop::text,0));
 if exists(select 1 from public.reservas r where r.barberia_id=shop and r.fin>clock_timestamp() and r.estado in ('solicitada','aceptada','confirmada') and
 (case when r.barbero_id is not null then not meryo_private.member_time_ok(r.barbero_id,r.inicio,r.fin) else
 not exists(select 1 from public.horarios h where h.barberia_id=shop and h.dia_semana=extract(dow from r.inicio at time zone 'America/Lima')::int and h.hora_apertura<=(r.inicio at time zone 'America/Lima')::time and h.hora_cierre>=(r.fin at time zone 'America/Lima')::time)
 or exists(select 1 from public.bloqueos b where b.barberia_id=shop and tstzrange(b.inicio,b.fin,'[)')&&tstzrange(r.inicio,r.fin,'[)')) end)) then raise exception 'El horario general o bloqueo afectaría citas vigentes';end if;
 return null;
end$$;
create constraint trigger meryo_general_hours_safe after insert or update or delete on public.horarios deferrable initially deferred for each row execute function meryo_private.check_general_bookings();
create constraint trigger meryo_general_blocks_safe after insert or update or delete on public.bloqueos deferrable initially deferred for each row execute function meryo_private.check_general_bookings();

alter function public.meryo_catalogo_publico() rename to meryo_catalogo_base_012;
revoke all on function public.meryo_catalogo_base_012() from public,anon,authenticated;
create function public.meryo_catalogo_publico() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(b||jsonb_build_object('equipo',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'nombre',m.display_name,'propietario',exists(select 1 from meryo_private.shop_owners o where o.user_id=m.user_id),'servicios',coalesce((select jsonb_agg(s.service_id) from public.meryo_team_services s where s.member_id=m.id and s.active),'[]'::jsonb)) order by m.display_name,m.id) from public.meryo_team_members m join public.profiles p on p.id=m.user_id where m.barberia_id=(b->>'id')::bigint and m.active and p.activo),'[]'::jsonb))),'[]'::jsonb)
 from jsonb_array_elements(public.meryo_catalogo_base_012()) b;
$$;
revoke all on function public.meryo_catalogo_publico() from public;
grant execute on function public.meryo_catalogo_publico() to anon,authenticated;
do $admin_search$declare source text;begin
 source:=pg_get_functiondef('public.meryo_admin_reservas(date,date,bigint,text,text,integer)'::regprocedure);
 source:=replace(source,'to_jsonb(r)->>''barbero_id'')))','to_jsonb(r)->>''barbero_id'',to_jsonb(r)->>''barbero_nombre'')))');
 source:=replace(source,'to_jsonb(r)->>''barbero_id'' barbero_id,not','to_jsonb(r)->>''barbero_id'' barbero_id,to_jsonb(r)->>''barbero_nombre'' barbero_nombre,not');execute source;
 source:=pg_get_functiondef('public.meryo_admin_usuarios(text,text,text,integer)'::regprocedure);
 source:=replace(source,'p.activo,p.barberia_id','p.activo,(select m.active from public.meryo_team_members m where m.user_id=p.id) team_active,p.barberia_id');execute source;
 source:=pg_get_functiondef('public.meryo_admin_barberias()'::regprocedure);
 source:=replace(source,'''activo'',p.activo,''propietario''','''activo'',(p.activo and coalesce((select m.active from public.meryo_team_members m where m.user_id=p.id),false)),''propietario''');execute source;
 source:=pg_get_functiondef('public.meryo_reservas_estado()'::regprocedure);
 source:=replace(source,'''pagos'',(select','''puede_responder'',(public.meryo_es_propietario(r.barberia_id) or public.meryo_es_cita_asignada(r.barbero_id)),''pagos'',(select');execute source;
end $admin_search$;
notify pgrst,'reload schema';
commit;
