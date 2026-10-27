// Navigation intent only. Authority continues to come from the verified profile and SQL.
const KEY='meryo-access-destination';
export function oauthFailure(location){
 const query=new URLSearchParams(location.search||''),hash=new URLSearchParams((location.hash||'').replace(/^#/,''));
 const code=query.get('error_code')||hash.get('error_code'),error=query.get('error')||hash.get('error');
 if(!error&&!code)return null;
 if(code==='bad_oauth_state')return 'El acceso con Google venció. Pulsa Continuar con Google para iniciar un acceso nuevo.';
 return (query.get('error_description')||hash.get('error_description')||'Google no completó el acceso. Puedes reintentar o usar correo y contraseña.').slice(0,300);
}
export function rememberAccess(storage,destination){
 storage.setItem(KEY,['admin','barber','shop-register','team-invite','notifications','my-bookings'].includes(destination)?destination:'client');
}
export function consumeAccess(storage){
 const value=storage.getItem(KEY);storage.removeItem(KEY);
 return ['admin','barber','shop-register','team-invite','notifications','my-bookings'].includes(value)?value:'client';
}
export function accessView(destination,role){
 return ['notifications','my-bookings'].includes(destination)?destination:destination==='team-invite'?'team-invite':destination==='admin'?'admin':['barber','shop-register'].includes(destination)?(role==='admin'?'admin':role==='barbero'?'shop-manage':'shop-register'):'client';
}
