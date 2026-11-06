begin;

-- Promotions are private owner-managed records. Only the filtered beauty
-- catalog exposes their public price fields.
create table meryo_private.beauty_service_promotions (
  id uuid primary key default gen_random_uuid(),
  barberia_id bigint not null references public.barberias(id),
  servicio_id bigint not null references public.servicios(id),
  precio_promocional numeric(10,2) not null check (precio_promocional > 0),
  empieza date not null,
  termina date not null,
  activa boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint beauty_service_promotion_dates check (termina >= empieza),
  constraint beauty_service_promotion_shop_service unique (barberia_id, servicio_id)
);
alter table meryo_private.beauty_service_promotions enable row level security;
revoke all on meryo_private.beauty_service_promotions from public, anon, authenticated;

alter table public.reservas
  add column if not exists campania_belleza_id uuid references meryo_private.beauty_service_promotions(id);

create function meryo_private.beauty_service_promotion_applies(
  p_promotion uuid,p_shop bigint,p_service bigint,p_start timestamptz
) returns boolean
language sql stable security definer set search_path=''
as $$
  select exists(
    select 1
    from meryo_private.beauty_service_promotions offer
    join public.barberias shop on shop.id=offer.barberia_id
    join public.servicios service on service.id=offer.servicio_id and service.barberia_id=shop.id
    where offer.id=p_promotion and offer.barberia_id=p_shop and offer.servicio_id=p_service and offer.activa
      and shop.tipos_negocio @> array['belleza']::text[]
      and shop.verificada and shop.estado='activa' and shop.disponible_ahora
      and public.meryo_barberia_publicable(shop.id)
      and service.activo and not service.requiere_evaluacion
      and service.precio is not null and service.precio>0
      and service.duracion_min between 1 and 240
      and offer.precio_promocional<service.precio
      and (p_start at time zone 'America/Lima')::date between offer.empieza and offer.termina
  );
$$;
revoke all on function meryo_private.beauty_service_promotion_applies(uuid,bigint,bigint,timestamptz) from public,anon,authenticated;

create function public.meryo_promociones_belleza_propietario()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare shop_id bigint:=public.mi_barberia_id(); services jsonb; promotions jsonb;
begin
  if shop_id is null or not public.meryo_es_propietario(shop_id) then
    raise exception 'Solo el propietario puede administrar las promociones del negocio' using errcode='42501';
  end if;
  if not exists(select 1 from public.barberias where id=shop_id and tipos_negocio @> array['belleza']::text[]) then
    raise exception 'Las promociones del salón requieren un negocio clasificado como belleza' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',service.id,'nombre',service.nombre,'precio',service.precio,'duracion_min',service.duracion_min,
    'categoria',service.categoria
  ) order by service.nombre,service.id),'[]'::jsonb)
  into services
  from public.servicios service
  where service.barberia_id=shop_id and service.activo and not service.requiere_evaluacion
    and service.precio is not null and service.precio>0 and service.duracion_min between 1 and 240;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',offer.id,'service_id',offer.servicio_id,'service_name',service.nombre,
    'regular_price',service.precio,'promo_price',offer.precio_promocional,
    'starts_on',offer.empieza,'ends_on',offer.termina,'active',offer.activa,
    'expired',offer.termina<(clock_timestamp() at time zone 'America/Lima')::date,
    'service_published',coalesce(service.activo,false),
    'price_changed',service.precio is null or offer.precio_promocional>=service.precio
  ) order by offer.updated_at desc,offer.id),'[]'::jsonb)
  into promotions
  from meryo_private.beauty_service_promotions offer
  left join public.servicios service on service.id=offer.servicio_id and service.barberia_id=shop_id
  where offer.barberia_id=shop_id;
  return jsonb_build_object('services',services,'promotions',promotions);
end;
$$;
revoke all on function public.meryo_promociones_belleza_propietario() from public,anon;
grant execute on function public.meryo_promociones_belleza_propietario() to authenticated;

create function public.meryo_guardar_promocion_belleza(
  p_service_id bigint,p_promo_price numeric,p_starts_on date,p_ends_on date,p_active boolean
) returns uuid language plpgsql security definer set search_path=''
as $$
declare shop_id bigint:=public.mi_barberia_id(); regular_price numeric; promotion_id uuid;
  today date:=(clock_timestamp() at time zone 'America/Lima')::date;
begin
  if shop_id is null or not public.meryo_es_propietario(shop_id) then
    raise exception 'Solo el propietario puede administrar las promociones del negocio' using errcode='42501';
  end if;
  if not exists(select 1 from public.barberias where id=shop_id and tipos_negocio @> array['belleza']::text[]) then
    raise exception 'Las promociones del salón requieren un negocio clasificado como belleza' using errcode='42501';
  end if;
  if p_service_id is null or p_promo_price is null or p_promo_price<=0 or p_starts_on is null or p_ends_on is null or p_active is null or p_ends_on<p_starts_on then
    raise exception 'Completa un servicio, precio y fechas válidas';
  end if;
  if p_active and p_starts_on<today then raise exception 'La fecha de inicio no puede estar vencida'; end if;
  if p_active then
    select service.precio into regular_price from public.servicios service
    where service.id=p_service_id and service.barberia_id=shop_id and service.activo
      and not service.requiere_evaluacion and service.precio is not null and service.precio>0
      and service.duracion_min between 1 and 240
    for share;
    if not found then raise exception 'Elige un servicio publicado con precio y duración definidos'; end if;
    if p_promo_price>=regular_price then raise exception 'El precio promocional debe ser inferior al precio habitual'; end if;
  elsif not exists(select 1 from public.servicios where id=p_service_id and barberia_id=shop_id) then
    raise exception 'El servicio no pertenece a tu negocio' using errcode='42501';
  end if;
  insert into meryo_private.beauty_service_promotions(
    barberia_id,servicio_id,precio_promocional,empieza,termina,activa,created_by,updated_at
  ) values(shop_id,p_service_id,round(p_promo_price,2),p_starts_on,p_ends_on,p_active,auth.uid(),clock_timestamp())
  on conflict(barberia_id,servicio_id) do update set
    precio_promocional=excluded.precio_promocional,empieza=excluded.empieza,termina=excluded.termina,
    activa=excluded.activa,created_by=excluded.created_by,updated_at=clock_timestamp()
  returning id into promotion_id;
  return promotion_id;
end;
$$;
revoke all on function public.meryo_guardar_promocion_belleza(bigint,numeric,date,date,boolean) from public,anon;
grant execute on function public.meryo_guardar_promocion_belleza(bigint,numeric,date,date,boolean) to authenticated;

-- Public service offers appear only in the beauty catalog, for published
-- businesses/services, during their Lima-local dates, and while below regular price.
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
          'categoria',service.categoria,'requiere_evaluacion',service.requiere_evaluacion,
          'promocion_belleza',case when p_categoria='belleza' and offer.id is not null then jsonb_build_object(
            'id',offer.id,'precio',offer.precio_promocional,'desde',offer.empieza,'hasta',offer.termina
          ) else null end
        ) order by service.nombre,service.id)
        from jsonb_array_elements(coalesce(b->'servicios','[]'::jsonb)) svc
        join public.servicios service on service.id=(svc->>'id')::bigint
          and service.barberia_id=shop.id and service.activo
        left join meryo_private.beauty_service_promotions offer on p_categoria='belleza'
          and offer.barberia_id=shop.id and offer.servicio_id=service.id and offer.activa
          and offer.empieza<=(clock_timestamp() at time zone 'America/Lima')::date
          and offer.termina>=(clock_timestamp() at time zone 'America/Lima')::date
          and service.precio>offer.precio_promocional
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

-- Keep every existing reservation check/notification/deadline by extending the
-- verified 023 RPC body. The legacy 8- and 10-argument entry points remain wrappers.
do $extend_booking$
declare source text; old_signature regprocedure:='public.meryo_solicitar_cita(bigint,bigint,timestamptz,text,text,text,numeric,uuid,uuid,numeric)'::regprocedure;
begin
  source:=pg_get_functiondef(old_signature);
  if position('p_campaign_id uuid, p_precio_habitual numeric)' in source)=0
    or position('meryo_private.cut50_campaign_applies(p_campaign_id,p_barberia_id,p_servicio_id,p_inicio)' in source)=0
    or position('campania_corte_id,precio_habitual,barberia_id, servicio_id, cliente_id,' in source)=0
    or position('v_total := round(v_serv.precio*0.5,2);' in source)=0 then
    raise exception 'Unexpected 023 booking RPC body; salon promotion migration stopped';
  end if;
  source:=replace(source,'p_campaign_id uuid, p_precio_habitual numeric)','p_campaign_id uuid, p_precio_habitual numeric, p_beauty_campaign_id uuid, p_beauty_regular_price numeric, p_beauty_expected_price numeric)');
  source:=replace(source,'v_total numeric; v_adelanto numeric;','v_total numeric; v_promo_price numeric; v_adelanto numeric;');
  source:=replace(source,'select * into v_serv from public.servicios where id = p_servicio_id and barberia_id = p_barberia_id and activo;','select * into v_serv from public.servicios where id = p_servicio_id and barberia_id = p_barberia_id and activo for share;');
  source:=replace(source,'if p_campaign_id is null then',E'if p_campaign_id is null and p_beauty_campaign_id is null then\n    if p_beauty_regular_price is not null or p_beauty_expected_price is not null then\n      if not exists(select 1 from public.barberias where id=p_barberia_id and tipos_negocio @> array[''belleza'']::text[]) then raise exception ''Precio promocional inesperado''; end if;\n      if p_beauty_regular_price is distinct from v_serv.precio then raise exception ''El precio habitual volvió a cambiar. Revisa antes de continuar.''; end if;\n      if p_beauty_expected_price is not null then raise exception ''Precio promocional inesperado''; end if;\n    end if;');
  source:=replace(source,'if p_precio_habitual is not null then raise exception ''Precio promocional inesperado''; end if;','if p_precio_habitual is not null then raise exception ''Precio promocional inesperado''; end if;');
  source:=replace(source,'if not meryo_private.beauty_service_promotion_applies(p_beauty_campaign_id,p_barberia_id,p_servicio_id,p_inicio) then',E'perform 1 from meryo_private.beauty_service_promotions offer where offer.id=p_beauty_campaign_id and offer.barberia_id=p_barberia_id and offer.servicio_id=p_servicio_id for share;\n      if not found then raise exception ''La oferta del salón ya no está disponible. Revisa antes de continuar.''; end if;\n      if not meryo_private.beauty_service_promotion_applies(p_beauty_campaign_id,p_barberia_id,p_servicio_id,p_inicio) then');
  source:=replace(source,E'  else\n    if p_precio_habitual is null or p_precio_habitual is distinct from v_serv.precio then',
    E'  else\n    if p_beauty_campaign_id is not null then\n      if p_campaign_id is not null then raise exception ''No se pueden combinar promociones''; end if;\n      if p_precio_habitual is not null then raise exception ''Precio promocional inesperado''; end if;\n      if p_beauty_regular_price is null or p_beauty_regular_price is distinct from v_serv.precio then raise exception ''El precio habitual del salón cambió. Revisa la oferta antes de continuar.''; end if;\n      if not meryo_private.beauty_service_promotion_applies(p_beauty_campaign_id,p_barberia_id,p_servicio_id,p_inicio) then raise exception ''La oferta del salón venció o cambió. No se aplicó; revisa si deseas continuar al precio habitual.''; end if;\n      if p_barbero_id is null or not exists(select 1 from public.meryo_horarios_barbero(p_barberia_id,p_servicio_id,(p_inicio at time zone ''America/Lima'')::date,p_barbero_id) available where available.hora_inicio=p_inicio) then raise exception ''Ese turno de la oferta del salón ya no está disponible. Elige otro horario; no se cambió el precio.''; end if;\n      select offer.precio_promocional into v_total from meryo_private.beauty_service_promotions offer where offer.id=p_beauty_campaign_id and offer.barberia_id=p_barberia_id and offer.servicio_id=p_servicio_id;\n      if v_total is null then raise exception ''La oferta del salón ya no está disponible. Revisa antes de continuar.''; end if;\n    else\n    if p_beauty_regular_price is not null and p_beauty_regular_price is distinct from v_serv.precio then raise exception ''El precio habitual volvió a cambiar. Revisa antes de continuar.''; end if;\n    if p_precio_habitual is null or p_precio_habitual is distinct from v_serv.precio then');
  source:=replace(source,'if p_beauty_campaign_id is not null then',E'if p_beauty_campaign_id is not null then');
  source:=replace(source,'if p_campaign_id is not null then raise exception ''No se pueden combinar promociones''; end if;','if p_campaign_id is not null then raise exception ''No se pueden combinar promociones''; end if;');
  source:=replace(source,'if p_precio_habitual is not null then raise exception ''Precio promocional inesperado''; end if;','if p_precio_habitual is not null then raise exception ''Precio promocional inesperado''; end if;');
  source:=replace(source,'if p_beauty_regular_price is null or p_beauty_regular_price is distinct from v_serv.precio then raise exception ''El precio habitual del salón cambió. Revisa la oferta antes de continuar.''; end if;',E'if p_beauty_regular_price is null or p_beauty_regular_price is distinct from v_serv.precio then raise exception ''El precio habitual del salón cambió. Revisa la oferta antes de continuar.''; end if;\n      if p_beauty_expected_price is null then raise exception ''El precio promocional cambió. No se aplicó; revisa si deseas continuar al precio habitual.''; end if;');
  source:=replace(source,'if not meryo_private.beauty_service_promotion_applies(p_beauty_campaign_id,p_barberia_id,p_servicio_id,p_inicio) then',E'select offer.precio_promocional into v_promo_price from meryo_private.beauty_service_promotions offer where offer.id=p_beauty_campaign_id and offer.barberia_id=p_barberia_id and offer.servicio_id=p_servicio_id for share;\n      if not found then raise exception ''La oferta del salón ya no está disponible. Revisa antes de continuar.''; end if;\n      if p_beauty_expected_price is distinct from v_promo_price then raise exception ''El precio promocional cambió. No se aplicó; revisa si deseas continuar al precio habitual.''; end if;\n      if not meryo_private.beauty_service_promotion_applies(p_beauty_campaign_id,p_barberia_id,p_servicio_id,p_inicio) then');
  source:=replace(source,'if p_beauty_regular_price is not null and p_beauty_regular_price is distinct from v_serv.precio then raise exception ''El precio habitual volvió a cambiar. Revisa antes de continuar.''; end if;',E'if p_beauty_regular_price is not null and p_beauty_regular_price is distinct from v_serv.precio then raise exception ''El precio habitual volvió a cambiar. Revisa antes de continuar.''; end if;\n    if p_beauty_expected_price is not null then raise exception ''Precio promocional inesperado''; end if;');
  source:=replace(source,E'  else\n    if p_beauty_campaign_id is not null then',E'  else\n    if p_campaign_id is not null and (p_beauty_regular_price is not null or p_beauty_expected_price is not null) then raise exception ''No se pueden combinar promociones''; end if;\n    if p_beauty_campaign_id is not null then');
  source:=replace(source,E'    v_total := round(v_serv.precio*0.5,2);\n  end if;',E'    v_total := round(v_serv.precio*0.5,2);\n    end if;\n  end if;');
  source:=replace(source,'campania_corte_id,precio_habitual,barberia_id, servicio_id, cliente_id,','campania_corte_id,campania_belleza_id,precio_habitual,barberia_id, servicio_id, cliente_id,');
  source:=replace(source,'p_campaign_id,case when p_campaign_id is null then null else v_serv.precio end,p_barberia_id, p_servicio_id, v_uid,','p_campaign_id,p_beauty_campaign_id,case when p_campaign_id is null and p_beauty_campaign_id is null then null else v_serv.precio end,p_barberia_id, p_servicio_id, v_uid,');
  if position('p_beauty_campaign_id uuid, p_beauty_regular_price numeric, p_beauty_expected_price numeric)' in source)=0
    or position('v_promo_price numeric' in source)=0
    or position('campania_corte_id,campania_belleza_id,precio_habitual' in source)=0
    or position('beauty_service_promotion_applies' in source)=0
    or position('La oferta del salón venció o cambió' in source)=0 then
    raise exception 'Salon promotion booking transformation failed';
  end if;
  execute source;
end;
$extend_booking$;

drop function public.meryo_solicitar_cita(bigint,bigint,timestamptz,text,text,text,numeric,uuid,uuid,numeric);
create function public.meryo_solicitar_cita(
  p_barberia_id bigint,p_servicio_id bigint,p_inicio timestamptz,p_nombre text,p_telefono text,
  p_pedido text,p_extra numeric,p_barbero_id uuid,p_campaign_id uuid,p_precio_habitual numeric
) returns uuid language sql security definer set search_path=''
as $$ select public.meryo_solicitar_cita(p_barberia_id,p_servicio_id,p_inicio,p_nombre,p_telefono,p_pedido,p_extra,p_barbero_id,p_campaign_id,p_precio_habitual,null,null,null); $$;

revoke all on function public.meryo_solicitar_cita(bigint,bigint,timestamptz,text,text,text,numeric,uuid),
  public.meryo_solicitar_cita(bigint,bigint,timestamptz,text,text,text,numeric,uuid,uuid,numeric),
  public.meryo_solicitar_cita(bigint,bigint,timestamptz,text,text,text,numeric,uuid,uuid,numeric,uuid,numeric,numeric) from public,anon;
grant execute on function public.meryo_solicitar_cita(bigint,bigint,timestamptz,text,text,text,numeric,uuid),
  public.meryo_solicitar_cita(bigint,bigint,timestamptz,text,text,text,numeric,uuid,uuid,numeric),
  public.meryo_solicitar_cita(bigint,bigint,timestamptz,text,text,text,numeric,uuid,uuid,numeric,uuid,numeric,numeric) to authenticated;

notify pgrst,'reload schema';
commit;
