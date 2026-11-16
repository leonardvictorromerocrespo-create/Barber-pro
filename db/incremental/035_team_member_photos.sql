begin;

do $$
begin
  if to_regclass('public.meryo_shop_assets') is null
     or to_regclass('public.meryo_team_members') is null
     or to_regclass('meryo_private.shop_content_settings') is null
     or to_regprocedure('public.meryo_es_cita_asignada(uuid)') is null then
    raise exception 'Faltan las dependencias de contenido (012) o equipo (014) para la migración 035';
  end if;
end;
$$;

-- Team portraits use the existing private bucket and asset table, with a path
-- namespace that cannot overlap the owner's flat portfolio uploads.
alter table public.meryo_shop_assets
  drop constraint if exists meryo_shop_assets_object_path_check,
  drop constraint if exists meryo_team_photo_path;
alter table public.meryo_shop_assets
  add constraint meryo_team_photo_path check (
    object_path ~ '^[0-9]+/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|mp4|webm)$'
    or object_path ~ '^[0-9]+/team/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
  );

drop policy if exists meryo_team_photo_insert on storage.objects;
create policy meryo_team_photo_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'meryo-shop-content'
    and coalesce((public.meryo_contenido_config()->>'uploads_enabled')::boolean, false)
    and name ~ '^[0-9]+/team/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
    and split_part(name, '/', 1) = public.mi_barberia_id()::text
    and case
      when name ~ '^[0-9]+/team/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
        then public.meryo_es_cita_asignada(split_part(name, '/', 3)::uuid)
      else false
    end
  );

create or replace function public.meryo_guardar_foto_integrante(p_member uuid, p_path text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  shop bigint := public.mi_barberia_id();
  member_row public.meryo_team_members%rowtype;
  metadata jsonb;
  object_owner text;
  content_type text;
  file_size bigint;
  asset_id uuid;
  asset_title text;
begin
  if auth.uid() is null
     or shop is null
     or not public.meryo_cuenta_activa()
     or not public.meryo_es_cita_asignada(p_member) then
    raise exception 'Solo el profesional asignado puede guardar su foto' using errcode = '42501';
  end if;

  select * into member_row
    from public.meryo_team_members
   where id = p_member and user_id = auth.uid() and barberia_id = shop and active
   for update;
  if not found then
    raise exception 'No puedes cambiar la foto de otro integrante' using errcode = '42501';
  end if;

  if not coalesce((select uploads_enabled from meryo_private.shop_content_settings where id = 1), false) then
    raise exception 'Las subidas siguen bloqueadas por configuración del servidor';
  end if;

  if p_path is null or p_path !~ (
    '^' || shop::text || '/team/' || p_member::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
  ) then
    raise exception 'La ruta de la foto no pertenece a tu perfil';
  end if;

  select o.metadata, o.owner_id::text
    into metadata, object_owner
    from storage.objects o
   where o.bucket_id = 'meryo-shop-content' and o.name = p_path
   for share;
  if not found or object_owner is distinct from auth.uid()::text then
    raise exception 'Primero carga la foto con tu propia sesión';
  end if;

  content_type := coalesce(metadata->>'mimetype', '');
  if coalesce(metadata->>'size', '') !~ '^[0-9]+$' then
    raise exception 'El tamaño de la foto no es válido';
  end if;
  file_size := (metadata->>'size')::bigint;
  if file_size <= 0 or file_size > 5242880
     or content_type not in ('image/jpeg', 'image/png', 'image/webp')
     or (content_type = 'image/jpeg' and p_path !~ '\.jpe?g$')
     or (content_type = 'image/png' and p_path !~ '\.png$')
     or (content_type = 'image/webp' and p_path !~ '\.webp$') then
    raise exception 'La foto debe ser JPG, PNG o WebP y ocupar como máximo 5 MB';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('meryo-team-photo-' || p_member::text, 0));
  asset_title := '[meryo-team-photo:' || p_member::text || ']';
  update public.meryo_shop_assets
     set active = false, retired_at = clock_timestamp()
   where barberia_id = shop and kind = 'foto' and title = asset_title and active;

  insert into public.meryo_shop_assets(barberia_id, kind, object_path, title, mime, bytes)
  values (shop, 'foto', p_path, asset_title, content_type, file_size)
  returning id into asset_id;

  insert into meryo_private.shop_events(barberia_id, actor_id, action, after_data)
  values (shop, auth.uid(), 'guardar_foto_integrante', jsonb_build_object('member', p_member, 'asset', asset_id));

  return asset_id;
end;
$$;

revoke all on function public.meryo_guardar_foto_integrante(uuid, text) from public, anon;
grant execute on function public.meryo_guardar_foto_integrante(uuid, text) to authenticated;

commit;
