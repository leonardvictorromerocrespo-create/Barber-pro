begin;

-- Keep the existing verified reservation RPC as the only writer. This
-- overload locks the selected service price, compares the customer's snapshot,
-- then delegates to the current routine in the same transaction. Existing
-- 8/10/13-argument callers remain compatible and unchanged.
do $preflight$
begin
  if to_regprocedure('public.meryo_solicitar_cita(bigint,bigint,timestamptz,text,text,text,numeric,uuid,uuid,numeric,uuid,numeric,numeric)') is null then
    raise exception 'The 024 verified booking RPC is missing; turn finder price guard was not installed';
  end if;
  if to_regprocedure('public.meryo_solicitar_cita(bigint,bigint,timestamptz,text,text,text,numeric,uuid,uuid,numeric,uuid,numeric,numeric,numeric)') is not null then
    raise exception 'Turn finder price guard already exists; migration 026 must not be applied twice';
  end if;
end;
$preflight$;

create function public.meryo_solicitar_cita(
  p_barberia_id bigint,
  p_servicio_id bigint,
  p_inicio timestamptz,
  p_nombre text,
  p_telefono text,
  p_pedido text,
  p_extra numeric,
  p_barbero_id uuid,
  p_campaign_id uuid,
  p_precio_habitual numeric,
  p_beauty_campaign_id uuid,
  p_beauty_regular_price numeric,
  p_beauty_expected_price numeric,
  p_precio_esperado numeric
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare current_price numeric;
begin
  if auth.uid() is null or not exists(
    select 1 from public.profiles
    where id=auth.uid() and activo is true and rol='cliente'
  ) then
    raise exception 'Inicia sesión con una cuenta de cliente activa' using errcode='42501';
  end if;

  if p_campaign_id is null and p_beauty_campaign_id is null then
    if p_precio_esperado is null then
      raise exception 'Falta el precio habitual consultado; vuelve a revisar el servicio';
    end if;
    select service.precio into current_price
    from public.servicios service
    where service.id=p_servicio_id and service.barberia_id=p_barberia_id and service.activo
    for share;
    if not found then raise exception 'El servicio ya no está disponible'; end if;
    if p_precio_esperado is distinct from current_price then
      raise exception 'El precio habitual cambió. Revisa el nuevo importe antes de solicitar';
    end if;
  elsif p_precio_esperado is not null then
    raise exception 'No combines el precio habitual esperado con una promoción';
  end if;

  return public.meryo_solicitar_cita(
    p_barberia_id,p_servicio_id,p_inicio,p_nombre,p_telefono,p_pedido,p_extra,p_barbero_id,
    p_campaign_id,p_precio_habitual,p_beauty_campaign_id,p_beauty_regular_price,p_beauty_expected_price
  );
end;
$$;

revoke all on function public.meryo_solicitar_cita(bigint,bigint,timestamptz,text,text,text,numeric,uuid,uuid,numeric,uuid,numeric,numeric,numeric) from public,anon;
grant execute on function public.meryo_solicitar_cita(bigint,bigint,timestamptz,text,text,text,numeric,uuid,uuid,numeric,uuid,numeric,numeric,numeric) to authenticated;

notify pgrst,'reload schema';
commit;
