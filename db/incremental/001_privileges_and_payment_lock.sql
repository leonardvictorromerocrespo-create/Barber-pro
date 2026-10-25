-- DRAFT: validated only in local PostgreSQL. Never apply automatically.
-- Targets the recovered public contract, not db/candidate/meryo.
begin;
do $guard$
begin
  if to_regprocedure('public.crear_reserva(bigint,bigint,timestamptz,text,text,text,numeric)') is null
     or to_regclass('public.reservas_legacy') is null
     or not exists (select 1 from pg_constraint where conrelid='public.reservas'::regclass and conname='reservas_sin_cruce' and contype='x') then
    raise exception 'Unexpected baseline; stop and compare schema';
  end if;
end;
$guard$;

-- RLS does not protect TRUNCATE or sequence manipulation.
revoke truncate, references, trigger, maintain on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant usage on sequence public.servicios_id_seq, public.horarios_id_seq,
  public.bloqueos_id_seq, public.barberia_media_id_seq to authenticated;

-- Existing column-scoped UPDATE grants (profile/name, notification/read, etc.)
-- are deliberately preserved. Business writes continue through the RPCs.
create or replace function public.pagar_reserva_prueba(p_reserva_id uuid, p_metodo text)
returns text language plpgsql security definer set search_path='' as $$
begin
  raise exception 'Pago simulado deshabilitado en el backend comercial' using errcode='42501';
end;
$$;
revoke all on function public.pagar_reserva_prueba(uuid,text) from public, anon, authenticated, service_role;

-- Neither old endpoint checks the verified amount/currency/merchant. Close both
-- entry points, including service_role, until the verified server path is ready.
create or replace function public.confirmar_pago_interno(p_reserva uuid,p_proveedor text,p_ref text,p_metodo text)
returns void language plpgsql security definer set search_path='' as $$
begin
  raise exception 'Use el contrato de pago verificado del servidor' using errcode='42501';
end;
$$;
create or replace function public.confirmar_pago_reserva(p_reserva_id uuid,p_proveedor text,p_ref text,p_metodo text)
returns void language plpgsql security definer set search_path='' as $$
begin
  raise exception 'Use el contrato de pago verificado del servidor' using errcode='42501';
end;
$$;
revoke all on function public.confirmar_pago_interno(uuid,text,text,text),
  public.confirmar_pago_reserva(uuid,text,text,text) from public, anon, authenticated, service_role;
commit;
