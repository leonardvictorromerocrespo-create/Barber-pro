import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { bookingAccounts } from './helpers/real-booking.mjs';
import { realConfig, secrets } from '../scripts/setup-real-auth.mjs';

const localDate = offset => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(Date.now() + offset * 86400000);
const timeOf = stamp => new Date(stamp).toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false });

test('native Supabase staging: all cuts, partial-category rejection, price validation and last-slot release', { skip: process.env.MERYO_REAL_AUTH_TEST !== '1' }, async t => {
  const accounts = await bookingAccounts({ customerFile: 'cliente-campania-50.json' });
  const db = new pg.Client(realConfig);
  await db.connect();
  const { rows: [target] } = await db.query("select current_database() database,host(inet_server_addr()) host,inet_server_port() port");
  assert.deepEqual(target, { database: 'meryo_auth_local', host: '127.0.0.1', port: 55440 });

  const { anonKey } = await secrets();
  const authClient = () => createClient('http://127.0.0.1:5178/__supabase', anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const publicClient = authClient();
  let secondOwner = authClient();
  let secondUserId = null, secondShopId = null, secondShopName = null, bookingId = null, campaignId = null;
  const createdServiceIds = [];
  let originalCategory = null;
  const shop = accounts.shop;
  const service = accounts.service;
  const day = localDate(2);
  const windows = [{ start: '18:30', end: '19:00' }];

  async function addService(owner, shopId, name, category, price = 40) {
    const result = await owner.from('servicios').insert({ barberia_id: shopId, nombre: name, categoria: category, precio: price, duracion_min: 30, activo: true }).select('id').single();
    assert.ifError(result.error);
    return result.data.id;
  }
  async function saveCampaign(owner) {
    return owner.rpc('meryo_guardar_campania_cortes', { p_inicio: day, p_fin: day, p_horarios: windows, p_activa: true });
  }

  try {
    await t.test('first barber shop is eligible only when all its recognized cuts participate', async () => {
      const current = await accounts.owner.from('servicios').select('categoria').eq('id', service).single();
      assert.ifError(current.error); originalCategory = current.data.categoria;
      assert.ifError((await accounts.owner.from('servicios').update({ categoria: 'cortes' }).eq('id', service)).error);
      const fade = await addService(accounts.owner, shop, 'Fade bajo de prueba', 'cortes', 40); createdServiceIds.push(fade);
      const beard = await addService(accounts.owner, shop, 'Barba sola de prueba', 'cortes', 20); createdServiceIds.push(beard);
      const packageId = await addService(accounts.owner, shop, 'Paquete corte y barba de prueba', 'cortes', 55); createdServiceIds.push(packageId);
      const dye = await addService(accounts.owner, shop, 'Tinte de prueba', 'coloracion', 60); createdServiceIds.push(dye);

      const saved = await saveCampaign(accounts.owner); assert.ifError(saved.error); campaignId = saved.data;
      const offersResult = await publicClient.rpc('meryo_cortes_50_disponibles'); assert.ifError(offersResult.error);
      const offers = offersResult.data.filter(row => String(row.shop_id) === String(shop));
      assert.equal(offers.length, 2, 'Both recognized cuts are included, with no per-service choice in campaign settings');
      assert.deepEqual(offers.map(row => row.service_name).sort(), ['Corte MERYO', 'Fade bajo de prueba'].sort());
      for (const offer of offers) {
        assert.equal(Number(offer.promo_price), Number((Number(offer.regular_price) * .5).toFixed(2)));
        assert.equal(offer.slots.length, 1, 'The campaign exposes only currently reservable matching slots');
        assert.equal(timeOf(offer.slots[0].start), '18:30');
      }
      assert.ok(!offers.some(row => /barba|tinte|paquete/i.test(row.service_name)));
    });

    await t.test('a second barber shop cannot activate a campaign while one cut is misclassified', async () => {
      const credentials = { email: `meryo.cortes.parcial.${crypto.randomUUID()}@example.com`, password: crypto.randomBytes(24).toString('base64url') };
      secondShopName = `MERYO Staging cortes parciales ${crypto.randomUUID().slice(0, 8)}`;
      const signup = await secondOwner.auth.signUp(credentials); assert.ifError(signup.error); assert.ok(signup.data.user);
      secondUserId = signup.data.user.id;
      const registered = await secondOwner.rpc('registrar_negocio', { p_nombre: secondShopName, p_distrito: 'Ate Vitarte', p_direccion: 'Ubicación de prueba', p_descripcion: '', p_lat: -12.0464, p_lng: -76.0428, p_whatsapp: null, p_correo: null, p_tipo_negocio: 'barberia' });
      assert.ifError(registered.error); secondShopId = registered.data;
      await db.query("update public.barberias set estado='activa',verificada=true,disponible_ahora=true where id=$1", [secondShopId]);
      const profile = await secondOwner.from('profiles').select('rol,barberia_id,activo').eq('id', secondUserId).single();
      assert.ifError(profile.error); assert.equal(profile.data.rol, 'barbero'); assert.equal(String(profile.data.barberia_id), String(secondShopId));
      const cut = await addService(secondOwner, secondShopId, 'Corte clásico parcial de prueba', 'cortes', 32);
      const unclassifiedCut = await addService(secondOwner, secondShopId, 'Fade alto parcial de prueba', 'general', 44);
      const partial = await saveCampaign(secondOwner);
      assert.ok(partial.error); assert.match(partial.error.message, /clasificación de todos los servicios de corte/i);
      const visible = await publicClient.rpc('meryo_cortes_50_disponibles'); assert.ifError(visible.error);
      assert.ok(!visible.data.some(row => String(row.shop_id) === String(secondShopId)), 'A rejected partial setup must not appear publicly');
      createdServiceIds.push(cut, unclassifiedCut);
    });

    await t.test('reservation locks the final promo slot at 50% and exhausted offers disappear', async () => {
      const publicOffers = await publicClient.rpc('meryo_cortes_50_disponibles'); assert.ifError(publicOffers.error);
      const offer = publicOffers.data.find(row => String(row.shop_id) === String(shop)); assert.ok(offer);
      const slot = offer.slots[0];
      const team = await accounts.owner.rpc('meryo_equipo'); assert.ifError(team.error);
      const member = team.data.members.find(row => row.propietario)?.id; assert.ok(member);
      const result = await accounts.customer.rpc('meryo_solicitar_cita', {
        p_barberia_id: shop, p_servicio_id: offer.service_id, p_inicio: slot.start,
        p_nombre: 'Cliente de staging', p_telefono: '999999999', p_pedido: 'Solicitud promocional sintética', p_extra: 0,
        p_barbero_id: member, p_campaign_id: campaignId, p_precio_habitual: offer.regular_price,
      });
      assert.ifError(result.error); bookingId = result.data;
      const { rows: [saved] } = await db.query('select estado,precio_total,monto_adelanto,precio_habitual,campania_corte_id,expira_respuesta_en,created_at from public.reservas where id=$1', [bookingId]);
      assert.equal(saved.estado, 'solicitada'); assert.equal(Number(saved.precio_habitual), Number(offer.regular_price));
      assert.equal(Number(saved.precio_total), Number(offer.promo_price)); assert.equal(Number(saved.monto_adelanto), Number((Number(offer.promo_price) * .5).toFixed(2)));
      assert.equal(saved.campania_corte_id, campaignId);
      assert.ok(Math.abs((Date.parse(saved.expira_respuesta_en) - Date.parse(saved.created_at)) / 1000 - 900) < 2);
      const exhausted = await publicClient.rpc('meryo_cortes_50_disponibles'); assert.ifError(exhausted.error);
      assert.ok(!exhausted.data.some(row => String(row.shop_id) === String(shop)), 'No active offer remains after its last reservable slot is held');
      const duplicate = await accounts.customer.rpc('meryo_solicitar_cita', {
        p_barberia_id: shop, p_servicio_id: createdServiceIds[0], p_inicio: slot.start,
        p_nombre: 'Cliente de staging', p_telefono: '999999999', p_pedido: null, p_extra: 0,
        p_barbero_id: member, p_campaign_id: campaignId, p_precio_habitual: 40,
      });
      assert.ok(duplicate.error); assert.match(duplicate.error.message, /turno promocional ya no está disponible/i);
      const changedPrice = await accounts.customer.rpc('meryo_solicitar_cita', {
        p_barberia_id: shop, p_servicio_id: offer.service_id, p_inicio: slot.start,
        p_nombre: 'Cliente de staging', p_telefono: '999999999', p_pedido: null, p_extra: 0,
        p_barbero_id: member, p_campaign_id: campaignId, p_precio_habitual: Number(offer.regular_price) + 1,
      });
      assert.ok(changedPrice.error); assert.match(changedPrice.error.message, /precio habitual cambió/i);
      await db.query("update meryo_private.cut50_campaigns set starts_on=(clock_timestamp() at time zone 'America/Lima')::date-2,ends_on=(clock_timestamp() at time zone 'America/Lima')::date-1 where id=$1", [campaignId]);
      const expired = await publicClient.rpc('meryo_cortes_50_disponibles'); assert.ifError(expired.error);
      assert.ok(!expired.data.some(row => String(row.shop_id) === String(shop)), 'An expired campaign is removed from the public list');
    });
  } finally {
    if (bookingId) {
      await db.query('delete from meryo_private.push_deliveries where outbox_id in(select id from meryo_private.push_outbox where reserva_id=$1)', [bookingId]);
      await db.query('delete from meryo_private.push_outbox where reserva_id=$1', [bookingId]);
      await db.query('delete from public.notificaciones where reserva_id=$1', [bookingId]);
      await db.query('delete from meryo_private.reservation_events where reserva_id=$1', [bookingId]);
      await db.query('delete from public.reservas where id=$1', [bookingId]);
    }
    if (campaignId) await db.query('delete from meryo_private.cut50_campaigns where id=$1', [campaignId]);
    if (createdServiceIds.length) {
      await db.query('delete from public.meryo_team_services where service_id=any($1::bigint[])', [createdServiceIds]);
      await db.query('delete from public.servicios where id=any($1::bigint[])', [createdServiceIds]);
    }
    if (originalCategory !== null) await db.query('update public.servicios set categoria=$2 where id=$1', [service, originalCategory]);
    if (secondShopId) await db.query("update public.barberias set estado='rechazada',verificada=false,disponible_ahora=false where id=$1 and nombre=$2", [secondShopId,secondShopName]);
    await db.query('select meryo_private.rebuild_business_promotion_calendar($1)', [shop]);
    if (secondShopId) await db.query('select meryo_private.rebuild_business_promotion_calendar($1)', [secondShopId]);
    await accounts.close(); await secondOwner.auth.signOut({ scope: 'local' }).catch(() => {}); await db.end();
  }
});
