import test from 'node:test';
import assert from 'node:assert/strict';
import {availableAgendaStarts,dayAgenda,overlaps} from '../src/lib/day-agenda.js';

test('Agenda de hoy scopes by professional and Lima date without losing later requests',()=>{
 const r=(id,barbero_id,estado,inicio,fin,extra={})=>({id,barbero_id,estado,inicio,fin,...extra});
 const rows=[
  r('today','staff','confirmada','2026-11-10T03:30Z','2026-11-10T04:00Z'),
  r('expired','staff','expirada','2026-11-09T15:00Z','2026-11-09T15:30Z'),
  r('future','staff','solicitada','2026-11-10T15:00Z','2026-11-10T15:30Z',{puede_responder:true,expira_respuesta_en:'2026-11-09T14:15Z'}),
  r('other','different','solicitada','2026-11-09T16:00Z','2026-11-09T16:30Z',{puede_responder:true}),
 ];
 const blocks=[{id:'manual',starts:'2026-11-09T16:00Z',ends:'2026-11-09T16:30Z',reason:'Cita externa · WhatsApp'}];
 const data=dayAgenda(rows,blocks,'staff','2026-11-09',Date.parse('2026-11-09T14:00Z'));
 assert.deepEqual(data.timeline.map(item=>item.id),['r-expired','b-manual','r-today']);
 assert.deepEqual(data.pending.map(item=>item.id),['future']);
 assert.equal(data.confirmed,1);
 assert.equal(data.external,1);
 assert.equal(data.next.id,'b-manual');
 assert.equal(data.occupied.some(row=>row.id==='expired'),false);
 assert.equal(overlaps(Date.parse('2026-11-09T16:30Z'),Date.parse('2026-11-09T17:00Z'),blocks[0]),false);
});

test('online availability excludes elapsed or occupied slots and uses Lima for the day',()=>{
 const slots=[
  {id:'past',time:'2026-11-09T14:00Z'},{id:'occupied',time:'2026-11-09T16:00Z',occupied:true},
  {id:'tonight',time:'2026-11-10T01:00Z'},{id:'tomorrow',time:'2026-11-10T05:00Z'},
 ];
 assert.deepEqual(availableAgendaStarts(slots,'2026-11-09',Date.parse('2026-11-09T15:00Z')).map(s=>s.id),['tonight']);
});
