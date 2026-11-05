begin;

-- A single campaign per shop. It stores only date/time windows: there is no
-- client-controlled list of discounted service IDs.
create table meryo_private.cut50_campaigns (
  id uuid primary key default gen_random_uuid(),
  barberia_id bigint not null unique references public.barberias(id),
  starts_on date not null,
  ends_on date not null,
  time_windows jsonb not null,
  active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (ends_on >= starts_on),
  check (jsonb_typeof(time_windows)='array' and jsonb_array_length(time_windows) between 1 and 6)
);
alter table meryo_private.cut50_campaigns enable row level security;
revoke all on meryo_private.cut50_campaigns from public,anon,authenticated;

alter table public.reservas
  add column if not exists campania_corte_id uuid references meryo_private.cut50_campaigns(id),
  add column if not exists precio_habitual numeric(10,2) check (precio_habitual is null or precio_habitual > 0);

-- Server-side classifier: a service must be a bookable service, be categorized
-- as a cut, and have a recognizable cut name. Explicit beard, dye, color and
-- package names are excluded even if a shop selects the cut category.
create function meryo_private.cut50_name_excluded(p_name text)
returns boolean language sql immutable set search_path=''
as $$
  select lower(translate(coalesce(p_name,''),'áéíóúüñ','aeiouun'))
    ~ '(^|[^a-z0-9])(barba|tinte|tintes|color|coloracion|paquete|combo|pack)([^a-z0-9]|$)';
$$;
create function meryo_private.cut50_name_candidate(p_name text)
returns boolean language sql immutable set search_path=''
as $$
  select not meryo_private.cut50_name_excluded(p_name)
    and lower(translate(coalesce(p_name,''),'áéíóúüñ','aeiouun'))
      ~ '(^|[^a-z0-9])(corte|cortes|fade|degradado|degrade|buzz|taper|undercut|rapado|crop)([^a-z0-9]|$)';
$$;
create function meryo_private.cut50_service(p_shop bigint,p_service bigint)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(select 1 from public.servicios s where s.id=p_service and s.barberia_id=p_shop and s.activo
    and s.categoria='cortes' and not s.requiere_evaluacion and s.precio>0 and s.duracion_min between 1 and 240
    and meryo_private.cut50_name_candidate(s.nombre));
$$;
create function meryo_private.cut50_shop_classification_clear(p_shop bigint)
returns boolean language sql stable security definer set search_path=''
as $$
  select not exists(select 1 from public.servicios s where s.barberia_id=p_shop and s.activo and (
    (meryo_private.cut50_name_candidate(s.nombre) and s.categoria<>'cortes')
    or (s.categoria='cortes' and not meryo_private.cut50_name_excluded(s.nombre)
      and (not meryo_private.cut50_name_candidate(s.nombre) or s.requiere_evaluacion or s.precio is null or s.precio<=0 or s.duracion_min is null))
  ));
$$;
revoke all on function meryo_private.cut50_name_excluded(text),meryo_private.cut50_name_candidate(text),meryo_private.cut50_service(bigint,bigint),meryo_private.cut50_shop_classification_clear(bigint) from public,anon,authenticated;

create function public.meryo_campania_cortes_propietario()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare shop_id bigint:=public.mi_barberia_id(); campaign jsonb; eligible jsonb; unclassified jsonb;
begin
  if shop_id is null or not public.meryo_es_propietario(shop_id) then raise exception 'Solo el propietario puede administrar la campaña' using errcode='42501'; end if;
  select jsonb_build_object('id',c.id,'starts_on',c.starts_on,'ends_on',c.ends_on,'time_windows',c.time_windows,
    'active',c.active,'expired',c.ends_on<(clock_timestamp() at time zone 'America/Lima')::date)
    into campaign from meryo_private.cut50_campaigns c where c.barberia_id=shop_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'nombre',s.nombre,'precio',s.precio,'duracion_min',s.duracion_min) order by s.nombre,s.id),'[]'::jsonb)
    into eligible from public.servicios s where s.barberia_id=shop_id and s.activo and meryo_private.cut50_service(shop_id,s.id);
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'nombre',s.nombre,'categoria',s.categoria) order by s.nombre,s.id),'[]'::jsonb)
    into unclassified from public.servicios s where s.barberia_id=shop_id and s.activo and (
      (meryo_private.cut50_name_candidate(s.nombre) and s.categoria<>'cortes')
      or (s.categoria='cortes' and not meryo_private.cut50_name_excluded(s.nombre)
        and (not meryo_private.cut50_name_candidate(s.nombre) or s.requiere_evaluacion or s.precio is null or s.precio<=0 or s.duracion_min is null))
    );
  return jsonb_build_object('campaign',campaign,'eligible_services',eligible,'unclassified_services',unclassified);
end;
$$;
revoke all on function public.meryo_campania_cortes_propietario() from public,anon;
grant execute on function public.meryo_campania_cortes_propietario() to authenticated;

create function public.meryo_guardar_campania_cortes(p_inicio date,p_fin date,p_horarios jsonb,p_activa boolean)
returns uuid language plpgsql security definer set search_path=''
as $$
declare shop_id bigint:=public.mi_barberia_id(); campaign_id uuid; w jsonb; other jsonb; i integer; j integer; n integer;
  start_time time; end_time time; other_start time; other_end time; today date:=(clock_timestamp() at time zone 'America/Lima')::date;
begin
  if shop_id is null or not public.meryo_es_propietario(shop_id) then raise exception 'Solo el propietario puede administrar la campaña' using errcode='42501'; end if;
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
  return campaign_id;
end;
$$;
revoke all on function public.meryo_guardar_campania_cortes(date,date,jsonb,boolean) from public,anon;
grant execute on function public.meryo_guardar_campania_cortes(date,date,jsonb,boolean) to authenticated;

create function meryo_private.cut50_campaign_applies(p_campaign uuid,p_shop bigint,p_service bigint,p_start timestamptz)
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
      and (p_start at time zone 'America/Lima')::time >= (w->>'start')::time
      and ((p_start+make_interval(mins=>s.duracion_min)) at time zone 'America/Lima')::time <= (w->>'end')::time
  );
$$;
revoke all on function meryo_private.cut50_campaign_applies(uuid,bigint,bigint,timestamptz) from public,anon,authenticated;

create function public.meryo_cortes_50_horarios(p_shop bigint,p_service bigint,p_date date,p_member uuid,p_campaign uuid)
returns table(hora_inicio timestamptz) language plpgsql stable security definer set search_path=''
as $$
begin
  if p_date is null or p_member is null then return; end if;
  return query select available.hora_inicio
    from public.meryo_horarios_barbero(p_shop,p_service,p_date,p_member) available
    where meryo_private.cut50_campaign_applies(p_campaign,p_shop,p_service,available.hora_inicio)
    order by available.hora_inicio;
end;
$$;
revoke all on function public.meryo_cortes_50_horarios(bigint,bigint,date,uuid,uuid) from public;
grant execute on function public.meryo_cortes_50_horarios(bigint,bigint,date,uuid,uuid) to anon,authenticated;

create function public.meryo_cortes_50_disponibles()
returns table(campaign_id uuid,shop_id bigint,shop_name text,district text,cover_url text,service_id bigint,service_name text,
  regular_price numeric,promo_price numeric,duration_min integer,starts_on date,ends_on date,slots jsonb)
language sql stable security definer set search_path=''
as $$
  with dates as (
    select c.id campaign_id,c.barberia_id shop_id,c.starts_on,c.ends_on,c.time_windows,
      greatest(c.starts_on,(clock_timestamp() at time zone 'America/Lima')::date)::timestamp as first_day,
      least(c.ends_on,(clock_timestamp() at time zone 'America/Lima')::date+30)::timestamp as last_day
    from meryo_private.cut50_campaigns c where c.active
  ), candidates as (
    select distinct c.campaign_id,c.shop_id,b.nombre shop_name,b.distrito district,b.imagen_url cover_url,
      s.id service_id,s.nombre service_name,s.precio regular_price,round(s.precio*0.5,2) promo_price,s.duracion_min,
      c.starts_on,c.ends_on,slot.hora_inicio,m.id barber_id,
      (slot.hora_inicio at time zone 'America/Lima')::date slot_date,
      to_char(slot.hora_inicio at time zone 'America/Lima','HH24:MI') slot_label
    from dates c
    join public.barberias b on b.id=c.shop_id and b.verificada and b.estado='activa' and b.disponible_ahora
      and b.tipos_negocio @> array['barberia']::text[] and public.meryo_barberia_publicable(b.id)
    join public.servicios s on s.barberia_id=b.id and s.activo and not s.requiere_evaluacion and s.precio>0
      and s.duracion_min between 1 and 240 and s.categoria='cortes' and meryo_private.cut50_name_candidate(s.nombre)
    join public.meryo_team_services ts on ts.service_id=s.id and ts.active
    join public.meryo_team_members m on m.id=ts.member_id and m.barberia_id=b.id and m.active
    join public.profiles p on p.id=m.user_id and p.activo
    cross join lateral generate_series(c.first_day,c.last_day,interval '1 day') d(day)
    cross join lateral public.meryo_horarios_barbero(b.id,s.id,d.day::date,m.id) slot
    cross join lateral jsonb_array_elements(c.time_windows) w
    where c.first_day<=c.last_day and meryo_private.cut50_shop_classification_clear(b.id)
      and (slot.hora_inicio at time zone 'America/Lima')::time >= (w->>'start')::time
      and ((slot.hora_inicio+make_interval(mins=>s.duracion_min)) at time zone 'America/Lima')::time <= (w->>'end')::time
  ), ranked as (
    select c.*,row_number() over(partition by campaign_id,service_id order by hora_inicio,barber_id) slot_rank from candidates c
  )
  select campaign_id,shop_id,shop_name,district,cover_url,service_id,service_name,regular_price,promo_price,duracion_min,starts_on,ends_on,
    jsonb_agg(jsonb_build_object('date',slot_date,'start',hora_inicio,'label',slot_label,'barber_id',barber_id) order by hora_inicio,barber_id) slots
  from ranked where slot_rank<=12
  group by campaign_id,shop_id,shop_name,district,cover_url,service_id,service_name,regular_price,promo_price,duracion_min,starts_on,ends_on
  order by shop_name,service_name;
$$;
revoke all on function public.meryo_cortes_50_disponibles() from public;
grant execute on function public.meryo_cortes_50_disponibles() to anon,authenticated;

-- Extend the existing trusted booking routine, retaining its current role,
-- schedule lock, exclusions, notifications, 15-minute response and deposit.
do $extend_booking$
declare source text; old_signature regprocedure:='public.meryo_solicitar_cita(bigint,bigint,timestamptz,text,text,text,numeric,uuid)'::regprocedure;
begin
  source:=pg_get_functiondef(old_signature);
  if position('v_total := v_serv.precio;' in source)=0
    or position('barbero_id,barbero_nombre,barberia_id, servicio_id, cliente_id,' in source)=0
    or position('p_barbero_id uuid)' in source)=0 then
    raise exception 'Unexpected booking RPC body; promotion migration stopped without replacing it';
  end if;
  source:=replace(source,'p_barbero_id uuid)','p_barbero_id uuid, p_campaign_id uuid, p_precio_habitual numeric)');
  source:=replace(source,'v_total := v_serv.precio;',
    E'if p_campaign_id is null then\n    if p_precio_habitual is not null then raise exception ''Precio promocional inesperado''; end if;\n    v_total := v_serv.precio;\n  else\n    if p_precio_habitual is null or p_precio_habitual is distinct from v_serv.precio then raise exception ''El precio habitual cambió. Revisa la oferta antes de solicitar.''; end if;\n    if not meryo_private.cut50_campaign_applies(p_campaign_id,p_barberia_id,p_servicio_id,p_inicio) then raise exception ''La oferta venció o este servicio u horario no participa. No se cambió el precio.''; end if;\n    if p_barbero_id is null or not exists(select 1 from public.meryo_horarios_barbero(p_barberia_id,p_servicio_id,(p_inicio at time zone ''America/Lima'')::date,p_barbero_id) available where available.hora_inicio=p_inicio) then raise exception ''Ese turno promocional ya no está disponible. Elige otro; no se cambió el precio.''; end if;\n    v_total := round(v_serv.precio*0.5,2);\n  end if;');
  source:=replace(source,'barbero_id,barbero_nombre,barberia_id, servicio_id, cliente_id,','barbero_id,barbero_nombre,campania_corte_id,precio_habitual,barberia_id, servicio_id, cliente_id,');
  source:=replace(source,'(select display_name from public.meryo_team_members where id=p_barbero_id),p_barberia_id, p_servicio_id, v_uid,','(select display_name from public.meryo_team_members where id=p_barbero_id),p_campaign_id,case when p_campaign_id is null then null else v_serv.precio end,p_barberia_id, p_servicio_id, v_uid,');
  if position('p_campaign_id uuid, p_precio_habitual numeric)' in source)=0
    or position('campania_corte_id,precio_habitual' in source)=0
    or position('Ese turno promocional ya no está disponible' in source)=0 then
    raise exception 'Promotion booking transformation failed';
  end if;
  execute source;
end;
$extend_booking$;

drop function public.meryo_solicitar_cita(bigint,bigint,timestamptz,text,text,text,numeric,uuid);
create function public.meryo_solicitar_cita(p_barberia_id bigint,p_servicio_id bigint,p_inicio timestamptz,p_nombre text,p_telefono text,p_pedido text,p_extra numeric,p_barbero_id uuid)
returns uuid language sql security definer set search_path=''
as $$ select public.meryo_solicitar_cita(p_barberia_id,p_servicio_id,p_inicio,p_nombre,p_telefono,p_pedido,p_extra,p_barbero_id,null,null); $$;
revoke all on function public.meryo_solicitar_cita(bigint,bigint,timestamptz,text,text,text,numeric,uuid),public.meryo_solicitar_cita(bigint,bigint,timestamptz,text,text,text,numeric,uuid,uuid,numeric) from public,anon;
grant execute on function public.meryo_solicitar_cita(bigint,bigint,timestamptz,text,text,text,numeric,uuid),public.meryo_solicitar_cita(bigint,bigint,timestamptz,text,text,text,numeric,uuid,uuid,numeric) to authenticated;

notify pgrst,'reload schema';
commit;
