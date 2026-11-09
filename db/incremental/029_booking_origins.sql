begin;

create table meryo_private.booking_origins(
  reservation_id uuid primary key references public.reservas(id) on delete cascade,
  source text not null check (source in ('ficha_google','turnos_hoy','whatsapp','instagram'))
);
alter table meryo_private.booking_origins enable row level security;
revoke all on meryo_private.booking_origins from public,anon,authenticated;

-- Reuse existing writers and their authentication, price, schedule and
-- notification checks. The attribution is saved in the same transaction.
create function public.meryo_solicitar_cita_con_origen(
  p_barberia_id bigint,p_servicio_id bigint,p_inicio timestamptz,p_nombre text,p_telefono text,
  p_pedido text,p_extra numeric,p_barbero_id uuid,p_origen text,
  p_campaign_id uuid default null,p_precio_habitual numeric default null,
  p_beauty_campaign_id uuid default null,p_beauty_regular_price numeric default null,
  p_beauty_expected_price numeric default null,p_precio_esperado numeric default null,
  p_inspiration_publication_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if p_origen is null or p_origen not in ('ficha_google','turnos_hoy','whatsapp','instagram') then
    raise exception 'Origen de cita no válido' using errcode='22023';
  end if;
  if p_inspiration_publication_id is not null then
    v_id:=public.meryo_solicitar_cita(p_barberia_id,p_servicio_id,p_inicio,p_nombre,p_telefono,p_pedido,p_extra,p_barbero_id,
      p_campaign_id,p_precio_habitual,p_beauty_campaign_id,p_beauty_regular_price,p_beauty_expected_price,p_precio_esperado,p_inspiration_publication_id);
  elsif p_precio_esperado is not null then
    v_id:=public.meryo_solicitar_cita(p_barberia_id,p_servicio_id,p_inicio,p_nombre,p_telefono,p_pedido,p_extra,p_barbero_id,
      p_campaign_id,p_precio_habitual,p_beauty_campaign_id,p_beauty_regular_price,p_beauty_expected_price,p_precio_esperado);
  elsif p_beauty_campaign_id is not null or p_beauty_regular_price is not null or p_beauty_expected_price is not null then
    v_id:=public.meryo_solicitar_cita(p_barberia_id,p_servicio_id,p_inicio,p_nombre,p_telefono,p_pedido,p_extra,p_barbero_id,
      p_campaign_id,p_precio_habitual,p_beauty_campaign_id,p_beauty_regular_price,p_beauty_expected_price);
  elsif p_campaign_id is not null or p_precio_habitual is not null then
    v_id:=public.meryo_solicitar_cita(p_barberia_id,p_servicio_id,p_inicio,p_nombre,p_telefono,p_pedido,p_extra,p_barbero_id,
      p_campaign_id,p_precio_habitual);
  else
    v_id:=public.meryo_solicitar_cita(p_barberia_id,p_servicio_id,p_inicio,p_nombre,p_telefono,p_pedido,p_extra,p_barbero_id);
  end if;
  insert into meryo_private.booking_origins(reservation_id,source) values(v_id,p_origen);
  return v_id;
end;
$$;
revoke all on function public.meryo_solicitar_cita_con_origen(bigint,bigint,timestamptz,text,text,text,numeric,uuid,text,uuid,numeric,uuid,numeric,numeric,numeric,uuid) from public,anon;
grant execute on function public.meryo_solicitar_cita_con_origen(bigint,bigint,timestamptz,text,text,text,numeric,uuid,text,uuid,numeric,uuid,numeric,numeric,numeric,uuid) to authenticated;

create function public.meryo_resultados_reservas(p_shop bigint,p_month date)
returns table(origen text,solicitadas bigint,completadas bigint)
language plpgsql stable security definer set search_path='' as $$
begin
  if public.meryo_es_propietario(p_shop) is not true then
    raise exception 'Solo el propietario puede consultar estos resultados' using errcode='42501';
  end if;
  if p_month is null or not isfinite(p_month) or extract(day from p_month)<>1 then
    raise exception 'Selecciona un mes válido' using errcode='22023';
  end if;
  return query
  select coalesce(a.source,'desconocido'),count(*),count(*) filter(where r.estado='completada')
  from public.reservas r
  left join meryo_private.booking_origins a on a.reservation_id=r.id
  where r.barberia_id=p_shop
    and r.inicio >= (p_month::timestamp at time zone 'America/Lima')
    and r.inicio < ((p_month+interval '1 month') at time zone 'America/Lima')
  group by coalesce(a.source,'desconocido');
end;
$$;
revoke all on function public.meryo_resultados_reservas(bigint,date) from public,anon;
grant execute on function public.meryo_resultados_reservas(bigint,date) to authenticated;

notify pgrst,'reload schema';
commit;
