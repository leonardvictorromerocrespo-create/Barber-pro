import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createNotificationChime} from '../src/lib/notification-sound.js';

class FakeTarget extends EventTarget{}
class FakeAudioContext{
 constructor(){this.state='suspended';this.currentTime=1;this.destination={};this.started=[];}
 resume(){this.state='running';return Promise.resolve();}
 close(){this.state='closed';return Promise.resolve();}
 createOscillator(){const oscillator={frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},start:()=>this.started.push('start'),stop:()=>this.started.push('stop')};return oscillator;}
 createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};}
}

test('owner chime initializes only after a user gesture, plays once per notice, and queues one blocked beep briefly',async()=>{
 const target=new FakeTarget(),contexts=[];
 class TrackedAudioContext extends FakeAudioContext{constructor(){super();contexts.push(this);}}
 const chime=createNotificationChime({target,AudioContextClass:TrackedAudioContext});
 assert.equal(chime.play('notice-1'),false);
 assert.equal(contexts.length,0,'audio must not initialize during page load');
 target.dispatchEvent(new Event('pointerdown'));
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(chime.play('notice-1'),false,'the same pending notice must not sound twice');
 assert.equal(chime.play('notice-2'),true);
 assert.equal(chime.play('notice-2'),false,'the same rendered notice must not play twice');
 assert.equal(contexts.length,1);
 assert.deepEqual(contexts[0].started,['start','stop','start','stop']);
 chime.dispose();
});
