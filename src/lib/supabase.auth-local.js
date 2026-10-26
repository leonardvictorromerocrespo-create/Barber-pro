import {createClient} from '@supabase/supabase-js';
// Real SDK and real Auth/PostgREST, through a fixed same-origin loopback proxy.
if(window.location.hostname!=='127.0.0.1'||window.location.port!=='5178')throw Error('Auth de pruebas solo se sirve en 127.0.0.1:5178');
const anonKey=import.meta.env.VITE_MERYO_LOCAL_ANON_KEY;
if(!anonKey)throw Error('Falta la clave anon del servicio local; no hay fallback remoto');
export const supabase=createClient(`${window.location.origin}/__supabase`,anonKey,{
 auth:{storageKey:'meryo-real-local-auth',autoRefreshToken:true,persistSession:true,detectSessionInUrl:true},
});
