import {browserAuthLockOptions} from './auth-lock';
import { createLocalClient, isLoopbackHost } from "./local-client";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const local=typeof window!=="undefined"&&isLoopbackHost(window.location.hostname);
if(!local){
  if(!supabaseUrl||!supabaseKey)throw new Error('Falta configurar el Supabase del entorno de destino. No hay conexión automática a producción.');
  const target=new URL(supabaseUrl);
  if(target.protocol!=='https:'||target.username||target.password)throw new Error('El backend de destino debe usar HTTPS y no contener credenciales en la URL.');
}

export const supabase = local ? createLocalClient() : createClient(supabaseUrl, supabaseKey,{auth:{...browserAuthLockOptions(),flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
export const googleAuthEnabled=import.meta.env.VITE_MERYO_GOOGLE_ENABLED===true||import.meta.env.VITE_MERYO_GOOGLE_ENABLED==='true';
export const emailSignupEnabled=import.meta.env.VITE_MERYO_EMAIL_SIGNUP_ENABLED==='true';
