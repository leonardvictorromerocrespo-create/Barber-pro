import {createClient} from '@supabase/supabase-js';
import {secrets,nativeRoot} from '../../scripts/setup-real-auth.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

// Existing local native services only. No actor IDs, fabricated sessions or .env.
export async function bookingAccounts({customerFile='cliente-reservas.json'}={}){
 const {anonKey}=await secrets();
 const make=()=>createClient('http://127.0.0.1:5178/__supabase',anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const owner=make(),customer=make();
 const ownerCredentials=JSON.parse(await fs.readFile(path.join(nativeRoot,'propietario-pruebas.json'),'utf8'));
 if(!['cliente-reservas.json','cliente-flujo-tests.json','cliente-concurrencia.json'].includes(customerFile))throw Error('Unknown local test account');
 let credentials;const file=path.join(nativeRoot,customerFile);
 try{credentials=JSON.parse(await fs.readFile(file,'utf8'));}
 catch(e){
  if(e.code!=='ENOENT')throw e;
  credentials={email:`citas.${crypto.randomUUID()}@example.com`,password:crypto.randomBytes(24).toString('base64url')};
  const {error}=await customer.auth.signUp(credentials);if(error)throw error;
  await fs.writeFile(file,JSON.stringify(credentials),{flag:'wx'});
 }
 for(const [client,values] of [[owner,ownerCredentials],[customer,credentials]]){const {error}=await client.auth.signInWithPassword(values);if(error)throw error;}
 const {data:identity,error:identityError}=await owner.auth.getUser();if(identityError)throw identityError;
 const {data:profile,error:profileError}=await owner.from('profiles').select('barberia_id').eq('id',identity.user.id).single();if(profileError)throw profileError;
 const shop=profile.barberia_id;
 let {data:services,error}=await owner.from('servicios').select('*').eq('barberia_id',shop).eq('activo',true);if(error)throw error;
 if(!services.length){const result=await owner.from('servicios').insert({barberia_id:shop,nombre:'Corte MERYO',precio:30,duracion_min:30,activo:true}).select('*').single();if(result.error)throw result.error;services=[result.data];}
 const h=await owner.from('horarios').select('dia_semana').eq('barberia_id',shop);if(h.error)throw h.error;
 for(let day=0;day<7;day++)if(!h.data.some(r=>r.dia_semana===day)){const r=await owner.from('horarios').insert({barberia_id:shop,dia_semana:day,hora_apertura:'09:00',hora_cierre:'19:00'});if(r.error)throw r.error;}
 return {owner,customer,shop,service:services[0].id,credentials,close:async()=>{await owner.auth.signOut({scope:'local'});await customer.auth.signOut({scope:'local'});}};
}
