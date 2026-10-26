-- Non-destructive public-catalog integrity. Classification is explicit by ID.
begin;
create table meryo_private.catalog_exclusions (
 barberia_id bigint primary key references public.barberias(id) on delete cascade,
 active boolean not null default true,
 reason text not null,
 evidence text not null,
 confirmed_at timestamptz not null default clock_timestamp()
);
alter table meryo_private.catalog_exclusions enable row level security;
revoke all on meryo_private.catalog_exclusions from public,anon,authenticated;

-- Owner explicitly confirmed these five existing IDs as test profiles on 2026-10-26.
-- Names are drift guards, never a rule for classifying future shops.
do $guard$
begin
 if (select count(*) from public.barberias b join (values
  (1::bigint,'Elite Fade Studio'),(5,'Baria Leo'),(6,'Barbershop'),(7,'BarberFlax'),(8,'BarberFlax')
 ) expected(id,nombre) on b.id=expected.id and b.nombre=expected.nombre)<>5 then
  raise exception 'Confirmed demo identities changed; stop';
 end if;
end $guard$;
insert into meryo_private.catalog_exclusions(barberia_id,reason,evidence)
select id,'Demo confirmado por el propietario',
 'Confirmación expresa 2026-10-26 de los cinco perfiles visibles; id 1 también coincide con INITIAL_SHOPS del commit aa7e1f9.'
from public.barberias where id in (1,5,6,7,8);

create function public.meryo_barberia_publicable(p_id bigint) returns boolean
language sql stable security definer set search_path='' as $$
 select not exists(select 1 from meryo_private.catalog_exclusions e where e.barberia_id=p_id and e.active);
$$;
revoke all on function public.meryo_barberia_publicable(bigint) from public;
grant execute on function public.meryo_barberia_publicable(bigint) to anon,authenticated;

-- Older clients cannot re-expose demos through the ordinary public table API.
-- Existing owners and real AAL2 administrators retain their private access.
create policy meryo_catalog_anon on public.barberias as restrictive for select to anon
 using(public.meryo_barberia_publicable(id));
create policy meryo_catalog_authenticated on public.barberias as restrictive for select to authenticated
 using(public.meryo_barberia_publicable(id) or public.es_admin() or id=public.mi_barberia_id());

create function public.meryo_catalogo_publico() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',b.id,'nombre',b.nombre,'distrito',b.distrito,'direccion',b.direccion,
  'descripcion',b.descripcion,'imagen_url',b.imagen_url,'lat',b.lat,'lng',b.lng,
  'whatsapp',b.whatsapp,'correo_contacto',b.correo_contacto,
  'video_presentacion_url',b.video_presentacion_url,
  'estado',b.estado,'verificada',b.verificada,
  'precio_desde',(select min(s.precio) from public.servicios s where s.barberia_id=b.id and s.activo),
  'rating',reviews.rating,'total_resenas',reviews.total,'reviews_verified',true,
  'servicios',coalesce((select jsonb_agg(jsonb_build_object(
   'id',s.id,'nombre',s.nombre,'descripcion',s.descripcion,'precio',s.precio,
   'duracion_min',s.duracion_min,'activo',s.activo) order by s.nombre,s.id)
   from public.servicios s where s.barberia_id=b.id and s.activo),'[]'::jsonb)
 ) order by b.nombre,b.id),'[]'::jsonb)
 from public.barberias b
 cross join lateral (
  select avg(r.calificacion)::numeric(3,2) rating,count(*)::integer total
  from public.resenas r where r.barberia_id=b.id and r.calificacion between 1 and 5
 ) reviews
 where b.verificada is true and b.estado='activa' and public.meryo_barberia_publicable(b.id);
$$;
revoke all on function public.meryo_catalogo_publico() from public;
grant execute on function public.meryo_catalogo_publico() to anon,authenticated;
notify pgrst,'reload schema';
commit;
