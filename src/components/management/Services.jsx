import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { soles } from "../../lib/format";
import { Cargando, Interruptor, Mensaje, Vacio, btnGhost, btnPrimary, card, inputClass } from "./ui";
import { readResult } from '../../lib/meryo-api';
import { savedOperation } from '../../lib/operations';

const VACIO = { id: null, nombre: "", descripcion: "", precio: "", duracion_min: 45, activo: true };

export default function TabServicios({ shop, onCambio }) {
  const [lista, setLista] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try { setLista(await readResult(supabase.from("servicios").select("id, nombre, descripcion, precio, duracion_min, activo").eq("barberia_id", shop.id).order("created_at"))); }
    catch(e) { setError(e.message); setLista([]); }
  }, [shop.id]);
  useEffect(() => { cargar(); }, [cargar]);

  async function guardar(e) {
    e.preventDefault();
    setError(""); setOk("");
    const precio = Number(form.precio);
    const dur = Number(form.duracion_min);
    if (form.nombre.trim().length < 2) return setError("Escribe el nombre del servicio.");
    if (!(precio > 0 && precio <= 1000)) return setError("El precio debe ser mayor a 0 y hasta S/ 1000.");
    if (!Number.isInteger(dur) || dur < 10 || dur > 240) return setError("La duración debe estar entre 10 y 240 minutos.");
    const fila = { nombre: form.nombre.trim(), descripcion: form.descripcion.trim() || null, precio, duracion_min: dur, activo: form.activo };
    setGuardando(true);
    try {
      await savedOperation(() => form.id
        ? supabase.from("servicios").update(fila).eq("id", form.id).eq('barberia_id',shop.id).select('id').single()
        : supabase.from("servicios").insert({ ...fila, barberia_id: shop.id }).select('id').single());
      setOk(form.id ? "Servicio actualizado." : "Servicio agregado.");setForm(null);await cargar();onCambio?.();
    } catch(e) { setError(e.message); } finally { setGuardando(false); }
  }

  if (!lista) return <Cargando />;
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-neutral-400">Los clientes ven y reservan solo los servicios activos. Los servicios con citas no se borran: se desactivan.</p>
        {!form && <button onClick={() => { setForm({ ...VACIO }); setOk(""); }} className={btnPrimary}>Agregar servicio</button>}
      </div>
      <Mensaje tipo="ok">{ok}</Mensaje>
      {!form && <Mensaje>{error}</Mensaje>}

      {form && (
        <form onSubmit={guardar} className={`${card} space-y-4`} noValidate>
          <h2 className="text-lg font-bold">{form.id ? "Editar servicio" : "Nuevo servicio"}</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-3"><label htmlFor="s-n" className="mb-1 block text-sm text-neutral-300">Nombre</label><input id="s-n" value={form.nombre} onChange={set("nombre")} maxLength={80} className={inputClass} placeholder="Ej: Fade + barba" /></div>
            <div><label htmlFor="s-p" className="mb-1 block text-sm text-neutral-300">Precio (S/)</label><input id="s-p" type="number" min="1" step="0.5" value={form.precio} onChange={set("precio")} className={inputClass} /></div>
            <div><label htmlFor="s-d" className="mb-1 block text-sm text-neutral-300">Duración (minutos)</label><input id="s-d" type="number" min="10" max="240" step="5" value={form.duracion_min} onChange={set("duracion_min")} className={inputClass} /></div>
            <div className="sm:col-span-3"><label htmlFor="s-ds" className="mb-1 block text-sm text-neutral-300">Descripción (opcional)</label><input id="s-ds" value={form.descripcion} onChange={set("descripcion")} maxLength={300} className={inputClass} /></div>
          </div>
          <Interruptor checked={form.activo} onChange={(v) => setForm((p) => ({ ...p, activo: v }))} label="Activo" ayuda="Si lo desactivas, los clientes ya no lo ven." />
          <Mensaje>{error}</Mensaje>
          <div className="flex gap-2">
            <button type="submit" disabled={guardando} className={btnPrimary}>{guardando ? "Guardando..." : "Guardar"}</button>
            <button type="button" onClick={() => { setForm(null); setError(""); }} className={btnGhost}>Cancelar</button>
          </div>
        </form>
      )}

      {lista.length === 0 ? <Vacio titulo="Aún no tienes servicios">Agrega al menos uno para que los clientes puedan reservar.</Vacio> : (
        <ul className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-neutral-900">
          {lista.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className={s.activo ? "" : "opacity-50"}>
                <p className="font-semibold">{s.nombre} {!s.activo && <span className="text-xs text-neutral-400">(desactivado)</span>}</p>
                <p className="text-sm text-neutral-400">{s.duracion_min} min · {soles(s.precio)}{s.descripcion ? ` · ${s.descripcion}` : ""}</p>
              </div>
              <button onClick={() => { setForm({ ...s, descripcion: s.descripcion || "" }); setOk(""); }} className={`${btnGhost} !px-4 !py-2 text-sm`}>Editar</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
