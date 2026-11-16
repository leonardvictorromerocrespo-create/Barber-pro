begin;

-- Extends the existing private like records to salons while preserving barber campaigns.
create function public.meryo_catalog_highlights(p_category text)
returns table(shop_id bigint, featured boolean, likes bigint, liked boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_category is null or p_category not in ('barberia','belleza') then
    raise exception 'Categoría no disponible' using errcode='22023';
  end if;
  return query
    with active as (
      select b.id from public.barberias b
      where b.verificada and b.estado='activa' and p_category=any(b.tipos_negocio)
    ), paid as (
      select distinct c.shop_id from meryo_private.barber_featured_campaigns c join active a on a.id=c.shop_id
      where p_category='barberia' and c.paid_at<=now() and c.starts_at<=now() and c.ends_at>now()
    ), votes as (
      select l.shop_id,count(*) as total,bool_or(l.customer_id=auth.uid()) as mine
      from meryo_private.barber_likes l join active a on a.id=l.shop_id
      join public.profiles p on p.id=l.customer_id and p.activo and p.rol='cliente'
      group by l.shop_id
    )
    select a.id,paid.shop_id is not null,coalesce(votes.total,0),coalesce(votes.mine,false)
    from active a left join paid on paid.shop_id=a.id left join votes on votes.shop_id=a.id;
end;
$$;

create function public.meryo_set_catalog_like(p_shop_id bigint,p_liked boolean,p_category text)
returns void language plpgsql security definer set search_path = '' as $$
declare customer uuid := auth.uid();
begin
  if p_category is null or p_category not in ('barberia','belleza') then
    raise exception 'Categoría no disponible' using errcode='22023';
  end if;
  if customer is null or not exists(select 1 from public.profiles p where p.id=customer and p.activo and p.rol='cliente') then
    raise exception 'Inicia sesión como cliente para dar Me gusta' using errcode='42501';
  end if;
  if p_liked is null or not exists(
    select 1 from public.barberias b
    where b.id=p_shop_id and b.verificada and b.estado='activa' and p_category=any(b.tipos_negocio)
  ) then
    raise exception 'Negocio no disponible' using errcode='22023';
  end if;
  if p_liked then
    insert into meryo_private.barber_likes(shop_id,customer_id) values(p_shop_id,customer) on conflict do nothing;
  else
    delete from meryo_private.barber_likes where shop_id=p_shop_id and customer_id=customer;
  end if;
end;
$$;

revoke all on function public.meryo_catalog_highlights(text) from public,anon,authenticated;
revoke all on function public.meryo_set_catalog_like(bigint,boolean,text) from public,anon,authenticated;
grant execute on function public.meryo_catalog_highlights(text) to anon,authenticated;
grant execute on function public.meryo_set_catalog_like(bigint,boolean,text) to authenticated;
notify pgrst,'reload schema';
commit;
