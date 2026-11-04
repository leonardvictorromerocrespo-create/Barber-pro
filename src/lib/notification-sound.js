export function createNotificationChime({target=globalThis.window,AudioContextClass=target?.AudioContext||target?.webkitAudioContext||globalThis.AudioContext}={}){
 let context=null,resuming=null,disposed=false,pending=null;
 const played=new Set();
 async function unlock(){
  if(disposed||!AudioContextClass)return false;
  try{
   context??=new AudioContextClass();
   if(context.state!=='running'){
    resuming??=Promise.resolve(context.resume()).then(()=>context.state==='running').catch(()=>false).finally(()=>{resuming=null;});
    if(!await resuming)return false;
   }
   if(pending&&pending.expiresAt>Date.now())emit(pending.id);
   pending=null;
   return true;
  }catch{return false;}
 }
 function emit(id){
  if(disposed||!context||context.state!=='running'||played.has(id))return false;
  try{
   const now=context.currentTime,osc=context.createOscillator(),gain=context.createGain();
   osc.type='sine';osc.frequency.setValueAtTime(740,now);osc.frequency.exponentialRampToValueAtTime(980,now+.12);
   gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.11,now+.025);gain.gain.exponentialRampToValueAtTime(.0001,now+.24);
   osc.connect(gain);gain.connect(context.destination);osc.start(now);osc.stop(now+.25);played.add(id);return true;
  }catch{return false;}
 }
 const onGesture=()=>{void unlock();};
 target?.addEventListener('pointerdown',onGesture,{passive:true});
 target?.addEventListener('keydown',onGesture);
 target?.addEventListener('touchstart',onGesture,{passive:true});
 return {
  unlock,
  play(id){
   const key=String(id);
   if(played.has(key)||pending?.id===key)return false;
   if(context?.state==='running')return emit(key);
   pending={id:key,expiresAt:Date.now()+30000};
   return false;
  },
  dispose(){
   disposed=true;pending=null;
   target?.removeEventListener('pointerdown',onGesture);
   target?.removeEventListener('keydown',onGesture);
   target?.removeEventListener('touchstart',onGesture);
   try{const closing=context?.state!=='closed'?context?.close?.():null;if(closing?.catch)void closing.catch(()=>{/* Closing an audio context is best effort. */});}catch{/* Audio context cleanup is best effort. */}
  },
 };
}
