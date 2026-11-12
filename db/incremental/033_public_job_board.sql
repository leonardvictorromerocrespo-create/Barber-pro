begin;

do $preflight$
begin
  if to_regclass('meryo_private') is null
     or to_regclass('public.barberias') is null
     or to_regclass('public.profiles') is null
     or to_regprocedure('public.mi_barberia_id()') is null
     or to_regprocedure('public.meryo_es_propietario(bigint)') is null
     or to_regprocedure('public.meryo_barberia_publicable(bigint)') is null then
    raise exception 'Job board requires the existing verified business and owner helpers';
  end if;
  if to_regclass('meryo_private.job_listings') is not null then
    raise exception 'Job board table already exists; migration 033 must not be applied twice';
  end if;
end;
$preflight$;

create table meryo_private.job_listings (
  id uuid primary key default gen_random_uuid(),
  barberia_id bigint not null references public.barberias(id) on delete cascade,
  puesto text not null check (length(btrim(puesto)) between 3 and 80),
  distrito text not null check (length(btrim(distrito)) between 2 and 80),
  horario text not null check (length(btrim(horario)) between 2 and 120),
  descripcion text not null default '' check (length(descripcion) <= 700),
  vence_el date not null default (current_date + 30),
  publicada boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (vence_el > created_at::date)
);
alter table meryo_private.job_listings enable row level security;
revoke all on meryo_private.job_listings from public, anon, authenticated;
create index job_listings_public_page
  on meryo_private.job_listings (created_at desc, id)
  where publicada;

create function public.meryo_vacantes_publicas(p_distrito text default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare result jsonb;
begin
  if p_distrito is not null and length(btrim(p_distrito)) > 80 then
    raise exception 'Distrito no válido' using errcode='22023';
  end if;
  select coalesce(jsonb_agg(to_jsonb(page_row) order by page_row.created_at desc, page_row.id), '[]'::jsonb)
  into result
  from (
    select j.id,j.puesto,j.distrito,j.horario,j.descripcion,j.vence_el,j.created_at,
      b.id barberia_id,b.nombre barberia,b.whatsapp
    from meryo_private.job_listings j
    join public.barberias b on b.id=j.barberia_id
    where j.publicada and j.vence_el >= current_date
      and b.verificada and b.estado='activa' and 'barberia'=any(b.tipos_negocio)
      and public.meryo_barberia_publicable(b.id)
      and (p_distrito is null or lower(j.distrito)=lower(btrim(p_distrito)))
    order by j.created_at desc,j.id
    limit 60
  ) page_row;
  return result;
end;
$$;

create function public.meryo_vacantes_propietario()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare shop_id bigint := public.mi_barberia_id(); result jsonb;
begin
  if shop_id is null or not public.meryo_es_propietario(shop_id) then
    raise exception 'Solo el propietario puede gestionar vacantes' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(to_jsonb(j) order by j.updated_at desc,j.id), '[]'::jsonb)
  into result
  from meryo_private.job_listings j
  where j.barberia_id=shop_id;
  return result;
end;
$$;

create function public.meryo_guardar_vacante(
  p_id uuid,p_puesto text,p_distrito text,p_horario text,p_descripcion text,p_vence_el date,p_publicada boolean
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare shop_id bigint := public.mi_barberia_id(); listing_id uuid; current_user_id uuid := auth.uid();
begin
  if shop_id is null or not public.meryo_es_propietario(shop_id) then
    raise exception 'Solo el propietario puede publicar vacantes' using errcode='42501';
  end if;
  if current_user_id is null or not exists(
    select 1 from public.profiles p where p.id=current_user_id and p.activo and p.rol='barbero'
      and p.barberia_id=shop_id
  ) then
    raise exception 'Cuenta profesional no autorizada' using errcode='42501';
  end if;
  if p_publicada is null
     or length(btrim(coalesce(p_puesto,''))) not between 3 and 80
     or length(btrim(coalesce(p_distrito,''))) not between 2 and 80
     or length(btrim(coalesce(p_horario,''))) not between 2 and 120
     or length(coalesce(p_descripcion,'')) > 700
     or p_vence_el is null or p_vence_el <= current_date or p_vence_el > current_date + 90 then
    raise exception 'Revisa los datos: el vencimiento debe estar entre mañana y 90 días' using errcode='22023';
  end if;
  if p_publicada and not exists(
    select 1 from public.barberias b
    where b.id=shop_id and b.verificada and b.estado='activa'
      and 'barberia'=any(b.tipos_negocio) and public.meryo_barberia_publicable(b.id)
  ) then
    raise exception 'Tu barbería debe estar aprobada para publicar vacantes' using errcode='42501';
  end if;

  if p_id is null then
    insert into meryo_private.job_listings(barberia_id,puesto,distrito,horario,descripcion,vence_el,publicada,created_by)
    values(shop_id,btrim(p_puesto),btrim(p_distrito),btrim(p_horario),coalesce(p_descripcion,''),p_vence_el,p_publicada,current_user_id)
    returning id into listing_id;
  else
    update meryo_private.job_listings
    set puesto=btrim(p_puesto),distrito=btrim(p_distrito),horario=btrim(p_horario),
        descripcion=coalesce(p_descripcion,''),vence_el=p_vence_el,publicada=p_publicada,
        updated_at=clock_timestamp()
    where id=p_id and barberia_id=shop_id
    returning id into listing_id;
    if listing_id is null then raise exception 'Vacante no encontrada' using errcode='P0002'; end if;
  end if;
  return listing_id;
end;
$$;

revoke all on function public.meryo_vacantes_publicas(text) from public,authenticated,anon;
revoke all on function public.meryo_vacantes_propietario() from public,authenticated,anon;
revoke all on function public.meryo_guardar_vacante(uuid,text,text,text,text,date,boolean) from public,authenticated,anon;
grant execute on function public.meryo_vacantes_publicas(text) to anon,authenticated;
grant execute on function public.meryo_vacantes_propietario() to authenticated;
grant execute on function public.meryo_guardar_vacante(uuid,text,text,text,text,date,boolean) to authenticated;

notify pgrst,'reload schema';
commit;
