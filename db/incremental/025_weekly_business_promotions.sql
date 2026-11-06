begin;

-- A business can schedule at most one promotional date in each Lima week.
-- Multiple services may share that same date. The calendar is private and is
-- only written by the owner RPCs below.
create table meryo_private.business_promotion_calendar (
  barberia_id bigint not null references public.barberias(id) on delete cascade,
  week_start date not null,
  promotion_date date not null,
  primary key (barberia_id, week_start),
  check (week_start = date_trunc('week', week_start::timestamp)::date),
  check (promotion_date >= week_start and promotion_date < week_start + 7)
);
alter table meryo_private.business_promotion_calendar enable row level security;
revoke all on meryo_private.business_promotion_calendar from public,anon,authenticated;

-- Existing ranges become a weekly offer on the weekday selected by starts_on.
-- Stop safely if existing active promotions already choose different days in
-- the same business week; no campaign is silently moved or deleted.
do $backfill$
begin
  if exists (
    with scheduled as (
      select c.barberia_id, d::date promotion_date
      from meryo_private.cut50_campaigns c
      cross join lateral generate_series((c.starts_on+(greatest(0,ceil((((clock_timestamp() at time zone 'America/Lima')::date-c.starts_on)::numeric)/7)::integer)*7))::timestamp,c.ends_on::timestamp,interval '7 days') d
      where c.active and c.ends_on >= (clock_timestamp() at time zone 'America/Lima')::date
      union all
      select p.barberia_id, d::date
      from meryo_private.beauty_service_promotions p
      cross join lateral generate_series((p.empieza+(greatest(0,ceil((((clock_timestamp() at time zone 'America/Lima')::date-p.empieza)::numeric)/7)::integer)*7))::timestamp,p.termina::timestamp,interval '7 days') d
      where p.activa and p.termina >= (clock_timestamp() at time zone 'America/Lima')::date
    )
    select 1 from scheduled
    group by barberia_id,date_trunc('week',promotion_date::timestamp)::date
    having count(distinct promotion_date)>1
  ) then
    raise exception 'Active promotions for a business already use different days in one Lima week; review those campaigns before applying migration 025';
  end if;
  insert into meryo_private.business_promotion_calendar(barberia_id,week_start,promotion_date)
  with scheduled as (
    select c.barberia_id,d::date promotion_date
    from meryo_private.cut50_campaigns c
    cross join lateral generate_series((c.starts_on+(greatest(0,ceil((((clock_timestamp() at time zone 'America/Lima')::date-c.starts_on)::numeric)/7)::integer)*7))::timestamp,c.ends_on::timestamp,interval '7 days') d
    where c.active and c.ends_on >= (clock_timestamp() at time zone 'America/Lima')::date
    union all
    select p.barberia_id,d::date
    from meryo_private.beauty_service_promotions p
    cross join lateral generate_series((p.empieza+(greatest(0,ceil((((clock_timestamp() at time zone 'America/Lima')::date-p.empieza)::numeric)/7)::integer)*7))::timestamp,p.termina::timestamp,interval '7 days') d
    where p.activa and p.termina >= (clock_timestamp() at time zone 'America/Lima')::date
  )
  select barberia_id,date_trunc('week',promotion_date::timestamp)::date,min(promotion_date)
  from scheduled group by barberia_id,date_trunc('week',promotion_date::timestamp)::date;
end;
$backfill$;

create function meryo_private.rebuild_business_promotion_calendar(p_shop bigint)
returns void language plpgsql security definer set search_path=''
as $$
begin
  if exists (
    with scheduled as (
      select c.barberia_id,d::date promotion_date
      from meryo_private.cut50_campaigns c
      cross join lateral generate_series(greatest(c.starts_on,(clock_timestamp() at time zone 'America/Lima')::date)::timestamp,c.ends_on::timestamp,interval '7 days') d
      where c.barberia_id=p_shop and c.active and c.ends_on >= (clock_timestamp() at time zone 'America/Lima')::date
      union all
      select p.barberia_id,d::date
      from meryo_private.beauty_service_promotions p
      cross join lateral generate_series(greatest(p.empieza,(clock_timestamp() at time zone 'America/Lima')::date)::timestamp,p.termina::timestamp,interval '7 days') d
      where p.barberia_id=p_shop and p.activa and p.termina >= (clock_timestamp() at time zone 'America/Lima')::date
    )
    select 1 from scheduled
    group by barberia_id,date_trunc('week',promotion_date::timestamp)::date
    having count(distinct promotion_date)>1
  ) then
    raise exception 'Este negocio ya tiene otro día promocional en esa semana. Todas sus promociones deben compartir un único día de lunes a domingo (hora de Lima).';
  end if;
  delete from meryo_private.business_promotion_calendar where barberia_id=p_shop;
  insert into meryo_private.business_promotion_calendar(barberia_id,week_start,promotion_date)
  with scheduled as (
    select c.barberia_id,d::date promotion_date
    from meryo_private.cut50_campaigns c
    cross join lateral generate_series((c.starts_on+(greatest(0,ceil((((clock_timestamp() at time zone 'America/Lima')::date-c.starts_on)::numeric)/7)::integer)*7))::timestamp,c.ends_on::timestamp,interval '7 days') d
    where c.barberia_id=p_shop and c.active and c.ends_on >= (clock_timestamp() at time zone 'America/Lima')::date
    union all
    select p.barberia_id,d::date
    from meryo_private.beauty_service_promotions p
    cross join lateral generate_series((p.empieza+(greatest(0,ceil((((clock_timestamp() at time zone 'America/Lima')::date-p.empieza)::numeric)/7)::integer)*7))::timestamp,p.termina::timestamp,interval '7 days') d
    where p.barberia_id=p_shop and p.activa and p.termina >= (clock_timestamp() at time zone 'America/Lima')::date
  )
  select barberia_id,date_trunc('week',promotion_date::timestamp)::date,min(promotion_date)
  from scheduled group by barberia_id,date_trunc('week',promotion_date::timestamp)::date;
end;
$$;
revoke all on function meryo_private.rebuild_business_promotion_calendar(bigint) from public,anon,authenticated;

create or replace function meryo_private.cut50_campaign_applies(p_campaign uuid,p_shop bigint,p_service bigint,p_start timestamptz)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from meryo_private.cut50_campaigns c
    join public.barberias b on b.id=c.barberia_id
    join public.servicios s on s.barberia_id=b.id and s.id=p_service
    cross join lateral jsonb_array_elements(c.time_windows) w
    where c.id=p_campaign and c.barberia_id=p_shop and c.active
      and b.verificada and b.estado='activa' and b.disponible_ahora and b.tipos_negocio @> array['barberia']::text[]
      and public.meryo_barberia_publicable(b.id)
      and s.activo and not s.requiere_evaluacion and s.precio>0 and s.duracion_min between 1 and 240
      and s.categoria='cortes' and meryo_private.cut50_name_candidate(s.nombre)
      and meryo_private.cut50_shop_classification_clear(b.id)
      and (p_start at time zone 'America/Lima')::date between c.starts_on and c.ends_on
      and exists(select 1 from meryo_private.business_promotion_calendar day
        where day.barberia_id=p_shop and day.week_start=date_trunc('week',(p_start at time zone 'America/Lima')::date::timestamp)::date
          and day.promotion_date=(p_start at time zone 'America/Lima')::date)
      and (p_start at time zone 'America/Lima')::time >= (w->>'start')::time
      and ((p_start+make_interval(mins=>s.duracion_min)) at time zone 'America/Lima')::time <= (w->>'end')::time
  );
$$;
revoke all on function meryo_private.cut50_campaign_applies(uuid,bigint,bigint,timestamptz) from public,anon,authenticated;

create or replace function meryo_private.beauty_service_promotion_applies(
  p_promotion uuid,p_shop bigint,p_service bigint,p_start timestamptz
) returns boolean language sql stable security definer set search_path=''
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
      and exists(select 1 from meryo_private.business_promotion_calendar day
        where day.barberia_id=p_shop and day.week_start=date_trunc('week',(p_start at time zone 'America/Lima')::date::timestamp)::date
          and day.promotion_date=(p_start at time zone 'America/Lima')::date)
  );
$$;
revoke all on function meryo_private.beauty_service_promotion_applies(uuid,bigint,bigint,timestamptz) from public,anon,authenticated;

-- The ordinary beauty catalog only returns today's weekly price on the
-- scheduled promotion day; it does not advertise the discount on other days.
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
          and exists(select 1 from meryo_private.business_promotion_calendar day
            where day.barberia_id=shop.id and day.promotion_date=(clock_timestamp() at time zone 'America/Lima')::date)
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

-- Rebuild after each owner change under a business-row lock. This makes the
-- calendar cap shared across salon service offers and Cut50 campaigns.
create or replace function public.meryo_guardar_promocion_belleza(
  p_service_id bigint,p_promo_price numeric,p_starts_on date,p_ends_on date,p_active boolean
) returns uuid language plpgsql security definer set search_path=''
as $$
declare shop_id bigint:=public.mi_barberia_id(); regular_price numeric; promotion_id uuid;
  today date:=(clock_timestamp() at time zone 'America/Lima')::date;
begin
  if shop_id is null or not public.meryo_es_propietario(shop_id) then
    raise exception 'Solo el propietario puede administrar las promociones del negocio' using errcode='42501';
  end if;
  perform 1 from public.barberias b where b.id=shop_id for update;
  if not found then raise exception 'Negocio no disponible' using errcode='42501'; end if;
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
  perform meryo_private.rebuild_business_promotion_calendar(shop_id);
  return promotion_id;
end;
$$;
revoke all on function public.meryo_guardar_promocion_belleza(bigint,numeric,date,date,boolean) from public,anon;
grant execute on function public.meryo_guardar_promocion_belleza(bigint,numeric,date,date,boolean) to authenticated;

create or replace function public.meryo_guardar_campania_cortes(p_inicio date,p_fin date,p_horarios jsonb,p_activa boolean)
returns uuid language plpgsql security definer set search_path=''
as $$
declare shop_id bigint:=public.mi_barberia_id(); campaign_id uuid; w jsonb; other jsonb; i integer; j integer; n integer;
  start_time time; end_time time; other_start time; other_end time; today date:=(clock_timestamp() at time zone 'America/Lima')::date;
begin
  if shop_id is null or not public.meryo_es_propietario(shop_id) then raise exception 'Solo el propietario puede administrar la campaña' using errcode='42501'; end if;
  perform 1 from public.barberias b where b.id=shop_id for update;
  if not found then raise exception 'Negocio no disponible' using errcode='42501'; end if;
  if not exists(select 1 from public.barberias b where b.id=shop_id and b.tipos_negocio @> array['barberia']::text[]) then raise exception 'Esta campaña solo está disponible para negocios clasificados como barbería'; end if;
  if p_inicio is null or p_fin is null or p_horarios is null or p_activa is null or p_inicio<today or p_fin<p_inicio or p_fin>today+30 then raise exception 'Elige fechas válidas dentro de los próximos 30 días'; end if;
  if jsonb_typeof(p_horarios)<>'array' or jsonb_array_length(p_horarios) not between 1 and 6 then raise exception 'Agrega entre 1 y 6 horarios participantes'; end if;
  n:=jsonb_array_length(p_horarios);
  for i in 0..n-1 loop
    w:=p_horarios->i;
    if coalesce(w->>'start','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(w->>'end','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Escribe cada horario en formato HH:MM'; end if;
    start_time:=(w->>'start')::time;end_time:=(w->>'end')::time;
    if end_time<=start_time then raise exception 'La hora final debe ser posterior a la inicial'; end if;
    for j in i+1..n-1 loop
      other:=p_horarios->j;other_start:=(other->>'start')::time;other_end:=(other->>'end')::time;
      if start_time<other_end and end_time>other_start then raise exception 'Los horarios participantes no pueden superponerse'; end if;
    end loop;
  end loop;
  if p_activa then
    if not meryo_private.cut50_shop_classification_clear(shop_id) then raise exception 'Revisa la clasificación de todos los servicios de corte antes de activar la campaña'; end if;
    if not exists(select 1 from public.servicios s where s.barberia_id=shop_id and s.activo and meryo_private.cut50_service(shop_id,s.id)) then raise exception 'Agrega al menos un corte publicado con precio y duración definidos'; end if;
  end if;
  insert into meryo_private.cut50_campaigns(barberia_id,starts_on,ends_on,time_windows,active,created_by,updated_at)
  values(shop_id,p_inicio,p_fin,p_horarios,p_activa,auth.uid(),clock_timestamp())
  on conflict(barberia_id) do update set starts_on=excluded.starts_on,ends_on=excluded.ends_on,time_windows=excluded.time_windows,
    active=excluded.active,created_by=excluded.created_by,updated_at=clock_timestamp()
  returning id into campaign_id;
  perform meryo_private.rebuild_business_promotion_calendar(shop_id);
  return campaign_id;
end;
$$;
revoke all on function public.meryo_guardar_campania_cortes(date,date,jsonb,boolean) from public,anon;
grant execute on function public.meryo_guardar_campania_cortes(date,date,jsonb,boolean) to authenticated;

create function public.meryo_belleza_promociones_hoy()
returns table(promotion_id uuid,shop_id bigint,shop_name text,service_id bigint,service_name text,regular_price numeric,promo_price numeric,duration_min integer,cover_url text,slots jsonb)
language sql stable security definer set search_path=''
as $$
  with promotion_today as (select (clock_timestamp() at time zone 'America/Lima')::date promotion_date), candidates as (
    select offer.id promotion_id,shop.id shop_id,shop.nombre shop_name,service.id service_id,service.nombre service_name,
      service.precio regular_price,offer.precio_promocional promo_price,service.duracion_min,shop.imagen_url cover_url,
      slot.hora_inicio,m.id barber_id,to_char(slot.hora_inicio at time zone 'America/Lima','HH24:MI') label
    from promotion_today
    join meryo_private.business_promotion_calendar calendar on calendar.promotion_date=promotion_today.promotion_date
      and calendar.week_start=date_trunc('week',promotion_today.promotion_date::timestamp)::date
    join meryo_private.beauty_service_promotions offer on offer.barberia_id=calendar.barberia_id
      and offer.activa and promotion_today.promotion_date between offer.empieza and offer.termina
    join public.barberias shop on shop.id=offer.barberia_id and shop.verificada and shop.estado='activa'
      and shop.disponible_ahora and shop.tipos_negocio @> array['belleza']::text[]
      and public.meryo_barberia_publicable(shop.id)
    join public.servicios service on service.id=offer.servicio_id and service.barberia_id=shop.id and service.activo
      and not service.requiere_evaluacion and service.precio>offer.precio_promocional and service.precio>0
      and service.duracion_min between 1 and 240
    join public.meryo_team_services ts on ts.service_id=service.id and ts.active
    join public.meryo_team_members m on m.id=ts.member_id and m.barberia_id=shop.id and m.active
    join public.profiles profile on profile.id=m.user_id and profile.activo
    cross join lateral public.meryo_horarios_barbero(shop.id,service.id,promotion_today.promotion_date,m.id) slot
    where meryo_private.beauty_service_promotion_applies(offer.id,shop.id,service.id,slot.hora_inicio)
  )
  select c.promotion_id,c.shop_id,c.shop_name,c.service_id,c.service_name,c.regular_price,c.promo_price,c.duracion_min,c.cover_url,
    jsonb_agg(jsonb_build_object('date',(c.hora_inicio at time zone 'America/Lima')::date,'start',c.hora_inicio,'label',c.label,'barber_id',c.barber_id) order by c.hora_inicio,c.barber_id) slots
  from candidates c
  group by c.promotion_id,c.shop_id,c.shop_name,c.service_id,c.service_name,c.regular_price,c.promo_price,c.duracion_min,c.cover_url
  order by c.shop_name,c.service_name;
$$;
revoke all on function public.meryo_belleza_promociones_hoy() from public;
grant execute on function public.meryo_belleza_promociones_hoy() to anon,authenticated;

create function public.meryo_belleza_promocion_horarios(p_promotion uuid,p_shop bigint,p_service bigint,p_date date,p_member uuid)
returns table(hora_inicio timestamptz) language plpgsql stable security definer set search_path=''
as $$
begin
  if p_date is null or p_member is null or p_date<>(clock_timestamp() at time zone 'America/Lima')::date then return; end if;
  return query select available.hora_inicio
    from public.meryo_horarios_barbero(p_shop,p_service,p_date,p_member) available
    where meryo_private.beauty_service_promotion_applies(p_promotion,p_shop,p_service,available.hora_inicio)
    order by available.hora_inicio;
end;
$$;
revoke all on function public.meryo_belleza_promocion_horarios(uuid,bigint,bigint,date,uuid) from public;
grant execute on function public.meryo_belleza_promocion_horarios(uuid,bigint,bigint,date,uuid) to anon,authenticated;

notify pgrst,'reload schema';
commit;
