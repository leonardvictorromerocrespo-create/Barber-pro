begin;

-- Extend the current business and service contracts without rewriting existing
-- profiles, approvals, appointments, store orders, or their histories.
alter table public.barberias
  add column if not exists tipos_negocio text[] not null default array['barberia']::text[];
alter table public.barberias drop constraint if exists barberias_tipos_negocio_check;
alter table public.barberias add constraint barberias_tipos_negocio_check check (
  cardinality(tipos_negocio) between 1 and 2
  and tipos_negocio <@ array['barberia','belleza']::text[]
  and (cardinality(tipos_negocio)=1 or tipos_negocio[1]<>tipos_negocio[2])
);

alter table public.servicios
  add column if not exists categoria text not null default 'general',
  add column if not exists requiere_evaluacion boolean not null default false;
-- Older installations may already contain the flag from an earlier draft but
-- without a default; keep existing clients that omit the new field working.
alter table public.servicios alter column requiere_evaluacion set default false;
alter table public.servicios alter column precio drop not null;
alter table public.servicios alter column duracion_min drop not null;
alter table public.servicios drop constraint if exists servicios_categoria_check;
alter table public.servicios add constraint servicios_categoria_check check (
  categoria in ('general','cortes','coloracion','peinados','tratamientos_capilares','manicure','pedicure','depilacion')
);
alter table public.servicios drop constraint if exists servicios_evaluacion_precio_duracion_check;
alter table public.servicios add constraint servicios_evaluacion_precio_duracion_check check (
  (requiere_evaluacion and precio is null and duracion_min is null)
  or (not requiere_evaluacion and precio is not null and duracion_min is not null)
);
grant select (categoria,requiere_evaluacion) on public.servicios to authenticated;
grant insert (categoria,requiere_evaluacion) on public.servicios to authenticated;
grant update (categoria,requiere_evaluacion) on public.servicios to authenticated;

create or replace function public.registrar_negocio(
  p_nombre text,p_distrito text,p_direccion text,p_descripcion text,
  p_lat double precision,p_lng double precision,p_whatsapp text,p_correo text,
  p_tipo_negocio text
) returns bigint
language plpgsql security definer set search_path=''
as $$
declare shop_id bigint; business_types text[];
begin
  if p_tipo_negocio is null or p_tipo_negocio not in ('barberia','belleza','ambos') then
    raise exception 'Selecciona un tipo de negocio válido';
  end if;
  business_types:=case p_tipo_negocio
    when 'barberia' then array['barberia']::text[]
    when 'belleza' then array['belleza']::text[]
    else array['barberia','belleza']::text[] end;
  -- Reuse the established server-side signup, role, owner, and pending-review flow.
  shop_id:=public.registrar_barberia(p_nombre,p_distrito,p_direccion,p_descripcion,p_lat,p_lng,p_whatsapp,p_correo);
  update public.barberias set tipos_negocio=business_types
   where id=shop_id and public.meryo_es_propietario(shop_id);
  if not found then raise exception 'No se pudo asociar la categoría a tu negocio'; end if;
  return shop_id;
end;
$$;
revoke all on function public.registrar_negocio(text,text,text,text,double precision,double precision,text,text,text) from public,anon;
grant execute on function public.registrar_negocio(text,text,text,text,double precision,double precision,text,text,text) to authenticated;

create or replace function public.meryo_catalogo_categoria(p_categoria text) returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare result jsonb;
begin
  if p_categoria is null or p_categoria not in ('barberia','belleza') then raise exception 'Categoría de catálogo no válida'; end if;
  select coalesce(jsonb_agg(
    b || jsonb_build_object(
      'tipos_negocio',to_jsonb(shop.tipos_negocio),
      'servicios',coalesce((
        select jsonb_agg(svc || jsonb_build_object(
          'categoria',service.categoria,'requiere_evaluacion',service.requiere_evaluacion
        ) order by service.nombre,service.id)
        from jsonb_array_elements(coalesce(b->'servicios','[]'::jsonb)) svc
        join public.servicios service on service.id=(svc->>'id')::bigint
          and service.barberia_id=shop.id and service.activo
      ),'[]'::jsonb)
    ) order by shop.nombre,shop.id
  ),'[]'::jsonb) into result
  from jsonb_array_elements(public.meryo_catalogo_publico()) b
  join public.barberias shop on shop.id=(b->>'id')::bigint
  where p_categoria=any(shop.tipos_negocio);
  return result;
end;
$$;
revoke all on function public.meryo_catalogo_categoria(text) from public;
grant execute on function public.meryo_catalogo_categoria(text) to anon,authenticated;

create or replace function public.meryo_barberos_servicio(p_shop bigint,p_service bigint) returns jsonb
language sql stable security definer set search_path=''
as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'nombre',m.display_name) order by m.display_name,m.id),'[]'::jsonb)
 from public.meryo_team_members m join public.profiles p on p.id=m.user_id join public.barberias b on b.id=m.barberia_id
 where m.barberia_id=p_shop and m.active and p.activo and b.verificada and b.estado='activa' and public.meryo_barberia_publicable(b.id)
 and exists(select 1 from public.meryo_team_services ms join public.servicios s on s.id=ms.service_id
  where ms.member_id=m.id and ms.service_id=p_service and ms.active and s.activo and s.barberia_id=p_shop
    and not s.requiere_evaluacion and s.precio is not null and s.duracion_min is not null);
$$;

create or replace function public.meryo_horarios_barbero(p_shop bigint,p_service bigint,p_date date,p_member uuid)
returns table(hora_inicio timestamptz)
language plpgsql stable security definer set search_path=''
as $$
declare duration integer;step integer:=public.cfg('paso_minutos')::int;
begin
 if p_date is null or p_date<(clock_timestamp() at time zone 'America/Lima')::date or p_date>(clock_timestamp() at time zone 'America/Lima')::date+30 then return;end if;
 if not exists(select 1 from jsonb_array_elements(public.meryo_barberos_servicio(p_shop,p_service)) m where m->>'id'=p_member::text) then return;end if;
 select duracion_min into duration from public.servicios where id=p_service and barberia_id=p_shop and activo
   and not requiere_evaluacion and precio is not null and duracion_min is not null;
 if duration is null then return;end if;
 return query select t from generate_series(p_date::timestamp at time zone 'America/Lima',((p_date+1)::timestamp at time zone 'America/Lima')-make_interval(mins=>duration),make_interval(mins=>step)) t
 where t>=clock_timestamp()+make_interval(mins=>public.cfg('minutos_anticipacion_minima')::int) and t<=clock_timestamp()+interval '30 days'
 and meryo_private.member_time_ok(p_member,t,t+make_interval(mins=>duration))
 and not exists(select 1 from public.reservas r where r.barberia_id=p_shop and (r.barbero_id=p_member or r.barbero_id is null)
  and tstzrange(r.inicio,r.fin,'[)')&&tstzrange(t,t+make_interval(mins=>duration),'[)')
  and (r.estado='confirmada' or(r.estado='solicitada' and r.expira_respuesta_en>clock_timestamp()) or(r.estado='aceptada' and(r.expira_pago_en is null or r.expira_pago_en>clock_timestamp())))) order by t;
end;
$$;

create or replace function public.meryo_rechazar_servicio_no_reservable() returns trigger
language plpgsql security definer set search_path=''
as $$
declare evaluation_required boolean;service_price numeric;service_duration integer;service_active boolean;
begin
  if tg_op='UPDATE' and new.servicio_id is not distinct from old.servicio_id then return new; end if;
  select requiere_evaluacion,precio,duracion_min,activo into evaluation_required,service_price,service_duration,service_active
    from public.servicios where id=new.servicio_id and barberia_id=new.barberia_id;
  if not found or not service_active or evaluation_required or service_price is null or service_duration is null then
    raise exception 'Este servicio requiere evaluación o debe definir precio y duración antes de reservar';
  end if;
  return new;
end;
$$;
revoke all on function public.meryo_rechazar_servicio_no_reservable() from public,anon,authenticated;
drop trigger if exists meryo_reserva_servicio_reservable on public.reservas;
create trigger meryo_reserva_servicio_reservable before insert or update on public.reservas
for each row execute function public.meryo_rechazar_servicio_no_reservable();

notify pgrst,'reload schema';
commit;
