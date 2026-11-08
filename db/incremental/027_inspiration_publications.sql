begin;

-- Inspiration is a publication record pointing at an existing private Storage
-- asset. This migration creates neither a second bucket nor duplicate files.
do $preflight$
begin
  if to_regclass('public.meryo_shop_assets') is null
     or to_regclass('public.meryo_team_members') is null
     or to_regclass('public.meryo_team_services') is null
     or to_regclass('public.servicios') is null
     or to_regclass('public.reservas') is null
     or to_regclass('meryo_private.shop_events') is null
     or to_regprocedure('public.mi_barberia_id()') is null
     or to_regprocedure('public.meryo_es_propietario(bigint)') is null
     or to_regprocedure('public.meryo_barberia_publicable(bigint)') is null
     or to_regprocedure('public.meryo_solicitar_cita(bigint,bigint,timestamptz,text,text,text,numeric,uuid,uuid,numeric,uuid,numeric,numeric,numeric)') is null then
    raise exception 'Inspiration requires Storage, team scheduling, beauty catalog and reservation migration 026';
  end if;
  if to_regclass('meryo_private.inspiration_publications') is not null
     or exists(select 1 from pg_attribute where attrelid='public.reservas'::regclass and attname='inspiration_publication_id' and not attisdropped) then
    raise exception 'Inspiration already exists; migration 027 must not be applied twice';
  end if;
end;
$preflight$;

-- Composite unique indexes let the database enforce that linked media,
-- members, and services belong to the same business as the publication.
create unique index meryo_shop_assets_id_shop_uq on public.meryo_shop_assets(id,barberia_id);
create unique index servicios_id_shop_uq on public.servicios(id,barberia_id);

create table meryo_private.inspiration_publications (
  id uuid primary key default gen_random_uuid(),
  barberia_id bigint not null references public.barberias(id) on delete restrict,
  asset_id uuid not null,
  catalog_category text not null check(catalog_category in ('barberia','belleza')),
  work_category text not null check(work_category in ('corte','barba','coloracion','peinados','tratamientos_capilares','manicure','pedicure','depilacion')),
  title text not null check(length(trim(title)) between 2 and 80),
  description text not null default '' check(length(description)<=500),
  member_id uuid,
  service_id bigint,
  published boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(barberia_id,asset_id),
  unique(id,barberia_id),
  check(catalog_category='barberia' or work_category<>'barba'),
  foreign key(asset_id,barberia_id) references public.meryo_shop_assets(id,barberia_id) on delete restrict,
  foreign key(member_id,barberia_id) references public.meryo_team_members(id,barberia_id) on delete restrict,
  foreign key(service_id,barberia_id) references public.servicios(id,barberia_id) on delete restrict
);
alter table meryo_private.inspiration_publications enable row level security;
revoke all on meryo_private.inspiration_publications from public,anon,authenticated;

create index inspiration_public_category_page on meryo_private.inspiration_publications
  (catalog_category,work_category,created_at desc,id desc) where published;

alter table public.reservas
  add column inspiration_publication_id uuid references meryo_private.inspiration_publications(id) on delete restrict,
  add column inspiration_title_snapshot text,
  add constraint reservas_inspiration_snapshot_pair check(
    (inspiration_publication_id is null and inspiration_title_snapshot is null)
    or (inspiration_publication_id is not null and length(trim(inspiration_title_snapshot)) between 2 and 80)
  );

create function meryo_private.guard_inspiration_asset_retirement() returns trigger
language plpgsql security definer set search_path=''
as $$
begin
  if old.active and not new.active then
    update meryo_private.inspiration_publications
      set published=false,updated_at=clock_timestamp()
      where asset_id=new.id and published;
  end if;
  return new;
end;
$$;
create trigger meryo_inspiration_asset_retirement
  after update of active on public.meryo_shop_assets
  for each row execute function meryo_private.guard_inspiration_asset_retirement();

create function public.meryo_inspiracion(
  p_catalog_category text,p_work_category text default null,p_limit integer default 24,p_offset integer default 0
) returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare result jsonb;
begin
  if p_catalog_category is null or p_catalog_category not in ('barberia','belleza') then
    raise exception 'Categoría de inspiración no válida';
  end if;
  if p_work_category is not null and p_work_category not in ('corte','barba','coloracion','peinados','tratamientos_capilares','manicure','pedicure','depilacion') then
    raise exception 'Categoría de trabajo no válida';
  end if;
  if p_limit is null or p_limit<1 or p_limit>36 or p_offset is null or p_offset<0 or p_offset>10000 then
    raise exception 'Paginación no válida';
  end if;
  select coalesce(jsonb_agg(to_jsonb(page_row) order by page_row.created_at desc,page_row.id desc),'[]'::jsonb)
  into result
  from (
    select pub.id,pub.asset_id,asset.object_path,pub.catalog_category,pub.work_category,pub.title,pub.description,
      pub.barberia_id,shop.nombre shop_name,shop.tipos_negocio,
      pub.member_id,member.display_name professional_name,
      pub.service_id,service.nombre service_name,
      (pub.member_id is not null and pub.service_id is not null and exists(
        select 1 from public.meryo_team_members active_member
        join public.profiles professional on professional.id=active_member.user_id
        join public.meryo_team_services assigned on assigned.member_id=active_member.id and assigned.service_id=pub.service_id and assigned.active
        join public.servicios active_service on active_service.id=assigned.service_id and active_service.barberia_id=shop.id
        where active_member.id=pub.member_id and active_member.barberia_id=shop.id and active_member.active and professional.activo
          and active_service.activo and not active_service.requiere_evaluacion
          and active_service.precio is not null and active_service.precio>0
          and active_service.duracion_min between 1 and 240
      )) can_request,
      pub.created_at
    from meryo_private.inspiration_publications pub
    join public.barberias shop on shop.id=pub.barberia_id
    join public.meryo_shop_assets asset on asset.id=pub.asset_id and asset.barberia_id=pub.barberia_id
      and asset.active and asset.kind='foto' and asset.title<>'[meryo-profile-photo]'
    left join public.meryo_team_members member on member.id=pub.member_id and member.barberia_id=pub.barberia_id
    left join public.servicios service on service.id=pub.service_id and service.barberia_id=pub.barberia_id
    where pub.published and pub.catalog_category=p_catalog_category
      and (p_work_category is null or pub.work_category=p_work_category)
      and p_catalog_category=any(shop.tipos_negocio)
      and shop.verificada and shop.estado='activa' and public.meryo_barberia_publicable(shop.id)
    order by pub.created_at desc,pub.id desc
    limit p_limit offset p_offset
  ) page_row;
  return result;
end;
$$;
revoke all on function public.meryo_inspiracion(text,text,integer,integer) from public;
grant execute on function public.meryo_inspiracion(text,text,integer,integer) to anon,authenticated;

create function public.meryo_inspiracion_publicacion(p_id uuid) returns jsonb
language sql stable security definer set search_path=''
as $$
  select to_jsonb(row_data) from (
    select pub.id,pub.asset_id,asset.object_path,pub.catalog_category,pub.work_category,pub.title,pub.description,
      pub.barberia_id,shop.nombre shop_name,shop.tipos_negocio,
      pub.member_id,member.display_name professional_name,pub.service_id,service.nombre service_name,
      (pub.member_id is not null and pub.service_id is not null and exists(
        select 1 from public.meryo_team_members active_member
        join public.profiles professional on professional.id=active_member.user_id
        join public.meryo_team_services assigned on assigned.member_id=active_member.id and assigned.service_id=pub.service_id and assigned.active
        join public.servicios active_service on active_service.id=assigned.service_id and active_service.barberia_id=shop.id
        where active_member.id=pub.member_id and active_member.barberia_id=shop.id and active_member.active and professional.activo
          and active_service.activo and not active_service.requiere_evaluacion
          and active_service.precio is not null and active_service.precio>0 and active_service.duracion_min between 1 and 240
      )) can_request
    from meryo_private.inspiration_publications pub
    join public.barberias shop on shop.id=pub.barberia_id
    join public.meryo_shop_assets asset on asset.id=pub.asset_id and asset.barberia_id=pub.barberia_id
      and asset.active and asset.kind='foto' and asset.title<>'[meryo-profile-photo]'
    left join public.meryo_team_members member on member.id=pub.member_id and member.barberia_id=pub.barberia_id
    left join public.servicios service on service.id=pub.service_id and service.barberia_id=pub.barberia_id
    where pub.id=p_id and pub.published and pub.catalog_category=any(shop.tipos_negocio)
      and shop.verificada and shop.estado='activa' and public.meryo_barberia_publicable(shop.id)
  ) row_data;
$$;
revoke all on function public.meryo_inspiracion_publicacion(uuid) from public;
grant execute on function public.meryo_inspiracion_publicacion(uuid) to anon,authenticated;

create function public.meryo_inspiracion_propietario() returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare shop_id bigint:=public.mi_barberia_id(); result jsonb;
begin
  if shop_id is null or not public.meryo_es_propietario(shop_id) then
    raise exception 'Solo el propietario puede gestionar Inspiración' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(to_jsonb(pub) order by pub.updated_at desc,pub.id),'[]'::jsonb)
    into result from meryo_private.inspiration_publications pub where pub.barberia_id=shop_id;
  return result;
end;
$$;
revoke all on function public.meryo_inspiracion_propietario() from public,anon;
grant execute on function public.meryo_inspiracion_propietario() to authenticated;

create function public.meryo_guardar_inspiracion(
  p_id uuid,p_asset_id uuid,p_catalog_category text,p_work_category text,p_title text,p_description text,
  p_member_id uuid,p_service_id bigint,p_published boolean
) returns uuid language plpgsql security definer set search_path=''
as $$
declare shop_id bigint:=public.mi_barberia_id(); asset public.meryo_shop_assets%rowtype; publication_id uuid; existing_id uuid;
begin
  if shop_id is null or not public.meryo_es_propietario(shop_id) then
    raise exception 'Solo el propietario puede gestionar Inspiración' using errcode='42501';
  end if;
  if p_catalog_category is null or p_catalog_category not in ('barberia','belleza')
     or p_work_category is null or p_work_category not in ('corte','barba','coloracion','peinados','tratamientos_capilares','manicure','pedicure','depilacion')
     or p_published is null then raise exception 'Completa las categorías de la publicación'; end if;
  if p_catalog_category='belleza' and p_work_category='barba' then raise exception 'La categoría barba solo está disponible en Barberías'; end if;
  if length(trim(coalesce(p_title,'')))<2 or length(p_title)>80 or length(coalesce(p_description,''))>500 then
    raise exception 'El título debe tener de 2 a 80 caracteres y la descripción hasta 500';
  end if;
  perform 1 from public.barberias where id=shop_id for update;
  if not exists(select 1 from public.barberias where id=shop_id and p_catalog_category=any(tipos_negocio)) then
    raise exception 'El negocio no está clasificado en esa categoría';
  end if;
  select * into asset from public.meryo_shop_assets where id=p_asset_id and barberia_id=shop_id and active
    and kind='foto' and title<>'[meryo-profile-photo]' for share;
  if not found then raise exception 'Elige una foto activa del portafolio de este negocio'; end if;
  if p_member_id is not null and not exists(select 1 from public.meryo_team_members where id=p_member_id and barberia_id=shop_id) then
    raise exception 'El profesional debe pertenecer al equipo de este negocio';
  end if;
  if p_service_id is not null and not exists(select 1 from public.servicios where id=p_service_id and barberia_id=shop_id) then
    raise exception 'El servicio debe pertenecer a este negocio';
  end if;
  if p_id is null then
    select id into existing_id from meryo_private.inspiration_publications where barberia_id=shop_id and asset_id=p_asset_id for update;
    publication_id:=coalesce(existing_id,gen_random_uuid());
    if existing_id is null then
      insert into meryo_private.inspiration_publications(id,barberia_id,asset_id,catalog_category,work_category,title,description,member_id,service_id,published,created_by)
      values(publication_id,shop_id,p_asset_id,p_catalog_category,p_work_category,trim(p_title),trim(coalesce(p_description,'')),p_member_id,p_service_id,p_published,auth.uid());
    else
      update meryo_private.inspiration_publications set catalog_category=p_catalog_category,work_category=p_work_category,
        title=trim(p_title),description=trim(coalesce(p_description,'')),member_id=p_member_id,service_id=p_service_id,
        published=p_published,updated_at=clock_timestamp() where id=publication_id and barberia_id=shop_id;
    end if;
  else
    update meryo_private.inspiration_publications set asset_id=p_asset_id,catalog_category=p_catalog_category,
      work_category=p_work_category,title=trim(p_title),description=trim(coalesce(p_description,'')),member_id=p_member_id,
      service_id=p_service_id,published=p_published,updated_at=clock_timestamp()
      where id=p_id and barberia_id=shop_id returning id into publication_id;
    if not found then raise exception 'Publicación no encontrada en tu negocio' using errcode='42501'; end if;
  end if;
  insert into meryo_private.shop_events(barberia_id,actor_id,action,after_data)
    values(shop_id,auth.uid(),case when p_published then 'inspiracion_publicada' else 'inspiracion_guardada' end,
      jsonb_build_object('publication_id',publication_id,'asset_id',p_asset_id,'published',p_published));
  return publication_id;
end;
$$;
revoke all on function public.meryo_guardar_inspiracion(uuid,uuid,text,text,text,text,uuid,bigint,boolean) from public,anon;
grant execute on function public.meryo_guardar_inspiracion(uuid,uuid,text,text,text,text,uuid,bigint,boolean) to authenticated;

-- The wrapper locks the publication, media, service, and assigned professional
-- while the existing 026 reservation transaction revalidates price and slot.
-- Its single transaction records the stable publication ID and title snapshot.
create function public.meryo_solicitar_cita(
  p_barberia_id bigint,p_servicio_id bigint,p_inicio timestamptz,p_nombre text,p_telefono text,
  p_pedido text,p_extra numeric,p_barbero_id uuid,p_campaign_id uuid,p_precio_habitual numeric,
  p_beauty_campaign_id uuid,p_beauty_regular_price numeric,p_beauty_expected_price numeric,
  p_precio_esperado numeric,p_inspiration_publication_id uuid
) returns uuid language plpgsql security definer set search_path=''
as $$
declare publication meryo_private.inspiration_publications%rowtype; asset_id uuid; current_price numeric; reservation_id uuid;
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and activo and rol='cliente') then
    raise exception 'Inicia sesión con una cuenta de cliente activa' using errcode='42501';
  end if;
  if p_inspiration_publication_id is null then
    return public.meryo_solicitar_cita(p_barberia_id,p_servicio_id,p_inicio,p_nombre,p_telefono,p_pedido,p_extra,p_barbero_id,
      p_campaign_id,p_precio_habitual,p_beauty_campaign_id,p_beauty_regular_price,p_beauty_expected_price,p_precio_esperado);
  end if;
  if p_campaign_id is not null or p_beauty_campaign_id is not null then
    raise exception 'Revisa las promociones desde su flujo antes de solicitar este estilo';
  end if;
  select pub.* into publication
  from meryo_private.inspiration_publications pub join public.barberias shop on shop.id=pub.barberia_id
  where pub.id=p_inspiration_publication_id and pub.published and pub.barberia_id=p_barberia_id
    and pub.catalog_category=any(shop.tipos_negocio) and shop.verificada and shop.estado='activa'
    and public.meryo_barberia_publicable(shop.id)
  for share of pub,shop;
  if not found then raise exception 'Este trabajo ya no está publicado. Revisa el servicio actual antes de continuar.'; end if;
  if publication.service_id is null or publication.member_id is null
     or publication.service_id is distinct from p_servicio_id or publication.member_id is distinct from p_barbero_id then
    raise exception 'El servicio o profesional de la referencia cambió. Revisa tu selección antes de continuar.';
  end if;
  select asset.id into asset_id from public.meryo_shop_assets asset where asset.id=publication.asset_id
    and asset.barberia_id=publication.barberia_id and asset.active and asset.kind='foto' and asset.title<>'[meryo-profile-photo]' for share;
  if not found then raise exception 'La foto de referencia fue retirada. Revisa el servicio antes de continuar.'; end if;
  select service.precio into current_price from public.servicios service
    where service.id=publication.service_id and service.barberia_id=publication.barberia_id and service.activo
      and not service.requiere_evaluacion and service.precio is not null and service.precio>0
      and service.duracion_min between 1 and 240 for share;
  if not found then raise exception 'El servicio de referencia ya no es reservable. Revisa el perfil antes de continuar.'; end if;
  if p_precio_esperado is null or p_precio_esperado is distinct from current_price then
    raise exception 'El precio del servicio cambió desde la referencia. Revisa el importe actual antes de continuar.';
  end if;
  perform 1 from public.meryo_team_members member
    join public.profiles professional on professional.id=member.user_id
    join public.meryo_team_services assigned on assigned.member_id=member.id and assigned.service_id=publication.service_id and assigned.active
    where member.id=publication.member_id and member.barberia_id=publication.barberia_id
      and member.active and professional.activo for share of member,professional,assigned;
  if not found then raise exception 'El profesional ya no ofrece este servicio. Revisa el perfil antes de continuar.'; end if;

  reservation_id:=public.meryo_solicitar_cita(p_barberia_id,p_servicio_id,p_inicio,p_nombre,p_telefono,p_pedido,p_extra,p_barbero_id,
    p_campaign_id,p_precio_habitual,p_beauty_campaign_id,p_beauty_regular_price,p_beauty_expected_price,p_precio_esperado);
  update public.reservas set inspiration_publication_id=publication.id,inspiration_title_snapshot=publication.title
    where id=reservation_id and cliente_id=auth.uid();
  if not found then raise exception 'No se pudo guardar la referencia del trabajo en la solicitud'; end if;
  return reservation_id;
end;
$$;
revoke all on function public.meryo_solicitar_cita(bigint,bigint,timestamptz,text,text,text,numeric,uuid,uuid,numeric,uuid,numeric,numeric,numeric,uuid) from public,anon;
grant execute on function public.meryo_solicitar_cita(bigint,bigint,timestamptz,text,text,text,numeric,uuid,uuid,numeric,uuid,numeric,numeric,numeric,uuid) to authenticated;

notify pgrst,'reload schema';
commit;
