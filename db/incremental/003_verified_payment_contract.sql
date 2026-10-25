-- DRAFT: requires a server provider adapter and staging evidence before activation.
begin;
-- NULL preserves an undecided fee; no percentage or settlement is inferred.
alter table public.pagos alter column comision_plataforma drop not null,
  alter column comision_plataforma drop default;
create table meryo_private.payment_intents (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null unique references public.reservas(id),
  proveedor text not null check(length(proveedor) between 1 and 80),
  referencia text not null check(length(referencia) between 1 and 200),
  merchant_id text not null check(length(merchant_id) between 1 and 200),
  monto_centimos bigint not null check(monto_centimos>0),
  moneda text not null check(moneda='PEN'),
  live boolean not null,
  metodo text not null check(metodo in ('tarjeta','yape','plin')),
  created_at timestamptz not null default clock_timestamp(),
  unique(proveedor,referencia)
);
create table meryo_private.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null unique references meryo_private.payment_intents(id),
  resultado text not null check(resultado in ('confirmada','requiere_conciliacion')),
  created_at timestamptz not null default clock_timestamp()
);
revoke all on meryo_private.payment_intents,meryo_private.payment_receipts from public,anon,authenticated,service_role;
grant select on meryo_private.payment_intents,meryo_private.payment_receipts to service_role;

-- Call only after authenticated checkout creation, using server-side provider data.
create function public.registrar_intento_pago_verificado(
  p_reserva uuid,p_cliente uuid,p_proveedor text,p_referencia text,p_merchant text,p_live boolean,p_metodo text
) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.reservas%rowtype; s meryo_private.launch_settings%rowtype;
  i meryo_private.payment_intents%rowtype;
begin
  select * into r from public.reservas where id=p_reserva and cliente_id=p_cliente for update;
  if not found then raise exception 'Reserva no encontrada'; end if;
  if not exists(select 1 from public.profiles where id=p_cliente and activo is true) then
    raise exception 'Cuenta inactiva' using errcode='42501';
  end if;
  select * into s from meryo_private.launch_settings where id=1;
  if s.entorno='disabled' or not s.reservas_habilitadas or p_live is distinct from (s.entorno='production') then
    raise exception 'Entorno de pago no habilitado';
  end if;
  if r.estado<>'aceptada' or r.expira_pago_en is null or r.expira_pago_en<=clock_timestamp() then
    raise exception 'Reserva no disponible para pago';
  end if;
  if p_proveedor in ('prueba','simulado','mock') then raise exception 'Proveedor simulado prohibido'; end if;
  select * into i from meryo_private.payment_intents where reserva_id=r.id;
  if found then
    if i.proveedor is distinct from p_proveedor or i.referencia is distinct from p_referencia or i.merchant_id is distinct from p_merchant or i.live is distinct from p_live or i.metodo is distinct from p_metodo then
      raise exception 'Intento de pago ya registrado con otros datos';
    end if;
    return i.id;
  end if;
  insert into meryo_private.payment_intents(reserva_id,proveedor,referencia,merchant_id,monto_centimos,moneda,live,metodo)
  values(r.id,p_proveedor,p_referencia,p_merchant,round(r.monto_adelanto*100)::bigint,'PEN',p_live,p_metodo)
  returning id into i.id;
  return i.id;
end;
$$;

-- Server must validate webhook authenticity AND retrieve authoritative provider
-- status before calling. No browser-supplied confirmation is trusted here.
create function public.confirmar_pago_verificado(
  p_intent uuid,p_proveedor text,p_referencia text,p_merchant text,
  p_monto_centimos bigint,p_moneda text,p_live boolean
) returns text language plpgsql security definer set search_path='' as $$
declare r public.reservas%rowtype; i meryo_private.payment_intents%rowtype;
  receipt meryo_private.payment_receipts%rowtype; result text;
  s meryo_private.launch_settings%rowtype;
begin
  select * into i from meryo_private.payment_intents where id=p_intent;
  if not found then raise exception 'Intento desconocido'; end if;
  select * into r from public.reservas where id=i.reserva_id for update;
  select * into s from meryo_private.launch_settings where id=1;
  if s.entorno='disabled' or p_live is distinct from (s.entorno='production') then raise exception 'Entorno de pago incorrecto'; end if;
  if p_proveedor is distinct from i.proveedor or p_referencia is distinct from i.referencia
    or p_merchant is distinct from i.merchant_id or p_monto_centimos is distinct from i.monto_centimos
    or p_moneda is distinct from i.moneda or p_live is distinct from i.live then
    raise exception 'Pago no coincide con el intento';
  end if;
  select * into receipt from meryo_private.payment_receipts where intent_id=i.id;
  if found then return receipt.resultado; end if;
  if r.estado='aceptada' and r.expira_pago_en>clock_timestamp() then
    insert into public.pagos(reserva_id,monto,moneda,metodo,proveedor,proveedor_ref,estado,comision_plataforma,pagado_en)
    values(r.id,i.monto_centimos/100.0,'PEN',i.metodo,i.proveedor,i.referencia,'pagado',
      s.comision_centimos/100.0,clock_timestamp());
    update public.reservas set estado='confirmada',pagada_en=clock_timestamp(),expira_pago_en=null where id=r.id;
    perform public.notificar(r.cliente_id,'Reserva confirmada','El servidor verifico el adelanto.','reserva_confirmada',r.id);
    perform public.notificar_barberia(r.barberia_id,'Reserva pagada','El servidor verifico el adelanto.','reserva_pagada',r.id);
    result := 'confirmada';
  else
    if r.estado='aceptada' and r.expira_pago_en<=clock_timestamp() then
      update public.reservas set estado='expirada',cerrada_en=clock_timestamp(),expira_pago_en=null where id=r.id;
    end if;
    -- Retain the verified receipt for reconciliation; NEVER revive a released slot.
    result := 'requiere_conciliacion';
  end if;
  insert into meryo_private.payment_receipts(intent_id,resultado) values(i.id,result);
  return result;
end;
$$;
revoke all on function public.registrar_intento_pago_verificado(uuid,uuid,text,text,text,boolean,text),
  public.confirmar_pago_verificado(uuid,text,text,text,bigint,text,boolean) from public,anon,authenticated;
grant execute on function public.registrar_intento_pago_verificado(uuid,uuid,text,text,text,boolean,text),
  public.confirmar_pago_verificado(uuid,text,text,text,bigint,text,boolean) to service_role;
commit;
