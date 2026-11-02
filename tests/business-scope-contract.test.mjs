import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('business agendas are derived from the authenticated business ID and reservation RLS',async()=>{
 const [operations,team,booking,api,reservations]=await Promise.all([
  fs.readFile('db/incremental/012_shop_operations.sql','utf8'),
  fs.readFile('db/incremental/014_team_scheduling.sql','utf8'),
  fs.readFile('db/incremental/005_booking_requests_monthly.sql','utf8'),
  fs.readFile('src/lib/meryo-api.js','utf8'),
  fs.readFile('src/components/Reservations.jsx','utf8'),
 ]);
 assert.match(operations,/user_id uuid not null unique references public\.profiles\(id\)/,'owner account is bound to one business');
 assert.match(team,/user_id uuid not null unique references public\.profiles\(id\)/,'team account is bound to one business');
 assert.match(team,/p\.id=auth\.uid\(\) and p\.rol='barbero' and p\.activo and m\.active and public\.meryo_sesion_activa\(\)/,'business context comes from the authenticated active profile');
 assert.match(team,/create policy meryo_assigned_reservation_read on public\.reservas as restrictive for select/);
 assert.match(team,/cliente_id=auth\.uid\(\).*public\.es_admin\(\).*public\.meryo_es_propietario\(barberia_id\).*meryo_es_cita_asignada\(barbero_id\)/s,'reservation reads remain scoped by client, owner, or assigned professional');
 assert.match(booking,/security invoker/,'the reservation snapshot runs with caller permissions');
 assert.match(booking,/r\.cliente_id=\(select auth\.uid\(\)\) or r\.barberia_id=public\.mi_barberia_id\(\)/,'client history is personal and business agenda is server-bound');
 assert.match(api,/rpc\('meryo_reservas_estado'\)/,'the UI delegates reservation visibility to the server');
 assert.doesNotMatch(reservations,/businessCategory|isBeauty/,'reservation wording cannot be selected by the currently open catalog');
 assert.match(reservations,/row\.barberias\?\.nombre\} · \{row\.servicio_nombre/,'client history still identifies each business and service');
});
