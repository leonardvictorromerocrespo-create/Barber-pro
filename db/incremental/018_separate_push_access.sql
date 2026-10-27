begin;
-- Personal notification consent is not an administrative action. Authority is
-- still the actual active Auth session; endpoint ownership never changes.
do $$declare definition text;begin
 definition:=pg_get_functiondef('public.meryo_registrar_push(jsonb)'::regprocedure);
 if position(' or (exists(select 1 from public.profiles where id=uid and rol=''admin'') and not public.es_admin())' in definition)=0 then raise exception 'Unexpected subscription contract; compare 016 first';end if;
 definition:=replace(definition,' or (exists(select 1 from public.profiles where id=uid and rol=''admin'') and not public.es_admin())','');execute definition;
end$$;
create or replace function public.meryo_push_estado() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not public.meryo_cuenta_activa() then raise exception 'Inicia sesión para consultar tus dispositivos' using errcode='42501';end if;
 return jsonb_build_object('dispositivos',(select count(*) from meryo_private.push_subscriptions where user_id=auth.uid()));
end$$;
create function public.meryo_push_dispositivo(p_endpoint text) returns boolean language plpgsql stable security definer set search_path='' as $$begin
 if not public.meryo_cuenta_activa() then raise exception 'Inicia sesión' using errcode='42501';end if;
 return exists(select 1 from meryo_private.push_subscriptions where endpoint=p_endpoint and user_id=auth.uid());
end$$;
create function public.meryo_push_admin_estado() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not public.es_admin() then raise exception 'El diagnóstico administrativo requiere administrador y MFA' using errcode='42501';end if;
 return public.meryo_push_estado()||jsonb_build_object('ultimos',coalesce((select jsonb_agg(j order by j->>'created_at' desc) from (
 select jsonb_build_object('id',o.id,'notification_id',o.notification_id,'evento',o.event,'estado',o.status,'created_at',o.created_at,'provider_accepted_at',o.provider_accepted_at,'recibida_en',max(d.received_at),'abierta_en',max(d.clicked_at)) j from meryo_private.push_outbox o left join meryo_private.push_deliveries d on d.outbox_id=o.id where o.user_id=auth.uid() group by o.id order by o.created_at desc limit 10) q),'[]'::jsonb));
end$$;
do $$declare definition text;begin
 definition:=pg_get_functiondef('public.meryo_probar_push()'::regprocedure);
 definition:=replace(definition,'perform public.meryo_push_estado();','perform public.meryo_push_admin_estado();');execute definition;
end$$;
revoke all on function public.meryo_push_dispositivo(text),public.meryo_push_admin_estado() from public,anon;
grant execute on function public.meryo_push_dispositivo(text),public.meryo_push_admin_estado() to authenticated;
notify pgrst,'reload schema';
commit;
