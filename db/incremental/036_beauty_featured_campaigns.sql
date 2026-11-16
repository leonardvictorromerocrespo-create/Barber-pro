begin;

do $beauty_featured_guard$
begin
  if to_regclass('public.barberias') is null
     or to_regclass('meryo_private.barber_featured_campaigns') is null
     or to_regclass('meryo_private.barber_likes') is null
     or to_regprocedure('public.meryo_catalog_highlights(text)') is null then
    raise exception 'Beauty featured campaigns require the existing catalog and Barberías highlight schema';
  end if;
  if not exists (
    select 1
    from information_schema.columns
    where table_schema='public' and table_name='barberias'
      and column_name in ('id','tipos_negocio','verificada','estado')
    group by table_schema,table_name having count(*)=4
  ) then
    raise exception 'Beauty featured campaigns require the current published-business category fields';
  end if;
end;
$beauty_featured_guard$;

create table meryo_private.beauty_featured_campaigns (
  id bigint generated always as identity primary key,
  shop_id bigint not null references public.barberias(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  paid_at timestamptz not null,
  payment_reference text not null unique check (length(btrim(payment_reference)) > 0),
  check (ends_at > starts_at and ends_at > paid_at)
);

create index beauty_featured_campaigns_shop
  on meryo_private.beauty_featured_campaigns(shop_id, ends_at);

alter table meryo_private.beauty_featured_campaigns enable row level security;
revoke all on table meryo_private.beauty_featured_campaigns from public, anon, authenticated, service_role;
comment on table meryo_private.beauty_featured_campaigns is
  'Beauty-only featured campaigns recorded by trusted back-office operators after payment verification. No customer or app role can write campaign records.';

create or replace function meryo_private.require_beauty_featured_shop()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.barberias b
    where b.id=new.shop_id and 'belleza'=any(b.tipos_negocio)
  ) then
    raise exception 'Beauty featured campaigns require a business in the Beauty category' using errcode='22023';
  end if;
  return new;
end;
$$;

revoke all on function meryo_private.require_beauty_featured_shop() from public, anon, authenticated, service_role;
create trigger beauty_featured_campaign_category_guard
before insert or update of shop_id on meryo_private.beauty_featured_campaigns
for each row execute function meryo_private.require_beauty_featured_shop();

create or replace function public.meryo_catalog_highlights(p_category text)
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
      select distinct c.shop_id
      from meryo_private.barber_featured_campaigns c join active a on a.id=c.shop_id
      where p_category='barberia' and c.paid_at<=now() and c.starts_at<=now() and c.ends_at>now()
      union
      select distinct c.shop_id
      from meryo_private.beauty_featured_campaigns c join active a on a.id=c.shop_id
      where p_category='belleza' and c.paid_at<=now() and c.starts_at<=now() and c.ends_at>now()
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

revoke all on function public.meryo_catalog_highlights(text) from public, anon, authenticated;
grant execute on function public.meryo_catalog_highlights(text) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
