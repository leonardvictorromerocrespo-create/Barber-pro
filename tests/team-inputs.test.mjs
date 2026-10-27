import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readTeamInvite,clearTeamInvite} from '../src/lib/team-invite.js';
import {limaInputInstant} from '../src/lib/lima-time-input.js';
import {saveDraft,readDraft} from '../src/lib/booking-draft.js';
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
test('invitation survives authentication navigation, expires and rejects malformed or future state',()=>{
 const s=memory(),token='a'.repeat(64),now=100000;
 assert.equal(readTeamInvite(s,'#team-invite/'+token,now),token);
 assert.equal(readTeamInvite(s,'#team-invite',now+1),token);
 assert.equal(readTeamInvite(s,'',now+7*86400000),'');
 assert.equal(readTeamInvite(s,'#team-invite/'+token+'?rol=admin',now),'');
 readTeamInvite(s,'#team-invite/'+token,now);
 assert.equal(readTeamInvite(s,'',now-1),'');
 readTeamInvite(s,'#team-invite/'+token,now);clearTeamInvite(s);assert.equal(readTeamInvite(s,'',now),'');
});
test('individual appointment draft retains the barber but cannot carry authority fields',()=>{
 const s=memory(),barber='4f3536da-32fc-4842-9e62-fce386986996';
 saveDraft(s,{shop:9,service:12,barber,date:'2026-10-28',time:'10:30',rol:'admin',token:'secret'},100);
 const restored=readDraft(s,101);assert.equal(restored.barber,barber);assert.equal(restored.rol,undefined);assert.equal(restored.token,undefined);
 assert.equal(readDraft(s,100+30*60000+1),null);
});
test('agenda uses Lima independent of computer timezone and rejects impossible dates',()=>{
 assert.equal(limaInputInstant('2026-10-28T09:30'),'2026-10-28T14:30:00.000Z');
 assert.equal(limaInputInstant('2028-02-29T00:00'),'2028-02-29T05:00:00.000Z');
 for(const value of ['2026-02-29T09:00','2026-04-31T09:00','2026-10-28T24:00','2026-10-28T09:60','2026-10-28T09:00Z',''])assert.throws(()=>limaInputInstant(value));
});
