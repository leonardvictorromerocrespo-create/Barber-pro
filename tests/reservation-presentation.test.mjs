import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bookingMoney,readableBookingDate,splitBookingRows} from '../src/lib/reservation-presentation.js';

test('upcoming and history use the persisted reservation states and appointment time',()=>{
 const now=Date.parse('2026-11-04T12:00:00Z');
 const rows=[
  {id:'request',estado:'solicitada',inicio:'2026-11-05T15:00:00Z'},
  {id:'accepted',estado:'aceptada',inicio:'2026-11-06T15:00:00Z'},
  {id:'confirmed',estado:'confirmada',inicio:'2026-11-07T15:00:00Z'},
  {id:'past-confirmed',estado:'confirmada',inicio:'2026-11-03T15:00:00Z'},
  {id:'rejected',estado:'rechazada',inicio:'2026-11-08T15:00:00Z'},
  {id:'expired',estado:'expirada',inicio:'2026-11-09T15:00:00Z'},
  {id:'cancelled',estado:'cancelada_cliente',inicio:'2026-11-10T15:00:00Z'},
  {id:'done',estado:'completada',inicio:'2026-11-02T15:00:00Z'},
  {id:'no-show',estado:'no_asistio',inicio:'2026-11-01T15:00:00Z'},
 ];
 const {upcoming,history}=splitBookingRows(rows,now);
 assert.deepEqual(upcoming.map(row=>row.id),['request','accepted','confirmed']);
 assert.deepEqual(history.map(row=>row.id),['cancelled','expired','rejected','past-confirmed','done','no-show']);
 assert.equal(rows[0].id,'request','the helper must not mutate the API result');
});

test('reservation date and soles stay readable and show two decimal places',()=>{
 const date=readableBookingDate('2026-11-04T15:30:00Z');
 assert.match(date.date,/miércoles, 4 de noviembre de 2026/);
 assert.match(date.time,/10:30/);
 assert.equal(bookingMoney(50),'S/ 50.00');
 assert.equal(bookingMoney(15.5),'S/ 15.50');
 assert.equal(bookingMoney(null),'No disponible');
 assert.equal(bookingMoney(''),'No disponible');
 assert.equal(readableBookingDate('invalid').date,'Fecha no disponible');
});

test('reservation actions retain server-state and role guards',async()=>{
 const fs=await import('node:fs/promises');
 const source=await fs.readFile(new URL('../src/components/Reservations.jsx',import.meta.url),'utf8');
 assert.match(source,/profile\.rol==='barbero'&&row\.puede_responder===true&&row\.estado==='solicitada'/);
 assert.match(source,/row\.estado==='aceptada'/);
 assert.match(source,/\['rechazada','expirada'\]\.includes\(row\.estado\)/);
 assert.match(source,/bookingDeadline\(row\)/);
});
