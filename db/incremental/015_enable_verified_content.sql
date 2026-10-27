begin;
-- Apply only after official Storage proof and an independently downloaded,
-- restored hosted backup. The release script enforces those prerequisites.
do $$begin
 if not exists(select 1 from storage.buckets where id='meryo-shop-content' and public=false and file_size_limit=20971520) then raise exception 'Expected private content bucket not found';end if;
 if (public.meryo_reservas_config()->>'cobros_habilitados')::boolean then raise exception 'Payments must remain disabled';end if;
end$$;
create or replace function public.meryo_contenido_config() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('uploads_enabled',uploads_enabled,'reason',case when uploads_enabled then 'Storage verificado y respaldo externo comprobado.' else 'Las subidas están temporalmente desactivadas por configuración del servidor.' end,'image_limit',5242880,'video_limit',20971520,'backup_archive_limit',262144000) from meryo_private.shop_content_settings where id=1;
$$;
update meryo_private.shop_content_settings set uploads_enabled=true where id=1;
notify pgrst,'reload schema';
commit;
