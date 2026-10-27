-- Incremental owner profile, moderation history and private content. No candidate schema.
begin;
create table meryo_private.shop_owners(
 barberia_id bigint primary key references public.barberias(id),
 user_id uuid not null unique references public.profiles(id),
 created_at timestamptz not null default now()
);
-- Existing contract had one registering owner, no employee invitation mechanism.
do $$begin
 if exists(select 1 from public.profiles where rol='barbero' and barberia_id is not null group by barberia_id having count(*)>1) then
  raise exception 'Ambiguous legacy ownership; explicit mapping required';
 end if;
end$$;
insert into meryo_private.shop_owners(barberia_id,user_id)
select barberia_id,id from public.profiles where rol='barbero' and barberia_id is not null;
create table meryo_private.shop_events(
 id uuid primary key default gen_random_uuid(),barberia_id bigint not null references public.barberias(id),
 actor_id uuid references public.profiles(id),action text not null,reason text,
 before_data jsonb,after_data jsonb,created_at timestamptz not null default clock_timestamp()
);
alter table meryo_private.shop_owners enable row level security;
alter table meryo_private.shop_events enable row level security;
revoke all on meryo_private.shop_owners,meryo_private.shop_events from public,anon,authenticated;
create function public.meryo_es_propietario(p_id bigint) returns boolean
language sql stable security definer set search_path='' as $$
 select public.meryo_cuenta_activa() and exists(select 1 from meryo_private.shop_owners where barberia_id=p_id and user_id=auth.uid());
$$;
revoke all on function public.meryo_es_propietario(bigint) from public;
grant execute on function public.meryo_es_propietario(bigint) to authenticated;

-- Record the owner inside the existing authenticated registration transaction.
do $patch$declare definition text;begin
 definition:=pg_get_functiondef('public.registrar_barberia(text,text,text,text,double precision,double precision,text,text)'::regprocedure);
 if position('  return v_id;' in definition)=0 then raise exception 'Unexpected registration contract'; end if;
 definition:=replace(definition,'  return v_id;',E'  insert into meryo_private.shop_owners(barberia_id,user_id) values(v_id,v_uid);\n  insert into meryo_private.shop_events(barberia_id,actor_id,action,after_data) values(v_id,v_uid,''registro'',jsonb_build_object(''estado'',''pendiente''));\n  return v_id;');
 execute definition;
end $patch$;

create function meryo_private.audit_shop() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if to_jsonb(old) is distinct from to_jsonb(new) then
  insert into meryo_private.shop_events(barberia_id,actor_id,action,before_data,after_data)
  values(new.id,auth.uid(),'actualizacion_perfil',to_jsonb(old),to_jsonb(new));
 end if;
 return new;
end$$;
create trigger meryo_shop_audit after update on public.barberias for each row execute function meryo_private.audit_shop();

-- Direct browser edits can no longer bypass identity review or owner checks.
revoke update(nombre,distrito,direccion,descripcion,imagen_url,lat,lng,whatsapp,correo_contacto,video_presentacion_url,disponible_ahora) on public.barberias from authenticated;
create function public.meryo_guardar_perfil(p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b public.barberias%rowtype; identity_changed boolean;
begin
 select * into b from public.barberias where id=public.mi_barberia_id() for update;
 if not found or not public.meryo_es_propietario(b.id) then raise exception 'Solo el propietario puede editar este perfil' using errcode='42501'; end if;
 if exists(select 1 from jsonb_object_keys(p_data) k where k not in ('nombre','distrito','direccion','descripcion','lat','lng','whatsapp','correo_contacto','disponible_ahora')) then raise exception 'Campo no permitido';end if;
 if length(trim(coalesce(p_data->>'nombre','')))<2 or length(p_data->>'nombre')>80 or length(trim(coalesce(p_data->>'direccion','')))<3 or length(p_data->>'direccion')>200 or length(trim(coalesce(p_data->>'distrito','')))<2 or length(p_data->>'distrito')>80 or length(coalesce(p_data->>'descripcion',''))>2000 or length(coalesce(p_data->>'whatsapp',''))>20 or length(coalesce(p_data->>'correo_contacto',''))>120 then raise exception 'Revisa nombre, dirección, distrito y longitud del contenido';end if;
 identity_changed:=row(b.nombre,b.direccion,b.distrito,b.lat,b.lng) is distinct from row(trim(p_data->>'nombre'),trim(p_data->>'direccion'),trim(p_data->>'distrito'),(p_data->>'lat')::double precision,(p_data->>'lng')::double precision);
 update public.barberias set nombre=trim(p_data->>'nombre'),direccion=trim(p_data->>'direccion'),distrito=trim(p_data->>'distrito'),descripcion=p_data->>'descripcion',lat=(p_data->>'lat')::double precision,lng=(p_data->>'lng')::double precision,whatsapp=p_data->>'whatsapp',correo_contacto=p_data->>'correo_contacto',disponible_ahora=coalesce((p_data->>'disponible_ahora')::boolean,false),
 estado=case when identity_changed and estado='activa' then 'pendiente' else estado end,
 verificada=case when identity_changed then false else verificada end where id=b.id returning * into b;
 return to_jsonb(b);
end$$;
revoke all on function public.meryo_guardar_perfil(jsonb) from public,anon;
grant execute on function public.meryo_guardar_perfil(jsonb) to authenticated;

-- Existing services/hours editors remain usable, exclusively by the registered owner.
do $policies$declare tbl text;op text;expr text;begin
 foreach tbl in array array['servicios','horarios','bloqueos','barberia_media'] loop
  expr:='public.meryo_es_propietario(barberia_id)';
  foreach op in array array['INSERT','UPDATE','DELETE'] loop
   execute format('create policy %I on public.%I as restrictive for %s to authenticated %s','meryo_owner_'||lower(op),tbl,op,case op when 'INSERT' then 'with check('||expr||')' when 'UPDATE' then 'using('||expr||') with check('||expr||')' else 'using('||expr||')' end);
  end loop;
 end loop;
end $policies$;

create function public.meryo_moderar_barberia(p_id bigint,p_action text,p_reason text,p_expected text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b public.barberias%rowtype;target text;
begin
 if not public.es_admin() then raise exception 'Administración requiere sesión real y MFA' using errcode='42501';end if;
 select * into b from public.barberias where id=p_id for update;
 if not found then raise exception 'Barbería no encontrada';end if;
 if not public.meryo_barberia_publicable(p_id) then raise exception 'Demo separado: no se publica mediante moderación';end if;
 if b.estado is distinct from p_expected then raise exception 'Otro cambio actualizó esta barbería. Recarga la ficha';end if;
 target:=case when p_action='aprobar' and b.estado in ('pendiente','rechazada') then 'activa' when p_action='rechazar' and b.estado='pendiente' then 'rechazada' when p_action='suspender' and b.estado='activa' then 'suspendida' when p_action='reactivar' and b.estado='suspendida' then 'activa' else null end;
 if target is null then raise exception 'Transición no permitida';end if;
 if p_action in ('rechazar','suspender') and length(trim(coalesce(p_reason,'')))<5 then raise exception 'Indica un motivo de al menos 5 caracteres';end if;
 if length(coalesce(p_reason,''))>1000 then raise exception 'Motivo demasiado largo';end if;
 if target='activa' and (b.lat is null or b.lng is null or nullif(trim(b.nombre),'') is null or nullif(trim(b.direccion),'') is null or not exists(select 1 from public.servicios where barberia_id=p_id and activo)) then raise exception 'Completa ubicación, perfil y al menos un servicio activo antes de aprobar';end if;
 update public.barberias set estado=target,verificada=(target='activa') where id=p_id;
 insert into meryo_private.shop_events(barberia_id,actor_id,action,reason,before_data,after_data) values(p_id,auth.uid(),p_action,nullif(trim(p_reason),''),jsonb_build_object('estado',b.estado),jsonb_build_object('estado',target));
 perform public.notificar(o.user_id,'Revisión de tu barbería',target||coalesce(': '||nullif(trim(p_reason),''),''),'barberia_revision',null) from meryo_private.shop_owners o where o.barberia_id=p_id;
 return jsonb_build_object('id',p_id,'estado',target,'verificada',target='activa');
end$$;
revoke all on function public.meryo_moderar_barberia(bigint,text,text,text) from public,anon;
grant execute on function public.meryo_moderar_barberia(bigint,text,text,text) to authenticated;
-- Legacy endpoints cannot escape the audit trail or reason requirement.
create or replace function public.activar_barberia(p_id bigint) returns void language plpgsql security definer set search_path='' as $$
begin perform public.meryo_moderar_barberia(p_id,'aprobar',null,(select estado from public.barberias where id=p_id));end$$;
create or replace function public.suspender_barberia(p_id bigint) returns void language plpgsql security definer set search_path='' as $$
begin raise exception 'Usa moderación e indica el motivo';end$$;

create table public.meryo_shop_assets(
 id uuid primary key default gen_random_uuid(),barberia_id bigint not null references public.barberias(id),
 kind text not null check(kind in ('portada','foto','video')),object_path text not null unique,
 title text not null default '' check(length(title)<=100),mime text not null,bytes bigint not null,
 active boolean not null default true,created_at timestamptz not null default clock_timestamp(),retired_at timestamptz,
 check(bytes>0 and bytes<=20971520),check(object_path ~ '^[0-9]+/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|mp4|webm)$')
);
create unique index meryo_single_cover on public.meryo_shop_assets(barberia_id) where kind='portada' and active;
create unique index meryo_single_video on public.meryo_shop_assets(barberia_id) where kind='video' and active;
create table meryo_private.shop_content_settings(id integer primary key check(id=1),uploads_enabled boolean not null default false);
insert into meryo_private.shop_content_settings values(1,false);
alter table meryo_private.shop_content_settings enable row level security;
revoke all on meryo_private.shop_content_settings from public,anon,authenticated;
create function public.meryo_contenido_config() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('uploads_enabled',uploads_enabled,'reason','Falta verificar una carga y descarga reales de Storage en un entorno de pruebas separado.','image_limit',5242880,'video_limit',20971520) from meryo_private.shop_content_settings where id=1;
$$;
revoke all on function public.meryo_contenido_config() from public;
grant execute on function public.meryo_contenido_config() to anon,authenticated;
alter table public.meryo_shop_assets enable row level security;
revoke all on public.meryo_shop_assets from public,anon,authenticated;
grant select on public.meryo_shop_assets to anon,authenticated;
create policy meryo_assets_read on public.meryo_shop_assets for select to anon,authenticated using(
 (active and exists(select 1 from public.barberias b where b.id=barberia_id and b.verificada and b.estado='activa' and public.meryo_barberia_publicable(b.id))) or public.es_admin() or barberia_id=public.mi_barberia_id());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('meryo-shop-content','meryo-shop-content',false,20971520,array['image/jpeg','image/png','image/webp','video/mp4','video/webm']);
create policy meryo_content_insert on storage.objects for insert to authenticated with check(
 bucket_id='meryo-shop-content' and (public.meryo_contenido_config()->>'uploads_enabled')::boolean and name ~ '^[0-9]+/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|mp4|webm)$' and public.meryo_es_propietario(nullif(split_part(name,'/',1),'')::bigint));
create policy meryo_content_read on storage.objects for select to anon,authenticated using(
 bucket_id='meryo-shop-content' and (exists(select 1 from public.meryo_shop_assets a where a.object_path=name and a.active) or public.es_admin() or (split_part(name,'/',1)=public.mi_barberia_id()::text)));
-- No UPDATE/DELETE grants through this bucket's policies. Replacement uses new paths.
create function public.meryo_publicar_archivo(p_path text,p_kind text,p_title text) returns uuid
language plpgsql security definer set search_path='' as $$
declare shop bigint:=public.mi_barberia_id();meta jsonb;asset uuid;owner_text text;
begin
 if not (select uploads_enabled from meryo_private.shop_content_settings where id=1) then raise exception 'Subidas bloqueadas hasta verificar Storage en pruebas';end if;
 if not public.meryo_es_propietario(shop) or split_part(p_path,'/',1)<>shop::text then raise exception 'No autorizado' using errcode='42501';end if;
 if p_kind not in ('portada','foto','video') or length(coalesce(p_title,''))>100 then raise exception 'Tipo o título inválido';end if;
 select metadata,owner_id into meta,owner_text from storage.objects where bucket_id='meryo-shop-content' and name=p_path for share;
 if not found or owner_text is distinct from auth.uid()::text then raise exception 'Primero sube el archivo con tu propia sesión';end if;
 if coalesce((meta->>'size')::bigint,0)<=0 or (meta->>'size')::bigint>(case when p_kind='video' then 20971520 else 5242880 end) or coalesce(meta->>'mimetype','')<>all(case when p_kind='video' then array['video/mp4','video/webm'] else array['image/jpeg','image/png','image/webp'] end) then raise exception 'Formato o tamaño no permitido';end if;
 if p_kind in ('portada','video') then update public.meryo_shop_assets set active=false,retired_at=clock_timestamp() where barberia_id=shop and kind=p_kind and active;end if;
 insert into public.meryo_shop_assets(barberia_id,kind,object_path,title,mime,bytes) values(shop,p_kind,p_path,coalesce(p_title,''),meta->>'mimetype',(meta->>'size')::bigint) returning id into asset;
 insert into meryo_private.shop_events(barberia_id,actor_id,action,after_data) values(shop,auth.uid(),'publicar_archivo',jsonb_build_object('asset',asset,'kind',p_kind));
 return asset;
end$$;
create function public.meryo_retirar_archivo(p_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare shop bigint:=public.mi_barberia_id();begin
 if not public.meryo_es_propietario(shop) then raise exception 'No autorizado' using errcode='42501';end if;
 update public.meryo_shop_assets set active=false,retired_at=clock_timestamp() where id=p_id and barberia_id=shop and active;
 if not found then raise exception 'Archivo activo no encontrado';end if;
 insert into meryo_private.shop_events(barberia_id,actor_id,action,after_data) values(shop,auth.uid(),'retirar_archivo',jsonb_build_object('asset',p_id));return true;
end$$;
revoke all on function public.meryo_publicar_archivo(text,text,text),public.meryo_retirar_archivo(uuid) from public,anon;
grant execute on function public.meryo_publicar_archivo(text,text,text),public.meryo_retirar_archivo(uuid) to authenticated;

create function public.meryo_historial_barberia(p_id bigint) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.es_admin() and not public.meryo_es_propietario(p_id) then raise exception 'No autorizado' using errcode='42501';end if;
 return coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from (select id,actor_id,action,reason,before_data,after_data,created_at from meryo_private.shop_events where barberia_id=p_id order by created_at desc limit 100) e),'[]'::jsonb);
end$$;
revoke all on function public.meryo_historial_barberia(bigint) from public,anon;
grant execute on function public.meryo_historial_barberia(bigint) to authenticated;

create function public.meryo_admin_barberias() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.es_admin() then raise exception 'Administración requiere MFA' using errcode='42501';end if;
 return coalesce((select jsonb_agg(to_jsonb(b)||jsonb_build_object(
 'demo',not public.meryo_barberia_publicable(b.id),
 'propietario',(select jsonb_build_object('id',p.id,'nombre',p.nombre,'email',p.email,'telefono',p.telefono,'activo',p.activo) from meryo_private.shop_owners o join public.profiles p on p.id=o.user_id where o.barberia_id=b.id),
 'servicios',coalesce((select jsonb_agg(to_jsonb(s) order by s.nombre) from public.servicios s where s.barberia_id=b.id),'[]'::jsonb),
 'equipo',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'nombre',p.nombre,'activo',p.activo,'propietario',p.id=o.user_id)) from public.profiles p left join meryo_private.shop_owners o on o.barberia_id=p.barberia_id where p.barberia_id=b.id),'[]'::jsonb)
 ) order by b.created_at desc,b.id desc) from public.barberias b),'[]'::jsonb);
end$$;
revoke all on function public.meryo_admin_barberias() from public,anon;
grant execute on function public.meryo_admin_barberias() to authenticated;

-- The public catalogue retains the confirmed-demo and actual-review rules from 011.
alter function public.meryo_catalogo_publico() rename to meryo_catalogo_base_011;
revoke all on function public.meryo_catalogo_base_011() from public,anon,authenticated;
create function public.meryo_catalogo_publico() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(b||jsonb_build_object(
 'assets',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'kind',a.kind,'object_path',a.object_path,'title',a.title) order by a.created_at) from public.meryo_shop_assets a where a.barberia_id=(b->>'id')::bigint and a.active),'[]'::jsonb),
 'resenas',coalesce((select jsonb_agg(to_jsonb(r)) from (select id,autor,calificacion,comentario,created_at from public.resenas where barberia_id=(b->>'id')::bigint order by created_at desc limit 50) r),'[]'::jsonb),
 'equipo',coalesce((select jsonb_agg(jsonb_build_object('nombre',coalesce(p.nombre,'Propietario'),'propietario',true)) from meryo_private.shop_owners o join public.profiles p on p.id=o.user_id where o.barberia_id=(b->>'id')::bigint and p.activo),'[]'::jsonb)
 )),'[]'::jsonb) from jsonb_array_elements(public.meryo_catalogo_base_011()) b;
$$;
revoke all on function public.meryo_catalogo_publico() from public;
grant execute on function public.meryo_catalogo_publico() to anon,authenticated;
notify pgrst,'reload schema';
commit;
