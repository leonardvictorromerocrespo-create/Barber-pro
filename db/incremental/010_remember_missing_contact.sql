begin;
-- Remember only missing contact fields, after the reservation is actually saved.
-- Identity, price, roles and booking ownership continue to come from the server.
do $contact$
declare source text;
begin
 source:=pg_get_functiondef('public.crear_reserva(bigint,bigint,timestamptz,text,text,text,numeric)'::regprocedure);
 if position('  return v_id;' in source)=0 or position('public.meryo_cuenta_activa()' in source)=0 then raise exception 'Unexpected booking contract'; end if;
 source:=replace(source,'  return v_id;',E'  update public.profiles set nombre=coalesce(nullif(trim(nombre),''''),p_nombre), telefono=coalesce(nullif(trim(telefono),''''),p_telefono) where id=v_uid;\n  return v_id;');
 execute source;
end $contact$;
commit;
