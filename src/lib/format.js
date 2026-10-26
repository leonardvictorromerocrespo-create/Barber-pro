export const TZ = "America/Lima";

const fHora = new Intl.DateTimeFormat("es-PE", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
const fDia = new Intl.DateTimeFormat("es-PE", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
const fDiaLargo = new Intl.DateTimeFormat("es-PE", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const fISO = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export const horaLima = (iso) => fHora.format(new Date(iso));
export const diaLima = (iso) => fDia.format(new Date(iso));
export const diaLargoLima = (iso) => fDiaLargo.format(new Date(iso));
export const fechaHoraLima = (iso) => `${diaLima(iso)}, ${horaLima(iso)}`;

/** Fecha de hoy en Lima como YYYY-MM-DD */
export const hoyLima = () => fISO.format(new Date());
/** Fecha (YYYY-MM-DD) de un instante, en hora de Lima */
export const fechaLima = (iso) => fISO.format(new Date(iso));

export function sumarDias(fechaISO, n) {
  const d = new Date(`${fechaISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function listaDias(cantidad = 14) {
  const hoy = hoyLima();
  return Array.from({ length: cantidad }, (_, i) => sumarDias(hoy, i));
}

export function etiquetaDia(fechaISO) {
  return fDia.format(new Date(`${fechaISO}T12:00:00Z`)).replace(".", "");
}

export const soles = (n) => `S/ ${Number(n ?? 0).toFixed(2).replace(/\.00$/, "")}`;

export function distanciaKm(a, b) {
  const R = 6371;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export const ESTADOS = {
  solicitada: { texto: "Esperando respuesta", clase: "bg-amber-400/15 text-amber-300 border-amber-400/30" },
  aceptada: { texto: "Aceptada: falta pagar", clase: "bg-sky-400/15 text-sky-300 border-sky-400/30" },
  confirmada: { texto: "Confirmada", clase: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30" },
  completada: { texto: "Completada", clase: "bg-neutral-400/15 text-neutral-300 border-neutral-400/30" },
  rechazada: { texto: "Rechazada", clase: "bg-red-400/15 text-red-300 border-red-400/30" },
  expirada: { texto: "Expirada", clase: "bg-neutral-500/15 text-neutral-400 border-neutral-500/30" },
  cancelada_cliente: { texto: "Cancelada por el cliente", clase: "bg-neutral-500/15 text-neutral-400 border-neutral-500/30" },
  cancelada_barbero: { texto: "Cancelada por la barbería", clase: "bg-red-400/15 text-red-300 border-red-400/30" },
  no_asistio: { texto: "No asistió", clase: "bg-red-400/15 text-red-300 border-red-400/30" },
};

export const limpiarTelefono = (t) => String(t || "").replace(/[^0-9]/g, "");
export const linkWhatsApp = (tel, texto = "") => {
  const n = limpiarTelefono(tel);
  if (!n) return null;
  const full = n.startsWith("51") ? n : `51${n}`;
  return `https://wa.me/${full}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
};
