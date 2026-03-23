import { supabase } from "./lib/supabase";
import { useEffect, useMemo, useState } from "react";

const pointerClass = "cursor-pointer";

const INITIAL_SHOPS = [
  {
    id: 1,
    name: "Elite Fade Studio",
    district: "Ate",
    distance: "0.8 km",
    rating: 4.9,
    reviews: 324,
    basePrice: 30,
    originalBasePrice: 35,
    discount: "15% OFF",
    image:
      "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=1200&q=80",
    tags: ["Top", "Rápido", "Cerca de ti"],
    about:
      "Somos Elite Fade Studio. Nos dedicamos a cortes modernos, fades, perfilado de barba y asesoría de imagen. Llevamos varios años atendiendo clientes que buscan un acabado limpio, profesional y actual.",
    introVideoTitle: "Presentación del barbero",
    introVideoNote:
      "Aquí se mostrará un video corto tipo Facebook donde el barbero se presenta, cuenta su experiencia y explica su estilo de trabajo.",
    cutsVideoTitle: "Video de cortes y servicios",
    cutsVideoNote:
      "Aquí se mostrará un video con cortes reales, fades, perfilado de barba y resultados de clientes.",
    services: [
      { id: "classic", name: "Corte clásico", price: 30, duration: "45 min" },
      { id: "fade", name: "Fade", price: 35, duration: "50 min" },
      { id: "beard", name: "Corte + barba", price: 45, duration: "60 min" },
      { id: "crop", name: "French crop", price: 36, duration: "50 min" },
      { id: "pompadour", name: "Pompadour", price: 40, duration: "60 min" },
      { id: "undercut", name: "Undercut", price: 38, duration: "55 min" },
    ],
    calendar: {
      "2026-03-15": [
        { time: "10:00", occupied: false },
        { time: "11:00", occupied: true },
        { time: "12:00", occupied: false },
        { time: "13:00", occupied: true },
        { time: "14:00", occupied: false },
        { time: "15:00", occupied: false },
        { time: "16:00", occupied: false },
        { time: "17:00", occupied: false },
        { time: "18:00", occupied: false },
      ],
      "2026-03-16": [
        { time: "09:00", occupied: false },
        { time: "10:00", occupied: false },
        { time: "11:00", occupied: false },
        { time: "12:00", occupied: true },
        { time: "13:00", occupied: false },
        { time: "14:00", occupied: false },
        { time: "15:00", occupied: false },
        { time: "16:00", occupied: false },
      ],
      "2026-03-17": [
        { time: "10:00", occupied: true },
        { time: "11:00", occupied: false },
        { time: "12:00", occupied: false },
        { time: "13:00", occupied: false },
        { time: "14:00", occupied: false },
        { time: "15:00", occupied: false },
        { time: "16:00", occupied: false },
        { time: "17:00", occupied: true },
      ],
    },
  },
  {
    id: 2,
    name: "Black Gold Barber",
    district: "Santa Anita",
    distance: "1.6 km",
    rating: 4.8,
    reviews: 241,
    basePrice: 32,
    originalBasePrice: 35,
    discount: "10% OFF",
    image:
      "https://images.unsplash.com/photo-1517832606299-7ae9b720a186?auto=format&fit=crop&w=1200&q=80",
    tags: ["Premium", "Barba", "Popular"],
    about:
      "Somos Black Gold Barber. Nos especializamos en corte premium, barba, line up y asesoría personalizada. Nuestro enfoque es que cada cliente salga con una imagen más elegante y segura.",
    introVideoTitle: "Presentación del barbero",
    introVideoNote:
      "Aquí se mostrará un video del barbero contando quién es, cuántos años lleva cortando y qué servicios ofrece.",
    cutsVideoTitle: "Video de trabajos realizados",
    cutsVideoNote:
      "Aquí se mostrará un video con cortes, barba, definición y estilos realizados en la barbería.",
    services: [
      { id: "premium", name: "Corte premium", price: 32, duration: "45 min" },
      { id: "barba", name: "Perfilado de barba", price: 20, duration: "25 min" },
      { id: "combo", name: "Corte + barba", price: 48, duration: "65 min" },
      { id: "buzz", name: "Buzz cut", price: 26, duration: "30 min" },
      { id: "mullet", name: "Mullet moderno", price: 42, duration: "60 min" },
      { id: "lineup", name: "Line up", price: 22, duration: "20 min" },
    ],
    calendar: {
      "2026-03-15": [
        { time: "09:00", occupied: false },
        { time: "10:00", occupied: false },
        { time: "11:00", occupied: false },
        { time: "12:00", occupied: false },
        { time: "13:00", occupied: false },
        { time: "14:00", occupied: true },
        { time: "15:00", occupied: false },
        { time: "16:00", occupied: false },
        { time: "17:00", occupied: false },
        { time: "18:00", occupied: true },
      ],
      "2026-03-16": [
        { time: "10:00", occupied: false },
        { time: "11:00", occupied: true },
        { time: "12:00", occupied: false },
        { time: "13:00", occupied: false },
        { time: "14:00", occupied: false },
        { time: "15:00", occupied: false },
        { time: "16:00", occupied: false },
      ],
      "2026-03-17": [
        { time: "09:00", occupied: false },
        { time: "10:00", occupied: false },
        { time: "11:00", occupied: false },
        { time: "12:00", occupied: true },
        { time: "13:00", occupied: false },
        { time: "14:00", occupied: false },
        { time: "15:00", occupied: false },
        { time: "16:00", occupied: false },
      ],
    },
  },
  {
    id: 3,
    name: "Urban King Barbershop",
    district: "La Molina",
    distance: "2.4 km",
    rating: 4.7,
    reviews: 198,
    basePrice: 28,
    originalBasePrice: 35,
    discount: "20% OFF",
    image:
      "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=80",
    tags: ["Oferta", "Fade", "Económico"],
    about:
      "Somos Urban King Barbershop. Realizamos cortes modernos, taper fades, diseños, cejas y cambios de look. Buscamos un servicio rápido, limpio y con buena atención.",
    introVideoTitle: "Presentación del barbero",
    introVideoNote:
      "Aquí se mostrará un video donde el barbero se presenta y comenta qué tipo de cortes domina mejor.",
    cutsVideoTitle: "Video de cortes y resultados",
    cutsVideoNote:
      "Aquí se mostrará un video con cambios de look, diseños y servicios realizados a clientes.",
    services: [
      { id: "express", name: "Corte express", price: 28, duration: "30 min" },
      { id: "skin", name: "Skin fade", price: 34, duration: "45 min" },
      { id: "cejas", name: "Corte + cejas", price: 38, duration: "50 min" },
      { id: "taper", name: "Taper fade", price: 33, duration: "45 min" },
      { id: "kids", name: "Corte infantil", price: 24, duration: "30 min" },
      { id: "design", name: "Corte con diseño", price: 44, duration: "65 min" },
    ],
    calendar: {
      "2026-03-15": [
        { time: "10:00", occupied: false },
        { time: "11:00", occupied: false },
        { time: "12:00", occupied: false },
        { time: "13:00", occupied: true },
        { time: "14:00", occupied: false },
        { time: "15:00", occupied: false },
        { time: "16:00", occupied: false },
        { time: "17:00", occupied: false },
        { time: "18:00", occupied: true },
      ],
      "2026-03-16": [
        { time: "10:00", occupied: false },
        { time: "11:00", occupied: false },
        { time: "12:00", occupied: false },
        { time: "13:00", occupied: true },
        { time: "14:00", occupied: false },
        { time: "15:00", occupied: false },
        { time: "16:00", occupied: false },
        { time: "17:00", occupied: false },
      ],
      "2026-03-17": [
        { time: "09:00", occupied: false },
        { time: "10:00", occupied: false },
        { time: "11:00", occupied: false },
        { time: "12:00", occupied: false },
        { time: "13:00", occupied: false },
        { time: "14:00", occupied: true },
        { time: "15:00", occupied: false },
        { time: "16:00", occupied: false },
      ],
    },
  },
];

const today = new Date();

const formatDate = (date) => {
  return date.toISOString().split("T")[0];
};

const AVAILABLE_DATES = [
  formatDate(today),
  formatDate(new Date(today.getTime() + 24 * 60 * 60 * 1000)),
  formatDate(new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000)),
];
const HERO_IMAGES = [
  "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1517832606299-7ae9b720a186?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1600&q=80",
];

function ClientHero({ heroIndex, setHeroIndex, setView }) {
  return (
    <>
      <div className="mb-10 overflow-hidden rounded-3xl border border-white/10 bg-black">
        <div className="relative h-72 w-full">
          <div
            className="absolute inset-0 bg-cover bg-center transition-all duration-1000"
            style={{ backgroundImage: `url(${HERO_IMAGES[heroIndex]})` }}
          />
          <div className="absolute inset-0 bg-black/60" />
          <div className="absolute bottom-4 right-4 z-20 flex gap-2">
            {HERO_IMAGES.map((_, index) => (
              <button
                key={index}
                onClick={() => setHeroIndex(index)}
                className={`h-2.5 w-8 rounded-full transition ${pointerClass} ${
                  heroIndex === index ? "bg-amber-400" : "bg-white/40"
                }`}
              />
            ))}
          </div>
          <div className="relative z-10 flex h-full flex-col justify-center px-8">
            <h1 className="text-3xl font-extrabold tracking-wide text-white md:text-5xl">
              EL ESTILO NO SE IMPROVISA
            </h1>
            <p className="mt-3 max-w-xl text-sm text-neutral-300 md:text-base">
              Descubre barberos reales cerca de ti. Mira sus trabajos, conoce su estilo y reserva tu cita en segundos.
            </p>
            <div className="mt-4 text-xs uppercase tracking-widest text-amber-400">
              Barber Pro • Reserva inteligente
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setView("barber")}
                className={`rounded-xl border border-white/20 bg-black/30 px-4 py-2 text-sm font-bold ${pointerClass}`}
              >
                Soy barbero
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-xl font-bold text-white">⭐ Barberos más reservados esta semana</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {INITIAL_SHOPS.slice(0, 3).map((shop) => (
            <div key={shop.id} className="rounded-2xl border border-white/10 bg-neutral-900 p-4">
              <p className="font-bold text-white">{shop.name}</p>
              <p className="text-sm text-neutral-400">{shop.district}</p>
              <p className="mt-2 text-sm text-amber-400">⭐ {shop.rating} • {shop.reviews} reservas</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function ProfileModal({ selectedShop, onClose, onReserve }) {
  if (!selectedShop) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-[2rem] border border-white/10 bg-neutral-950 p-6 text-white shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-amber-300">Perfil de barbería</p>
            <h3 className="mt-2 text-3xl font-black">{selectedShop.name}</h3>
            <p className="mt-2 text-neutral-400">
              Aquí el cliente solo ve la información del barbero: presentación, experiencia, videos, reseñas y servicios.
            </p>
          </div>
          <button onClick={onClose} className={`rounded-xl border border-white/10 px-4 py-2 text-sm ${pointerClass}`}>
            Cerrar
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h4 className="text-xl font-bold">Perfil del barbero</h4>
            <div className="mt-2 text-xs text-neutral-500">Perfil tipo red social del barbero</div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-5 text-sm text-neutral-300">
              <p className="leading-6 text-neutral-400">{selectedShop.about}</p>
              <p className="mt-4 font-semibold text-amber-400">Experiencia</p>
              <p className="mt-1">8+ años realizando cortes modernos, fades y perfilado de barba.</p>
              <p className="mt-4 font-semibold text-amber-400">Especialidades</p>
              <p className="mt-1">Fade, Taper, Diseños, Barba, Estilos urbanos.</p>
              <p className="mt-4 font-semibold text-amber-400">Mensaje del barbero</p>
              <p className="mt-1">Mi objetivo es que cada cliente salga con un estilo limpio, moderno y que combine con su personalidad.</p>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="font-bold text-white">{selectedShop.introVideoTitle}</p>
              <div className="mt-3 flex h-40 items-center justify-center rounded-2xl bg-neutral-800 px-4 text-center text-sm text-neutral-400">
                {selectedShop.introVideoNote}
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-xl font-bold">Videos y portafolio de cortes</h4>
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="font-bold text-white">{selectedShop.cutsVideoTitle}</p>
              <div className="mt-3 flex h-40 items-center justify-center rounded-2xl bg-neutral-800 px-4 text-center text-sm text-neutral-400">
                {selectedShop.cutsVideoNote}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="font-bold text-white">Servicios disponibles</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {selectedShop.services.map((service) => (
                  <div key={service.id} className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm">
                    <p className="font-semibold text-white">{service.name}</p>
                    <p className="mt-1 text-neutral-400">{service.duration}</p>
                    <p className="mt-2 text-amber-400">S/ {service.price}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-6">
              <p className="text-lg font-bold text-white">Reseñas de clientes</p>
              <p className="mt-2 text-neutral-400">⭐ {selectedShop.rating} basado en {selectedShop.reviews} opiniones</p>
              <div className="mt-4 space-y-4 text-sm">
                <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                  <p className="text-amber-400">★★★★★</p>
                  <p className="mt-1 text-neutral-300">Excelente atención y corte muy limpio. Regresaré sin duda.</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                  <p className="text-amber-400">★★★★★</p>
                  <p className="mt-1 text-neutral-300">El fade quedó perfecto y el trato fue muy profesional.</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                  <p className="text-amber-400">★★★★☆</p>
                  <p className="mt-1 text-neutral-300">Buen servicio y ambiente cómodo en la barbería.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button onClick={onReserve} className={`rounded-2xl bg-amber-400 px-6 py-3 font-bold text-black ${pointerClass}`}>
            Reservar cita
          </button>
        </div>
      </div>
    </div>
  );
}

function BookingModal({
  selectedShop,
  selectedService,
  setSelectedService,
  selectedDate,
  setSelectedDate,
  selectedTime,
  setSelectedTime,
  customerInfo,
  setCustomerInfo,
  customRequest,
  setCustomRequest,
  customExtra,
  setCustomExtra,
  paymentMethod,
  setPaymentMethod,
  activeSlots,
  finalPrice,
  paymentConfirmed,
  confirmPayment,
  closeBookingModal,
}) {
  if (!selectedShop) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-[2rem] border border-white/10 bg-neutral-950 p-6 text-white shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-amber-300">Reserva tu cita</p>
            <h3 className="mt-2 text-3xl font-black">{selectedShop.name}</h3>
            <p className="mt-2 text-neutral-400">
              Elige el corte, luego la fecha, la hora, agrega un pedido especial si quieres y confirma el pago.
            </p>
          </div>
          <button onClick={closeBookingModal} className={`rounded-xl border border-white/10 px-4 py-2 text-sm ${pointerClass}`}>
            Cerrar
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-neutral-900 p-5">
              <h4 className="text-xl font-bold">1. Elige tu corte</h4>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {selectedShop.services.map((service) => (
                  <button
                    key={service.id}
                    onClick={() => setSelectedService(service)}
                    className={`rounded-2xl border p-4 text-left transition ${pointerClass} ${
                      selectedService?.id === service.id
                        ? "border-amber-400 bg-amber-400 text-black"
                        : "border-white/10 bg-black/20 text-white"
                    }`}
                  >
                    <p className="font-bold">{service.name}</p>
                    <p className={`mt-1 text-sm ${selectedService?.id === service.id ? "text-black/80" : "text-neutral-400"}`}>
                      {service.duration}
                    </p>
                    <p className="mt-3 text-lg font-black">S/ {service.price}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-neutral-900 p-5">
              <h4 className="text-xl font-bold">2. Elige la fecha</h4>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {AVAILABLE_DATES.map((date) => (
                  <button
                    key={date}
                    onClick={() => {
                      setSelectedDate(date);
                      setSelectedTime("");
                    }}
                    className={`rounded-2xl border px-4 py-4 text-sm font-semibold ${pointerClass} ${
                      selectedDate === date
                        ? "border-amber-400 bg-amber-400 text-black"
                        : "border-white/10 bg-black/20 text-white"
                    }`}
                  >
                    {date}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-neutral-900 p-5">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-xl font-bold">3. Elige la hora (bloques de 1 hora)</h4>
                <div className="flex items-center gap-4 text-xs text-neutral-400">
                  <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-white/70" /> Disponible</span>
                  <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-red-500" /> Ocupada</span>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3 md:grid-cols-4">
                {activeSlots.map((slot) => (
                  <button
                    key={`${selectedDate}-${slot.time}`}
                    disabled={slot.occupied}
                    onClick={() => setSelectedTime(slot.time)}
                    className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                      slot.occupied
                        ? "cursor-not-allowed border-red-500/40 bg-red-500 text-white opacity-80"
                        : `${pointerClass} ${selectedTime === slot.time ? "border-amber-400 bg-amber-400 text-black" : "border-white/10 bg-black/20 text-white hover:border-amber-400/50"}`
                    }`}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-neutral-900 p-5">
              <h4 className="text-xl font-bold">4. Datos del cliente</h4>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <input
                  value={customerInfo.name}
                  onChange={(e) => setCustomerInfo((prev) => ({ ...prev, name: e.target.value }))}
                  className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
                  placeholder="Tu nombre"
                />
                <input
                  value={customerInfo.phone}
                  onChange={(e) => setCustomerInfo((prev) => ({ ...prev, phone: e.target.value }))}
                  className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
                  placeholder="Tu celular"
                />
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-neutral-900 p-5">
              <h4 className="text-xl font-bold">5. Pedido especial (opcional)</h4>
              <p className="mt-2 text-sm text-neutral-400">Si deseas un estilo distinto puedes explicarlo al barbero.</p>
              <textarea
                value={customRequest}
                onChange={(e) => setCustomRequest(e.target.value)}
                placeholder="Ej: degradado alto con línea al costado, barba marcada o cejas suaves"
                className="mt-3 min-h-[110px] w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none"
              />
              <p className="mt-4 text-sm font-semibold text-neutral-300">Costo adicional por personalización</p>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {[0, 5, 10, 15].map((extra) => (
                  <button
                    key={extra}
                    onClick={() => setCustomExtra(extra)}
                    className={`rounded-xl border px-3 py-2 text-sm ${pointerClass} ${
                      customExtra === extra
                        ? "border-amber-400 bg-amber-400 text-black"
                        : "border-white/10 bg-black/20 text-white"
                    }`}
                  >
                    {extra === 0 ? "Sin extra" : `+ S/ ${extra}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-neutral-900 p-5">
              <h4 className="text-xl font-bold">6. Método de pago</h4>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {["Tarjeta", "Yape", "Plin"].map((method) => (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    className={`rounded-2xl border px-4 py-4 text-sm font-semibold transition ${pointerClass} ${
                      paymentMethod === method
                        ? "border-amber-400 bg-amber-400 text-black"
                        : "border-white/10 bg-black/20 text-white"
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5">
            <p className="text-sm uppercase tracking-[0.2em] text-amber-300">Resumen</p>
            <h4 className="mt-2 text-2xl font-black">{selectedShop.name}</h4>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between"><span>Cliente</span><span>{customerInfo.name || "-"}</span></div>
              <div className="flex justify-between"><span>Servicio</span><span>{selectedService?.name || "-"}</span></div>
              <div className="flex justify-between"><span>Fecha</span><span>{selectedDate}</span></div>
              <div className="flex justify-between"><span>Hora</span><span>{selectedTime || "Selecciona una hora"}</span></div>
              <div className="flex justify-between"><span>Pago</span><span>{paymentMethod}</span></div>
              <div className="flex justify-between"><span>Pedido especial</span><span className="max-w-[170px] text-right">{customRequest || "No"}</span></div>
              <div className="flex justify-between"><span>Extra</span><span>S/ {customExtra}</span></div>
              <div className="flex justify-between"><span>Precio original</span><span className="line-through text-neutral-500">S/ {(selectedService?.price || selectedShop.originalBasePrice) + 5}</span></div>
              <div className="flex justify-between text-lg font-black"><span>Total</span><span className="text-amber-300">S/ {finalPrice}</span></div>
            </div>
            <button
              onClick={confirmPayment}
              disabled={!selectedTime || !customerInfo.name.trim() || !customerInfo.phone.trim() || paymentConfirmed}
              className={`mt-6 w-full rounded-xl py-3 font-bold ${
                selectedTime && customerInfo.name.trim() && customerInfo.phone.trim() && !paymentConfirmed
                  ? `${pointerClass} bg-amber-400 text-black`
                  : "cursor-not-allowed bg-neutral-700 text-neutral-400"
              }`}
            >
              {paymentConfirmed ? "Pago confirmado" : "Confirmar pago"}
            </button>
            {paymentConfirmed && (
              <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
                Reserva confirmada para {selectedDate} a las {selectedTime}. La hora quedó bloqueada, el barbero recibió la reserva y también verá el pedido especial.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BarberProApp() {
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [view, setView] = useState("landing");
  const [adminAccess, setAdminAccess] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [shops, setShops] = useState([]);
  const [allBarbers, setAllBarbers] = useState([]);
  const COMISION = 5;
  const [affiliateForm, setAffiliateForm] = useState({
    nombre: "",
    distrito: "",
    whatsapp: "",
    correo: "",
    direccion: "",
  });
  const [selectedShop, setSelectedShop] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState(AVAILABLE_DATES[0]);
  const [selectedTime, setSelectedTime] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Tarjeta");
  const [showAffiliateForm, setShowAffiliateForm] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [barberLoggedIn, setBarberLoggedIn] = useState(false);
  const [barberLogin, setBarberLogin] = useState({ email: "", password: "" });
  const [notification, setNotification] = useState(null);
  const [customRequest, setCustomRequest] = useState("");
  const [customExtra, setCustomExtra] = useState(0);
  const [customerInfo, setCustomerInfo] = useState({ name: "", phone: "" });
  const [heroIndex, setHeroIndex] = useState(0);
  const [customerHistory, setCustomerHistory] = useState([
    {
      id: 1,
      shopName: "Elite Fade Studio",
      service: "Corte clásico",
      date: "2026-03-14",
      time: "6:00 pm",
      price: 30,
      rating: 5,
      customRequest: "Sin pedido especial",
    },
    {
      id: 2,
      shopName: "Black Gold Barber",
      service: "Corte + barba",
      date: "2026-03-10",
      time: "4:30 pm",
      price: 48,
      rating: 4,
      customRequest: "Barba marcada",
    },
  ]);
  const [barberAppointments, setBarberAppointments] = useState([
    {
      time: "3:30 pm",
      service: "Corte",
      client: "Luis",
      shopId: 1,
      date: "2026-03-15",
      customRequest: "Sin pedido especial",
      total: 30,
    },
    {
      time: "4:10 pm",
      service: "Corte + barba",
      client: "Pedro",
      shopId: 1,
      date: "2026-03-15",
      customRequest: "Barba bien definida",
      total: 45,
    },
    {
      time: "5:00 pm",
      service: "Fade",
      client: "Carlos",
      shopId: 1,
      date: "2026-03-15",
      customRequest: "Sin pedido especial",
      total: 35,
    },
  ]);

  const cargarReservas = async () => {
  const { data, error } = await supabase
    .from("reservas")
    .select("*");

  if (error) {
    console.log("ERROR RESERVAS:", error);
    return [];
  }

  return data || [];
};

const cargarBarberiasActivas = async () => {
  const reservas = await cargarReservas();

  const { data, error } = await supabase
    .from("barberias")
    .select("*")
    .eq("verificada", true);

  if (error) {
    console.log("ERROR:", error);
    return;
  }

  const formatted = data.map((item) => ({
    id: item.id,
    name: item.nombre,
    district: item.distrito,
    distance: "Cerca de ti",
    rating: item.rating ?? 5,
    reviews: item.total_resenas ?? 0,
    basePrice: item.precio_desde ?? 25,
    originalBasePrice: (item.precio_desde ?? 25) + 5,
    discount: "Nuevo",
    image:
      item.imagen_url ||
      "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=1200&q=80",
    tags: ["Nuevo"],
    about: item.descripcion || "",
    introVideoTitle: "",
    introVideoNote: "",
    cutsVideoTitle: "",
    cutsVideoNote: "",
    services: [
  { id: "clasico", name: "Corte clásico", price: 25, duration: "45 min" },
  { id: "fade", name: "Fade", price: 30, duration: "50 min" },
  { id: "barba", name: "Corte + barba", price: 40, duration: "60 min" },
],
    calendar: {
  [AVAILABLE_DATES[0]]: [
    "10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"
  ].map((time) => ({
    time,
    occupied: reservas.some(
      (r) =>
        String(r.barberia_id) === String(item.id) &&
        r.fecha === AVAILABLE_DATES[0] &&
        r.hora === time
    ),
  })),

  [AVAILABLE_DATES[1]]: [
    "10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"
  ].map((time) => ({
    time,
    occupied: reservas.some(
      (r) =>
        String(r.barberia_id) === String(item.id) &&
        r.fecha === AVAILABLE_DATES[1] &&
        r.hora === time
    ),
  })),

  [AVAILABLE_DATES[2]]: [
    "10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"
  ].map((time) => ({
    time,
    occupied: reservas.some(
      (r) =>
        String(r.barberia_id) === String(item.id) &&
        r.fecha === AVAILABLE_DATES[2] &&
        r.hora === time
    ),
  })),
},
  }));

  setShops(formatted);
};

useEffect(() => {
  cargarBarberiasActivas();
}, []);
useEffect(() => {
  async function cargarTodas() {
    const { data, error } = await supabase
      .from("barberias")
      .select("*");

    if (error) {
      console.log(error);
      return;
    }

    setAllBarbers(data);
  }

  cargarTodas();
}, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 6000);

    return () => clearInterval(timer);
  }, []);

  const ranking = useMemo(
    () => [...shops].sort((a, b) => b.rating * 100 + b.reviews - (a.rating * 100 + a.reviews)),
    [shops]
  );

  const handleAffiliateSubmit = async () => {
    console.log("FORM DATA:", affiliateForm);

    const { nombre, distrito, correo, direccion } = affiliateForm;

    if (!nombre || !distrito || !correo || !direccion) {
      alert("Completa los campos obligatorios");
      return;
    }

    const { data, error } = await supabase
      .from("barberias")
      .insert([
        {
          nombre,
          distrito,
          direccion,
          descripcion: "Barbería registrada",
          imagen_url:
            "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=1200&q=80",
          rating: 5,
          total_resenas: 0,
          precio_desde: 25,
        },
      ])
      .select();

    console.log("DATA INSERT:", data);
    console.log("ERROR INSERT:", error);

    if (error) {
      alert("Error al guardar: " + error.message);
      return;
    }

    const newShop = {
      id: data[0].id,
      name: data[0].nombre,
      district: data[0].distrito,
      distance: "Cerca de ti",
      rating: data[0].rating,
      reviews: data[0].total_resenas,
      basePrice: data[0].precio_desde,
      originalBasePrice: data[0].precio_desde + 5,
      discount: "Nuevo",
      image: data[0].imagen_url,
      tags: ["Nuevo"],
      about: data[0].descripcion,
      services: [],
      calendar: {
        "2026-03-15": [],
        "2026-03-16": [],
        "2026-03-17": [],
      },
    };

    setShops((prev) => [newShop, ...prev]);
setShowAffiliateForm(false);

    setAffiliateForm({
      nombre: "",
      distrito: "",
      whatsapp: "",
      correo: "",
      direccion: "",
    });

    alert("Barbería registrada correctamente");
  };

  const enableLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(() => setLocationEnabled(true));
    }
  };

  const openProfileModal = (shop) => {
    setSelectedShop(shop);
    setShowProfileModal(true);
  };

  const closeProfileModal = () => setShowProfileModal(false);

  const openBookingModal = (shop) => {
    setSelectedShop(shop);
    setSelectedService(shop.services[0]);
    setSelectedDate(AVAILABLE_DATES[0]);
    setSelectedTime("");
    setPaymentMethod("Tarjeta");
    setCustomRequest("");
    setCustomExtra(0);
    setCustomerInfo({ name: "", phone: "" });
    setPaymentConfirmed(false);
    setShowBookingModal(true);
  };

  const closeBookingModal = () => {
    setShowBookingModal(false);
    setSelectedTime("");
    setPaymentConfirmed(false);
  };

  const confirmPayment = async () => {
  if (
    !selectedShop ||
    !selectedService ||
    !selectedTime ||
    !customerInfo.name.trim() ||
    !customerInfo.phone.trim()
  ) {
    return;
  }

  // 🔥 GUARDAR EN SUPABASE
  const { error } = await supabase.from("reservas").insert([
  {
    shop_id: selectedShop.id,
    cliente: customerInfo.name,
    servicio: selectedService.name,
    fecha: selectedDate,
    hora: selectedTime,
    pedido: customRequest || "Sin pedido especial",
    total: selectedService.price + customExtra,

    estado: "pendiente"
  },
]);

  if (error) {
    alert("Error al guardar reserva: " + error.message);
    return;
  }

  setShops((prev) =>
    prev.map((shop) => {
      if (shop.id !== selectedShop.id) return shop;

      return {
        ...shop,
        calendar: {
          ...shop.calendar,
          [selectedDate]: shop.calendar[selectedDate].map((slot) =>
            slot.time === selectedTime
              ? { ...slot, occupied: true }
              : slot
          ),
        },
      };
    })
  );

  const appointment = {
    time: selectedTime,
    service: selectedService.name,
    client: customerInfo.name,
    shopId: selectedShop.id,
    date: selectedDate,
    customRequest: customRequest || "Sin pedido especial",
    total: selectedService.price + customExtra,
  };

  setBarberAppointments((prev) => [appointment, ...prev]);

  setCustomerHistory((prev) => [
    {
      id: Date.now(),
      shopName: selectedShop.name,
      service: selectedService.name,
      date: selectedDate,
      time: selectedTime,
      price: selectedService.price + customExtra,
      rating: 0,
      customRequest: customRequest || "Sin pedido especial",
    },
    ...prev,
  ]);

  setNotification(
    `Nueva reserva para ${selectedShop.name}: ${selectedDate} a las ${selectedTime}`
  );

  setPaymentConfirmed(true);
};

  const handleBarberLogin = () => {
    if (!barberLogin.email || !barberLogin.password) return;
    setBarberLoggedIn(true);
  };

  const updateCustomerRating = (id, rating) => {
    setCustomerHistory((prev) =>
      prev.map((item) => (item.id === id ? { ...item, rating } : item))
    );
  };

  const activeSlots = selectedShop
    ? shops.find((shop) => shop.id === selectedShop.id)?.calendar?.[selectedDate] || []
    : [];

  const basePrice =
  (selectedService?.price || selectedShop?.basePrice || 0) + customExtra;

const barberEarnings = basePrice - COMISION;
const appEarnings = COMISION;

const finalPrice = basePrice;
  if (view === "landing") {
    return (
      <div className="min-h-screen bg-neutral-950 text-white">
        <section
          className="relative overflow-hidden border-b border-white/10 bg-cover bg-center"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1800&q=80)",
          }}
        >
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative mx-auto max-w-6xl px-6 py-28 text-center">
            <span className="mb-6 inline-block rounded-full border border-amber-400/30 bg-amber-400/10 px-5 py-2 text-xs tracking-[0.25em] text-amber-300">
              EXPERIENCIA PREMIUM EN BARBERÍAS
            </span>
            <h1 className="text-5xl font-black leading-tight md:text-7xl">
              El estilo no se improvisa.
              <br />
              <span className="text-amber-400">Se reserva.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-300">
              Encuentra a los mejores barberos cerca de ti, descubre su trabajo real, revisa reseñas y reserva tu cita en segundos con Barber Pro.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <button onClick={() => setView("client")} className={`rounded-2xl bg-amber-400 px-8 py-4 font-bold text-black transition hover:scale-105 ${pointerClass}`}>
                Buscar barbería
              </button>
              <button onClick={() => setView("barber")} className={`rounded-2xl border border-white/20 px-8 py-4 font-bold text-white transition hover:bg-white/10 ${pointerClass}`}>
                Soy barbero
              </button>
            </div>
            <div className="mt-14 grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur">
                <p className="text-2xl font-black text-amber-400">+120</p>
                <p className="text-sm text-neutral-400">Barberías afiliadas</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur">
                <p className="text-2xl font-black text-amber-400">24/7</p>
                <p className="text-sm text-neutral-400">Reservas online</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur">
                <p className="text-2xl font-black text-amber-400">3 pasos</p>
                <p className="text-sm text-neutral-400">Buscar · Reservar · Cortar</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (view === "barber") {
    
    const currentBarberAppointments = barberAppointments.filter((item) => item.shopId === 1);

    if (!barberLoggedIn) {
      return (
        <div className="min-h-screen bg-neutral-950 p-8 text-white">
          <div className="mx-auto mt-12 max-w-md rounded-[2rem] border border-white/10 bg-neutral-900 p-8 shadow-2xl">
            <p className="text-sm uppercase tracking-[0.2em] text-amber-400">Acceso barbero</p>
            <h1 className="mt-2 text-3xl font-black">Login Barber Pro</h1>
            <p className="mt-3 text-sm text-neutral-400">Solo los barberos ingresan con cuenta. Los clientes reservan sin login.</p>
            <div className="mt-6 space-y-3">
            <input
  value={barberLogin.email}
  onChange={(e) =>
    setBarberLogin((prev) => ({
      ...prev,
      email: e.target.value,
    }))
  }
  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
  placeholder="Correo del barbero"
/>
              <input type="password" value={barberLogin.password} onChange={(e) => setBarberLogin((prev) => ({ ...prev, password: e.target.value }))} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none" placeholder="Contraseña" />
              <button onClick={handleBarberLogin} className={`w-full rounded-xl bg-amber-400 px-4 py-3 font-bold text-black ${pointerClass}`}>Ingresar al panel</button>
              <button onClick={() => setView("landing")} className={`w-full rounded-xl border border-white/10 px-4 py-3 font-bold ${pointerClass}`}>Volver al inicio</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-neutral-950 p-8 text-white">
        <h1 className="mb-8 text-3xl font-black">Panel Barbero <span className="text-amber-400">Barber Pro</span></h1>
        {notification && <div className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">🔔 {notification}</div>}
        <div className="mb-10 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl bg-neutral-900 p-6"><p className="text-sm text-neutral-400">Citas hoy</p><p className="text-3xl font-black">{currentBarberAppointments.length}</p></div>
          <div className="rounded-2xl bg-neutral-900 p-6"><p className="text-sm text-neutral-400">Ganancia hoy</p><p className="text-3xl font-black text-amber-400">S/ 168</p></div>
          <div className="rounded-2xl bg-neutral-900 p-6"><p className="text-sm text-neutral-400">Comisión plataforma</p><p className="text-3xl font-black">S/ 28</p></div>
        </div>
        <div className="rounded-2xl bg-neutral-900 p-6">
          <h2 className="mb-4 text-xl font-bold">Próximas citas</h2>
          <div className="space-y-2">
            {currentBarberAppointments.map((item, index) => (
              <div key={`${item.time}-${index}`} className="rounded-xl border border-white/10 px-4 py-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <span>{item.date} - {item.time} - {item.service}</span>
                  <span>Cliente: {item.client}</span>
                </div>
                <p className="mt-2 text-sm text-neutral-400">Pedido especial: {item.customRequest}</p>
                <p className="mt-1 text-sm text-amber-400">Total: S/ {item.total}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-6 rounded-2xl bg-neutral-900 p-6">
          <h2 className="mb-4 text-xl font-bold">Promociones sugeridas</h2>
          <p className="text-sm text-neutral-400">Ofrece 15% de descuento entre 2:00 pm y 4:00 pm para llenar horas vacías.</p>
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <button onClick={() => setView("client")} className={`rounded-xl bg-amber-400 px-4 py-2 font-bold text-black ${pointerClass}`}>Volver</button>
          <button onClick={() => { setBarberLoggedIn(false); setBarberLogin({ email: "", password: "" }); }} className={`rounded-xl border border-white/10 px-4 py-2 font-bold ${pointerClass}`}>Cerrar sesión</button>
        </div>
      </div>
    );
  }
  if (view === "admin" && !adminAccess) {
  return (
    <div className="min-h-screen bg-neutral-950 p-8 text-white">
      <div className="mx-auto mt-12 max-w-md rounded-[2rem] border border-white/10 bg-neutral-900 p-8 shadow-2xl">
        <p className="text-sm uppercase tracking-[0.2em] text-amber-400">Acceso administrador</p>
        <h1 className="mt-2 text-3xl font-black">Panel Admin</h1>
        <p className="mt-3 text-sm text-neutral-400">Ingresa la clave para acceder.</p>

        <div className="mt-6 space-y-3">
          <input
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
            placeholder="Clave de administrador"
          />

          <button
            onClick={() => {
              if (adminPassword === "BarberProAdmin2026") {
                setAdminAccess(true);
              } else {
                alert("Clave incorrecta");
              }
            }}
            className={`w-full rounded-xl bg-amber-400 px-4 py-3 font-bold text-black ${pointerClass}`}
          >
            Ingresar
          </button>

          <button
            onClick={() => setView("client")}
            className={`w-full rounded-xl border border-white/10 px-4 py-3 font-bold ${pointerClass}`}
          >
            Volver
          </button>
        </div>
      </div>
    </div>
  );
}
if (view === "admin" && adminAccess) {
  return (
    <div className="min-h-screen bg-neutral-950 p-8 text-white">
      <h1 className="mb-8 text-3xl font-black">
        Panel Admin <span className="text-amber-400">Barber Pro</span>
      </h1>

      <div className="rounded-2xl bg-neutral-900 p-6">
        <h2 className="mb-4 text-xl font-bold">Barberías registradas</h2>

        {allBarbers.length === 0 && (
          <p className="text-neutral-400">
            No hay barberías registradas todavía
          </p>
        )}

        <div className="space-y-3">
          {allBarbers.map((shop) => (
            <div
              key={shop.id}
              className="rounded-xl border border-white/10 p-4 flex justify-between items-center"
            >
              <div>
                <p className="font-bold">{shop.nombre}</p>
                <p className="text-sm text-neutral-400">{shop.distrito}</p>
                <p className="text-xs text-amber-400">
                  Estado: {shop.estado || "pendiente"}
                </p>
              </div>

              {shop.verificada ? (
                <span className="rounded-xl bg-green-600 px-4 py-2 font-bold text-white">
                  Activa
                </span>
              ) : (
                <button
                  onClick={async () => {
                    const { error } = await supabase
                      .from("barberias")
                      .update({ verificada: true, estado: "activa" })
                      .eq("id", shop.id);

                    if (error) {
                      alert("Error al activar: " + error.message);
                      console.log(error);
                      return;
                    }

                    alert("Barbería activada 🚀");

                    setAllBarbers((prev) =>
                      prev.map((item) =>
                        item.id === shop.id
                          ? { ...item, verificada: true, estado: "activa" }
                          : item
                      )
                    );

                    setShops((prev) => [
                      ...prev,
                      {
                        id: shop.id,
                        name: shop.nombre,
                        district: shop.distrito,
                        distance: "Cerca de ti",
                        rating: shop.rating ?? 5,
                        reviews: shop.total_resenas ?? 0,
                        basePrice: shop.precio_desde ?? 25,
                        originalBasePrice: (shop.precio_desde ?? 25) + 5,
                        discount: "Nuevo",
                        image:
                          shop.imagen_url ||
                          "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=1200&q=80",
                        tags: ["Nuevo"],
                        about: shop.descripcion || "",
                        introVideoTitle: "",
                        introVideoNote: "",
                        cutsVideoTitle: "",
                        cutsVideoNote: "",
                        services: [],
                        calendar: {
                          [AVAILABLE_DATES[0]]: [],
                          [AVAILABLE_DATES[1]]: [],
                          [AVAILABLE_DATES[2]]: [],
                        },
                      },
                    ]);
                  }}
                  className="bg-amber-400 text-black px-4 py-2 rounded-xl font-bold"
                >
                  Activar
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => setView("client")}
        className="mt-6 border border-white/10 px-4 py-2 rounded-xl"
      >
        Volver
      </button>
    </div>
  );
}
  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-neutral-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <span className="text-3xl font-black">BARBER <span className="text-amber-400">PRO</span></span>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setView("landing")} className={`rounded-xl border border-white/20 px-4 py-2 text-sm ${pointerClass}`}>Inicio</button>
            <button onClick={() => setView("barber")} className={`rounded-xl border border-white/20 px-4 py-2 text-sm ${pointerClass}`}>Panel Barbero</button>

            <button onClick={enableLocation} className={`rounded-xl bg-amber-400 px-4 py-2 font-semibold text-black ${pointerClass}`}>Usar ubicación</button>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-7xl px-6 py-16">
          <ClientHero heroIndex={heroIndex} setHeroIndex={setHeroIndex} setView={setView} />

          <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-3xl font-black">Barberías cerca de ti</h2>
              <div className="mt-3">
                <select className="rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm">
                  <option>Todos los distritos</option>
                  <option>Ate</option>
                  <option>Santa Anita</option>
                  <option>La Molina</option>
                  <option>San Juan de Lurigancho</option>
                  <option>El Agustino</option>
                </select>
              </div>
              <p className="mt-2 text-neutral-400">La reserva confirmada pasa al panel del barbero, bloquea la hora y guarda el historial del cliente.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-neutral-300">
              Ranking visible por cercanía, calificación y número de reseñas.
            </div>
          </div>

          {locationEnabled && (
            <div className="mb-10 rounded-3xl border border-white/10 bg-neutral-900 p-6">
              <p className="font-bold text-amber-400">Ubicación activada</p>
              <div className="mt-4 flex h-[300px] w-full flex-col items-center justify-center rounded-2xl bg-black/40 text-center text-neutral-300">
                <p className="font-semibold">Mapa de barberías cercanas</p>
                <p className="mt-3">📍 Elite Fade Studio</p>
                <p>📍 Black Gold Barber</p>
                <p>📍 Urban King Barbershop</p>
              </div>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-3">
            {ranking.map((shop, index) => (
              <div key={shop.name} className="overflow-hidden rounded-2xl border border-white/10 bg-neutral-900">
                <img src={shop.image} className="h-56 w-full object-cover" alt={shop.name} />
                <div className="p-5">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-bold">{shop.name}</h3>
                      <p className="text-sm text-neutral-400">#{index + 1} en ranking • {shop.district} • {shop.distance}</p>
                    </div>
                    <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-black">{shop.discount}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {shop.tags.map((tag) => <span key={tag} className="rounded-full border border-white/10 px-3 py-1 text-xs text-neutral-300">{tag}</span>)}
                  </div>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span>⭐ {shop.rating} <span className="text-neutral-500">({shop.reviews})</span></span>
                    <div className="text-right">
                      <p className="text-xs text-neutral-500 line-through">S/ {shop.originalBasePrice}</p>
                      <p className="font-semibold text-amber-400">Desde S/ {shop.basePrice}</p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-neutral-300">
                    <p className="font-semibold text-white">Servicios:</p>
                    <p className="mt-1">{shop.services.map((service) => `${service.name} (${service.price})`).join(" • ")}</p>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <button onClick={() => openProfileModal(shop)} className={`rounded-xl border border-white/20 bg-black/40 py-3 font-bold text-white hover:bg-black/60 ${pointerClass}`}>Ver barbería</button>
                    <button onClick={() => openBookingModal(shop)} className={`rounded-xl bg-amber-400 py-3 font-bold text-black ${pointerClass}`}>Reservar cita</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 pb-4">
          <div className="rounded-3xl border border-white/10 bg-neutral-900 p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-black">Perfil del cliente</h2>
                <p className="mt-2 text-neutral-400">Los clientes no inician sesión, pero sí pueden ver su historial reciente y calificar servicios.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-neutral-300">Historial guardado en la sesión actual</div>
            </div>
            <div className="mt-6 grid gap-4">
              {customerHistory.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-lg font-bold">{item.shopName}</p>
                      <p className="text-sm text-neutral-400">{item.service} • {item.date} • {item.time}</p>
                      <p className="mt-1 text-sm text-neutral-500">Pedido especial: {item.customRequest}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-amber-400">S/ {item.price}</p>
                      <div className="mt-2 flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button key={star} onClick={() => updateCustomerRating(item.id, star)} className={`${pointerClass} text-lg ${item.rating >= star ? "text-amber-400" : "text-neutral-600"}`}>
                            ★
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-neutral-900 py-16">
          <div className="mx-auto grid max-w-7xl gap-8 px-6 md:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-neutral-950 p-6">
              <h2 className="text-2xl font-black">Pago dentro de la app</h2>
              <p className="mt-3 text-neutral-400">El cliente elige el método y confirma la reserva desde una ventana emergente.</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {["Tarjeta", "Yape", "Plin"].map((method) => (
                  <button key={method} onClick={() => setPaymentMethod(method)} className={`rounded-2xl border px-4 py-4 text-sm font-semibold transition ${pointerClass} ${paymentMethod === method ? "border-amber-400 bg-amber-400 text-black" : "border-white/10 bg-neutral-900 text-white"}`}>
                    {method}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-neutral-950 p-6">
              <div className="mb-6 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black">Registro de barberías</h2>
                  <p className="mt-2 text-neutral-400">Afíliate y recibe clientes sin depender solo de Instagram o WhatsApp.</p>
                </div>
                <button onClick={() => setShowAffiliateForm((prev) => !prev)} className={`rounded-xl bg-amber-400 px-4 py-2 font-bold text-black ${pointerClass}`}>{showAffiliateForm ? "Ocultar" : "Registrar"}</button>
              </div>
           {showAffiliateForm ? (
  <div className="space-y-3">
    <input
      value={affiliateForm.nombre}
      onChange={(e) =>
        setAffiliateForm((prev) => ({
          ...prev,
          nombre: e.target.value,
        }))
      }
      className="w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 outline-none"
      placeholder="Nombre de barbería"
    />

    <input
      value={affiliateForm.distrito}
      onChange={(e) =>
        setAffiliateForm((prev) => ({
          ...prev,
          distrito: e.target.value,
        }))
      }
      className="w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 outline-none"
      placeholder="Distrito"
    />

    <input
      value={affiliateForm.whatsapp}
      onChange={(e) =>
        setAffiliateForm((prev) => ({
          ...prev,
          whatsapp: e.target.value,
        }))
      }
      className="w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 outline-none"
      placeholder="WhatsApp"
    />

    <input
      value={affiliateForm.correo}
      onChange={(e) =>
        setAffiliateForm((prev) => ({
          ...prev,
          correo: e.target.value,
        }))
      }
      className="w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 outline-none"
      placeholder="Correo"
    />

    <input
      value={affiliateForm.direccion}
      onChange={(e) =>
        setAffiliateForm((prev) => ({
          ...prev,
          direccion: e.target.value,
        }))
      }
      className="w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 outline-none"
      placeholder="Dirección del local"
    />

    <button
      onClick={handleAffiliateSubmit}
      className={`w-full rounded-xl bg-white py-3 font-bold text-black ${pointerClass}`}
    >
      Registrar barbería
    </button>
  </div>
) : (
  <div className="rounded-2xl border border-dashed border-white/10 bg-neutral-900 p-6 text-sm text-neutral-400">
    Activa el registro para mostrar el formulario de afiliación de barberías.
  </div>
)}
              
            </div>
          </div>
        </section>
      </main>

      <ProfileModal
        selectedShop={showProfileModal ? selectedShop : null}
        onClose={closeProfileModal}
        onReserve={() => {
          setShowProfileModal(false);
          openBookingModal(selectedShop);
        }}
      />

      <BookingModal
        selectedShop={showBookingModal ? selectedShop : null}
        selectedService={selectedService}
        setSelectedService={setSelectedService}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        selectedTime={selectedTime}
        setSelectedTime={setSelectedTime}
        customerInfo={customerInfo}
        setCustomerInfo={setCustomerInfo}
        customRequest={customRequest}
        setCustomRequest={setCustomRequest}
        customExtra={customExtra}
        setCustomExtra={setCustomExtra}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        activeSlots={activeSlots}
        finalPrice={finalPrice}
        paymentConfirmed={paymentConfirmed}
        confirmPayment={confirmPayment}
        closeBookingModal={closeBookingModal}
      />

      <footer className="border-t border-white/10 py-6 text-center text-neutral-500">© 2026 Barber Pro</footer>
    </div>
  );
}
