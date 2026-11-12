begin;

-- Only trusted back-office operators record a verified payment and its display period.
create table meryo_private.barber_featured_campaigns (
  id bigint generated always as identity primary key,
  shop_id bigint not null references public.barberias(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  paid_at timestamptz not null,
  payment_reference text not null unique check (length(btrim(payment_reference)) > 0),
  check (ends_at > starts_at and ends_at > paid_at)
);
create index barber_featured_campaigns_shop on meryo_private.barber_featured_campaigns(shop_id, ends_at);

create table meryo_private.barber_likes (
  shop_id bigint not null references public.barberias(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  primary key (shop_id, customer_id)
);
create index barber_likes_customer on meryo_private.barber_likes(customer_id);
alter table meryo_private.barber_featured_campaigns enable row level security;
alter table meryo_private.barber_likes enable row level security;
revoke all on meryo_private.barber_featured_campaigns, meryo_private.barber_likes from public, anon, authenticated;

create function public.meryo_barber_catalog_highlights()
returns table(shop_id bigint, featured boolean, likes bigint, liked boolean)
language sql stable security definer set search_path = '' as $$
  with active as (
    select b.id from public.barberias b
    where b.verificada and b.estado='activa' and 'barberia'=any(b.tipos_negocio)
  ), paid as (
    select distinct c.shop_id from meryo_private.barber_featured_campaigns c join active a on a.id=c.shop_id
    where c.paid_at <= now() and c.starts_at <= now() and c.ends_at > now()
  ), votes as (
    select l.shop_id,count(*) as total,bool_or(l.customer_id=auth.uid()) as mine
    from meryo_private.barber_likes l join active a on a.id=l.shop_id
    join public.profiles p on p.id=l.customer_id and p.activo and p.rol='cliente'
    group by l.shop_id
  )
  select a.id, paid.shop_id is not null, coalesce(votes.total,0), coalesce(votes.mine,false)
  from active a left join paid on paid.shop_id=a.id left join votes on votes.shop_id=a.id
  where paid.shop_id is not null or votes.total>0;
$$;

create function public.meryo_set_barber_like(p_shop_id bigint, p_liked boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare customer uuid := auth.uid();
begin
  if customer is null or not exists(select 1 from public.profiles p where p.id=customer and p.activo and p.rol='cliente') then
    raise exception 'Inicia sesión como cliente para dar Me gusta' using errcode='42501';
  end if;
  if p_liked is null or not exists(select 1 from public.barberias b where b.id=p_shop_id and b.verificada and b.estado='activa' and 'barberia'=any(b.tipos_negocio)) then
    raise exception 'Barbería no disponible' using errcode='22023';
  end if;
  if p_liked then
    insert into meryo_private.barber_likes (shop_id,customer_id) values (p_shop_id,customer) on conflict do nothing;
  else
    delete from meryo_private.barber_likes where shop_id=p_shop_id and customer_id=customer;
  end if;
end;
$$;

revoke all on function public.meryo_barber_catalog_highlights() from public, anon, authenticated;
revoke all on function public.meryo_set_barber_like(bigint,boolean) from public, anon, authenticated;
grant execute on function public.meryo_barber_catalog_highlights() to anon, authenticated;
grant execute on function public.meryo_set_barber_like(bigint,boolean) to authenticated;
notify pgrst, 'reload schema';
commit;
