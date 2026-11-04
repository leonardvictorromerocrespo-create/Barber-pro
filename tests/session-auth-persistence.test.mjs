import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';

function token(exp,sub){
 const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
 return `${encode({alg:'HS256',typ:'JWT'})}.${encode({aud:'authenticated',sub,exp,role:'authenticated'})}.local-test-signature`;
}
class MemoryStorage{
 #items=new Map();
 getItem(key){return this.#items.get(key)??null;}
 setItem(key,value){this.#items.set(key,String(value));}
 removeItem(key){this.#items.delete(key);}
}

test('Supabase restores a browser-persisted session after client recreation and renews it',async()=>{
 const storage=new MemoryStorage(),uid='10000000-0000-4000-8000-000000000001',user={id:uid,aud:'authenticated',role:'authenticated',email:'session-test@example.invalid',app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
 let currentAccess=token(Math.floor(Date.now()/1000)+3600,uid),refreshCount=0;
 const fetch=async(input,init={})=>{
  const url=new URL(typeof input==='string'?input:input.url);
  if(url.pathname.endsWith('/user'))return Response.json(user);
  if(url.pathname.endsWith('/token')){refreshCount++;currentAccess=token(Math.floor(Date.now()/1000)+3600,uid);return Response.json({access_token:currentAccess,token_type:'bearer',expires_in:3600,refresh_token:`refresh-${refreshCount}`,user});}
  if(url.pathname.endsWith('/logout'))return new Response(null,{status:204});
  throw new Error(`Unexpected local Auth request: ${url.pathname} ${init.method||'GET'}`);
 };
 const makeClient=()=>createClient('https://meryo-session-test.example.invalid','test-publishable-key',{auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false,storage},global:{fetch}});
 const first=makeClient();
 const initial=await first.auth.setSession({access_token:currentAccess,refresh_token:'refresh-initial'});
 assert.ifError(initial.error);
 const reopened=makeClient();
 const restored=await reopened.auth.getSession();
 assert.ifError(restored.error);
 assert.equal(restored.data.session.user.id,uid);
 assert.equal((await reopened.auth.getUser()).data.user.id,uid);
 const refreshed=await reopened.auth.refreshSession();
 assert.ifError(refreshed.error);
 assert.equal(refreshCount,1);
 const reopenedAgain=makeClient();
 const afterRefresh=await reopenedAgain.auth.getSession();
 assert.equal(afterRefresh.data.session.access_token,currentAccess);
 assert.equal(afterRefresh.data.session.user.id,uid);
 const appSource=await fs.readFile(new URL('../src/lib/supabase.js',import.meta.url),'utf8');
 const bookingSource=await fs.readFile(new URL('../src/App.jsx',import.meta.url),'utf8');
 const identitySource=await fs.readFile(new URL('../src/lib/useIdentity.js',import.meta.url),'utf8');
 const reservationsSource=await fs.readFile(new URL('../src/components/Reservations.jsx',import.meta.url),'utf8');
 assert.match(appSource,/persistSession:true/);
 assert.match(appSource,/autoRefreshToken:true/);
 assert.match(bookingSource,/if\(identity\.loading\).*Restaurando tu sesión/s);
 assert.match(bookingSource,/!identity\.loading && identity\.profile\?\.rol === 'cliente'/);
 assert.match(identitySource,/event==='SIGNED_OUT'\|\|!session/);
 assert.match(identitySource,/current\?\.id===session\.user\?\.id\?current:null/);
 assert.match(reservationsSource,/if\(identityLoading\)return/);
 assert.match(reservationsSource,/if\(identityError\)return/);
 assert.match(bookingSource,/identityError=\{identity\.error\}/);
});
