// Local build tool: derives a reviewable patch from the recovered function bodies.
// Does not connect to a database. Exact-match replacements fail on unexpected input.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const ref = JSON.parse(await fs.readFile(new URL('../db/reference/supabase-2026-10-25/schema.json', import.meta.url), 'utf8'));
const bodies = [];
const guards = [];
function source(name) {
  const fn = ref.functions.find(f => f.signature.startsWith(`${name}(`));
  if (!fn) throw Error(`Missing ${name}`);
  const hash = createHash('md5').update(fn.definition).digest('hex');
  guards.push(`if md5(pg_get_functiondef('public.${fn.signature}'::regprocedure)) <> '${hash}' then raise exception 'Function drift: ${name}'; end if;`);
  return fn.definition;
}
function replace(sql, oldText, newText) {
  if (sql.split(oldText).length !== 2) throw Error(`Expected unique baseline fragment: ${oldText}`);
  return sql.replace(oldText, newText);
}
let sql = source('crear_reserva');
sql = replace(sql, "if v_uid is null then raise exception 'Debes iniciar sesion para reservar'; end if;", `if v_uid is null then raise exception 'Debes iniciar sesion para reservar'; end if;
  perform 1 from public.profiles where id=v_uid and activo is true for update;
  if not found then raise exception 'Cuenta inactiva o perfil ausente' using errcode='42501'; end if;
  if not (select reservas_habilitadas from meryo_private.launch_settings where id=1) then
    raise exception 'Las reservas comerciales aun no estan habilitadas';
  end if;
  if p_inicio is null then raise exception 'Hora requerida'; end if;`);
sql = replace(sql, 'and verificada and disponible_ahora;', "and verificada and estado='activa' and disponible_ahora;");
sql = replace(sql, "v_adelanto := round(v_total * public.cfg('adelanto_pct')::numeric / 100, 2);", 'v_adelanto := round(v_total * 0.5, 2);');
sql = replace(sql, "v_estado := case when v_bar.acepta_auto then 'aceptada' else 'solicitada' end;", "v_estado := 'solicitada'; -- Acceptance is always manual.");
sql = sql.replaceAll("make_interval(mins => public.cfg('minutos_respuesta_barbero')::int)", "interval '5 minutes'");
sql = sql.replaceAll("make_interval(mins => public.cfg('minutos_pago_cliente')::int)", '(select make_interval(secs => plazo_pago_segundos) from meryo_private.launch_settings where id=1)');
sql = replace(sql, "public.cfg('minutos_respuesta_barbero') || ' minutos", "'5' || ' minutos");
bodies.push(sql.replaceAll('now()', 'clock_timestamp()'));
sql = source('responder_reserva');
sql = replace(sql, "if v_bar is null then raise exception 'No autorizado'; end if;", "if v_bar is null or p_aceptar is null then raise exception 'No autorizado'; end if;");
sql = sql.replaceAll("make_interval(mins => public.cfg('minutos_pago_cliente')::int)", '(select make_interval(secs => plazo_pago_segundos) from meryo_private.launch_settings where id=1)');
sql = replace(sql, "public.cfg('minutos_pago_cliente') || ' minutos", "(select (plazo_pago_segundos / 60.0)::text from meryo_private.launch_settings where id=1) || ' minutos");
bodies.push(sql.replaceAll('now()', 'clock_timestamp()'));
bodies.push(source('expirar_reservas_vencidas').replaceAll('now()', 'clock_timestamp()'));
for (const name of ['cancelar_reserva_cliente', 'cancelar_reserva_barbero']) {
  sql = source(name);
  const beginAt = sql.indexOf("  if v_r.estado not in");
  if (beginAt < 0) throw Error(`Missing transition check: ${name}`);
  sql = `${sql.slice(0, beginAt)}  if v_r.estado='confirmada' then
    raise exception 'Cancelacion con pago pendiente de politica y devolucion verificada';
  end if;
${sql.slice(beginAt)}`;
  if (name === 'cancelar_reserva_cliente') {
    const start = sql.indexOf("  if v_r.estado = 'confirmada' then");
    const end = sql.indexOf('\n  update public.reservas', start);
    if (start < 0 || end < 0) throw Error('Missing refund branch');
    sql = sql.slice(0, start) + "  v_res := 'cancelada';\n" + sql.slice(end);
    sql = replace(sql, 'begin\n  select * into v_r', `begin
  perform 1 from public.profiles where id=(select auth.uid()) and activo is true;
  if not found then raise exception 'Cuenta inactiva' using errcode='42501'; end if;
  select * into v_r`);
  } else {
    sql = replace(sql, "  update public.pagos set estado = 'reembolso_pendiente' where reserva_id = v_r.id and estado = 'pagado';\n", '');
    sql = replace(sql, ' fue cancelada. Si pagaste, se te devuelve el adelanto completo.', ' fue cancelada.');
  }
  sql = sql.replaceAll('now()', 'clock_timestamp()');
  bodies.push(sql);
}
sql = source('registrar_barberia');
sql = replace(sql, 'from public.profiles where id = v_uid;', 'from public.profiles where id = v_uid and activo is true for update;');
bodies.push(sql);
sql = source('dejar_resena');
sql = replace(sql, 'begin\n  select * into v_r', `begin
  perform 1 from public.profiles where id=(select auth.uid()) and activo is true;
  if not found then raise exception 'Cuenta inactiva' using errcode='42501'; end if;
  select * into v_r`);
bodies.push(sql);
for (const name of ['mi_barberia_id','es_admin']) {
  bodies.push(replace(source(name),'coalesce(activo, true)','activo is true'));
}
const header = `-- DRAFT. Derived from snapshot 2026-10-25; local validation only.
-- No candidate meryo schema. No production application or automatic deployment.
begin;
do $guard$ begin
${guards.join('\n')}
end; $guard$;
create schema if not exists meryo_private;
revoke all on schema meryo_private from public,anon,authenticated;
grant usage on schema meryo_private to service_role;
create table meryo_private.launch_settings (
  id integer primary key check(id=1),
  reservas_habilitadas boolean not null default false,
  plazo_pago_segundos integer not null default 300 check(plazo_pago_segundos between 60 and 1800),
  comision_centimos integer check(comision_centimos in (100,200)),
  criterio_comision text,
  politica_cancelacion jsonb,
  politica_devolucion jsonb,
  politica_liquidacion jsonb,
  entorno text not null default 'disabled' check(entorno in ('disabled','staging','production'))
);
insert into meryo_private.launch_settings(id) values(1);
revoke all on meryo_private.launch_settings from public,anon,authenticated;
grant select,update on meryo_private.launch_settings to service_role;
create function public.meryo_cuenta_activa() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles where id=(select auth.uid()) and activo is true);
$$;
revoke all on function public.meryo_cuenta_activa() from public,anon;
grant execute on function public.meryo_cuenta_activa() to authenticated;
create policy meryo_active_account on public.reservas as restrictive for select to authenticated using(public.meryo_cuenta_activa());
create policy meryo_active_account on public.pagos as restrictive for select to authenticated using(public.meryo_cuenta_activa());
create policy meryo_active_account on public.notificaciones as restrictive for all to authenticated using(public.meryo_cuenta_activa()) with check(public.meryo_cuenta_activa());
`;
await fs.mkdir(new URL('../db/incremental/', import.meta.url), { recursive: true });
await fs.writeFile(new URL('../db/incremental/002_manual_booking_flow.sql', import.meta.url), header + bodies.map(s => `${s};`).join('\n') + '\ncommit;\n');
