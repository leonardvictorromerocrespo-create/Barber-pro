import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { DIAS, fechaHoraLima } from "../../lib/format";
import { Cargando, Mensaje, btnDanger, btnPrimary, card, inputClass } from "./ui";
import { readResult } from '../../lib/meryo-api';
import { savedOperation } from '../../lib/operations';

const ORDEN = [1, 2, 3, 4, 5, 6, 0];

function NuevoTramo({ dia, onAgregar }) {
  const [a, setA] = useState("09:00");
  const [c, setC] = useState("19:00");
  return (
    <div className="mt-2 flex flex-wrap items-end gap-2">
      <div><label className="block text-xs text-neutral-500" htmlFor={`a-${dia}`}>Abre</label><input id={`a-${dia}`} type="time" value={a} onChange={(e) => setA(e.target.value)} className={`${inputClass} !py-2`} /></div>
      <div><label className="block text-xs text-neutral-500" htmlFor={`c-${dia}`}>Cierra</label><input id={`c-${dia}`} type="time" value={c} onChange={(e) => setC(e.target.value)} className={`${inputClass} !py-2`} /></div>
      <button onClick={() => onAgregar(dia, a, c)} className={`${btnPrimary} !px-4 !py-2 text-sm`}>Agregar tramo</button>
    </div>
  );
}

export default function TabHorarios({ shop }) {
  const [horarios, setHorarios] = useState(null);
  const [bloqueos, setBloqueos] = useState([]);
  const [msg, setMsg] = useState(null);
  const [guardando,setGuardando]=useState(false);
  const [bl, setBl] = useState({ inicio: "", fin: "", motivo: "" });

  const cargar = useCallback(async () => {
    try {
      const [h,b]=await Promise.all([
        readResult(supabase.from('horarios').select('*').eq('barberia_id',shop.id).order('hora_apertura')),
        readResult(supabase.from('bloqueos').select('*').eq('barberia_id',shop.id).gt('fin',new Date().toISOString()).order('inicio')),
      ]);setHorarios(h);setBloqueos(b);
    }catch(e){setMsg({tipo:'error',texto:e.message});setHorarios([]);}
  }, [shop.id]);
  useEffect(() => { cargar(); }, [cargar]);
  async function mutate(operation,texto){
    if(guardando)return false;setGuardando(true);setMsg(null);
    try{await savedOperation(operation);setMsg({tipo:'ok',texto});await cargar();return true;}
    catch(e){setMsg({tipo:'error',texto:e.message});return false;}finally{setGuardando(false);}
  }

  async function agregar(dia, a, c) {
    setMsg(null);
    if (!a || !c || c <= a) return setMsg({ tipo: "error", texto: "La hora de cierre debe ser después de la apertura." });
    await mutate(()=>supabase.from('horarios').insert({barberia_id:shop.id,dia_semana:dia,hora_apertura:a,hora_cierre:c}).select('id').single(),'Horario guardado.');
  }

  async function quitar(id) {
    await mutate(()=>supabase.from('horarios').delete().eq('id',id).eq('barberia_id',shop.id).select('id').single(),'Horario eliminado.');
  }

  async function agregarBloqueo(e) {
    e.preventDefault();
    setMsg(null);
    if (!bl.inicio || !bl.fin || bl.fin <= bl.inicio) return setMsg({ tipo: "error", texto: "Elige un inicio y un fin válidos (el fin va después del inicio)." });
    // Peru no tiene horario de verano: siempre UTC-5
    if(await mutate(()=>supabase.from('bloqueos').insert({barberia_id:shop.id,inicio:`${bl.inicio}:00-05:00`,fin:`${bl.fin}:00-05:00`,motivo:bl.motivo.trim()||null}).select('id').single(),'Bloqueo guardado.'))setBl({inicio:'',fin:'',motivo:''});
  }

  async function quitarBloqueo(id) {
    await mutate(()=>supabase.from('bloqueos').delete().eq('id',id).eq('barberia_id',shop.id).select('id').single(),'Bloqueo eliminado.');
  }

  if (!horarios) return <Cargando />;

  return (
    <div className="space-y-8">
      <div aria-live="polite"><Mensaje tipo={msg?.tipo}>{msg?.texto}</Mensaje></div>
      <section aria-labelledby="h-sem">
        <h2 id="h-sem" className="text-xl font-bold">Horario semanal</h2>
        <p className="mb-4 text-sm text-neutral-400">Un día sin tramos aparece como cerrado. Puedes poner varios tramos (por ejemplo, mañana y tarde).</p>
        <div className="space-y-3">
          {ORDEN.map((d) => {
            const tramos = horarios.filter((h) => h.dia_semana === d);
            return (
              <div key={d} className={card}>
                <p className="font-semibold">{DIAS[d]}</p>
                {tramos.length === 0 ? <p className="text-sm text-neutral-500">Cerrado</p> : (
                  <ul className="mt-1 space-y-1">
                    {tramos.map((t) => (
                      <li key={t.id} className="flex items-center gap-3 text-sm">
                        <span>{t.hora_apertura.slice(0, 5)} a {t.hora_cierre.slice(0, 5)}</span>
                        <button onClick={() => quitar(t.id)} className={`${btnDanger} !px-3 !py-1 text-xs`} aria-label={`Quitar tramo de ${DIAS[d]}`}>Quitar</button>
                      </li>
                    ))}
                  </ul>
                )}
                <NuevoTramo dia={d} onAgregar={agregar} />
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="h-blq">
        <h2 id="h-blq" className="text-xl font-bold">Días libres y bloqueos</h2>
        <p className="mb-4 text-sm text-neutral-400">Bloquea vacaciones, feriados o un permiso. En ese rango nadie puede reservar.</p>
        <form onSubmit={agregarBloqueo} className={`${card} grid gap-3 sm:grid-cols-3`}>
          <div><label htmlFor="b-i" className="mb-1 block text-sm text-neutral-300">Desde</label><input id="b-i" type="datetime-local" value={bl.inicio} onChange={(e) => setBl((p) => ({ ...p, inicio: e.target.value }))} className={inputClass} /></div>
          <div><label htmlFor="b-f" className="mb-1 block text-sm text-neutral-300">Hasta</label><input id="b-f" type="datetime-local" value={bl.fin} onChange={(e) => setBl((p) => ({ ...p, fin: e.target.value }))} className={inputClass} /></div>
          <div><label htmlFor="b-m" className="mb-1 block text-sm text-neutral-300">Motivo (opcional)</label><input id="b-m" value={bl.motivo} onChange={(e) => setBl((p) => ({ ...p, motivo: e.target.value }))} className={inputClass} /></div>
          <div className="sm:col-span-3"><button type="submit" className={btnPrimary}>Bloquear</button></div>
        </form>
        {bloqueos.length > 0 && (
          <ul className="mt-4 divide-y divide-white/10 rounded-2xl border border-white/10 bg-neutral-900">
            {bloqueos.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                <span>{fechaHoraLima(b.inicio)} → {fechaHoraLima(b.fin)}{b.motivo ? ` · ${b.motivo}` : ""}</span>
                <button onClick={() => quitarBloqueo(b.id)} className={`${btnDanger} !px-3 !py-1 text-xs`}>Quitar</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
