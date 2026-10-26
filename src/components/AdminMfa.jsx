import {useEffect,useState} from 'react';
export default function AdminMfa({client,onVerified,onBack}){
 const localEnvironment=typeof window!=='undefined'&&['127.0.0.1','localhost','::1'].includes(window.location.hostname);
 const [factors,setFactors]=useState([]),[factor,setFactor]=useState(''),[qr,setQr]=useState(''),[code,setCode]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;client.auth.mfa.listFactors().then(({data,error})=>{if(!active)return;if(error){setError(error.message);return;}const totp=(data.all||data.totp||[]).filter(f=>!f.factor_type||f.factor_type==='totp');setFactors(totp);setFactor(totp[0]?.id||'');});return()=>{active=false;};},[client]);
 async function enroll(){setBusy(true);setError('');try{const {data,error}=await client.auth.mfa.enroll({factorType:'totp',issuer:location.hostname==='127.0.0.1'?'MERYO Local':'MERYO',friendlyName:`MERYO ${new Date().toISOString()}`});if(error)throw error;setFactor(data.id);setQr(data.totp.qr_code);}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function verify(e){e.preventDefault();setBusy(true);setError('');try{const {error}=await client.auth.mfa.challengeAndVerify({factorId:factor,code});if(error)throw error;setCode('');setQr('');await onVerified();}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <div className="min-h-screen bg-neutral-950 p-8 text-white"><form onSubmit={verify} className="mx-auto max-w-md rounded-3xl border border-white/10 bg-neutral-900 p-8">
 <h1 className="text-2xl font-black">Seguridad MERYO · Authenticator</h1><p className="mt-3 text-neutral-400">Usa tu misma aplicación Authenticator. Añade una entrada independiente para MERYO; proteger tu cuenta no cambia tu rol. La administración exige además permiso administrativo y segundo factor.</p>
 <p className="mt-3 text-xs text-amber-300">{localEnvironment?'MERYO Local · solo pruebas':'MERYO público · entrada de Authenticator: MERYO'}</p>
 {error&&<p role="alert" className="mt-3 text-red-300">{error}</p>}
 {factors.length>0&&!qr&&<label className="mt-4 block">Authenticator<select value={factor} onChange={e=>setFactor(e.target.value)} className="mt-2 w-full rounded-xl bg-black p-3">{factors.map(f=><option key={f.id} value={f.id}>{f.friendly_name||'Authenticator MERYO'}</option>)}</select></label>}
 {!qr&&<button type="button" disabled={busy} onClick={enroll} className="mt-4 rounded-xl border border-amber-400 px-4 py-3">Añadir entrada MERYO en Authenticator</button>}
 {qr&&<div className="mt-4"><p>Escanea este QR desde tu Authenticator. No lo compartas.</p><img className="mt-3 bg-white p-3" alt="QR privado para configurar Authenticator MERYO" src={qr.startsWith('data:')?qr:`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr)}`}/></div>}
 {factor&&<><label className="mt-4 block">Código de 6 dígitos<input aria-label="Código Authenticator" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" required value={code} onChange={e=>setCode(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black p-3"/></label><button disabled={busy} className="mt-4 w-full rounded-xl bg-amber-400 p-3 font-bold text-black">Verificar segundo factor</button></>}
 <p className="mt-5 text-sm text-neutral-400">Si perdiste el celular, usa un segundo factor previamente registrado en otro dispositivo. Sin ese respaldo, la recuperación requiere verificación de identidad por el operador autorizado de Supabase, revocación de sesiones y nuevo enrolamiento. No existe código maestro ni acceso de emergencia en MERYO.</p>
 <button type="button" onClick={onBack} className="mt-4 text-sm underline">Volver</button>
 </form></div>;
}
