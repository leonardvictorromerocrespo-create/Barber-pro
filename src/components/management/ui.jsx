import { ESTADOS } from "../../lib/format";

export const inputClass =
  "w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder-neutral-500 outline-none focus:border-amber-400";
export const btnPrimary =
  "rounded-xl bg-amber-400 px-5 py-3 font-bold text-black hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50";
export const btnGhost =
  "rounded-xl border border-white/20 px-5 py-3 font-semibold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50";
export const btnDanger =
  "rounded-xl border border-red-500/40 px-5 py-3 font-semibold text-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50";
export const card = "rounded-2xl border border-white/10 bg-neutral-900 p-5";

export function Campo({ id, label, children, ayuda }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-neutral-300">
        {label}
      </label>
      {children}
      {ayuda && <p className="mt-1 text-xs text-neutral-500">{ayuda}</p>}
    </div>
  );
}

export function Mensaje({ tipo = "error", children }) {
  if (!children) return null;
  const clases = {
    error: "border-red-500/40 bg-red-500/10 text-red-300",
    ok: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    info: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  };
  return (
    <p role={tipo === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${clases[tipo]}`}>
      {children}
    </p>
  );
}

export function EstadoBadge({ estado }) {
  const e = ESTADOS[estado] || { texto: estado, clase: "bg-neutral-500/15 text-neutral-300 border-neutral-500/30" };
  return <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${e.clase}`}>{e.texto}</span>;
}

export function Estrellas({ valor, tamano = "text-base" }) {
  const n = Math.round(Number(valor) || 0);
  return (
    <span className={`${tamano} text-amber-400`} aria-label={`${valor} de 5 estrellas`}>
      {"★".repeat(n)}
      <span className="text-neutral-700">{"★".repeat(5 - n)}</span>
    </span>
  );
}

export function Cargando({ texto = "Cargando..." }) {
  return <p className="py-16 text-center text-neutral-400">{texto}</p>;
}

export function Vacio({ titulo, children }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
      <p className="font-semibold text-white">{titulo}</p>
      {children && <div className="mt-2 text-sm text-neutral-400">{children}</div>}
    </div>
  );
}

export function Interruptor({ checked, onChange, label, ayuda }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-5 w-5 accent-amber-400" />
      <span>
        <span className="block font-medium text-white">{label}</span>
        {ayuda && <span className="block text-sm text-neutral-400">{ayuda}</span>}
      </span>
    </label>
  );
}
