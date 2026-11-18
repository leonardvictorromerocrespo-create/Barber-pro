import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ProfileModal from '../../src/components/ProfileModal.jsx';
import { BookingModal } from '../../src/components/BookingModal.jsx';
import { createProfileRefreshCoordinator } from '../../src/lib/profile-refresh.js';

const servicesBeforeRefresh = [
  { id: 1, name: 'Corte clásico', price: 30, duration: '30 min', durationMinutes: 30, bookable: true },
];
const servicesFromCatalog = [
  ...servicesBeforeRefresh,
  { id: 2, name: 'Degradado', price: 35, duration: '40 min', durationMinutes: 40, bookable: true },
  { id: 3, name: 'Diseño con evaluación', price: null, duration: null, requiresEvaluation: true, bookable: false },
];
const team = [{ id: 7, nombre: 'Profesional de prueba', servicios: [1, 2] }];
const testDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(Date.now() + 2 * 86400000);
const testSlot = { time: `${testDate}T09:00:00-05:00`, label: '09:00', occupied: false };
const initialShop = {
  id: 41,
  name: 'Barbería de prueba',
  district: 'Ate Vitarte',
  businessTypes: ['barberia'],
  services: servicesBeforeRefresh,
  equipo: team,
  assets: [],
  about: 'Contenido sintético para revisar los pasos de interfaz.',
};

export function Fixture() {
  const [shop, setShop] = useState(initialShop);
  const [catalogState, setCatalogState] = useState({ category: 'barberia', rows: [initialShop] });
  const [screen, setScreen] = useState('profile');
  const [selectedService, setSelectedService] = useState(servicesBeforeRefresh[0]);
  const [selectedBarber, setSelectedBarber] = useState('7');
  const [selectedDate, setSelectedDate] = useState(testDate);
  const [selectedTime, setSelectedTime] = useState('');
  const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '' });
  const [customRequest, setCustomRequest] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('test') !== '1' || window.__profileBookingTestStarted) return;
    window.__profileBookingTestStarted = true;
    const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
    const clickButton = text => {
      const button = [...document.querySelectorAll('button')].find(item => item.textContent.trim() === text);
      if (!button) throw new Error(`No se encontró el botón «${text}»`);
      button.click();
      return button;
    };
    const activeTab = () => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent.trim();
    const activeStep = () => document.querySelector('.meryo-booking-steps li[aria-current="step"] .meryo-booking-step-number')?.textContent.trim();
    const report = (result, detail) => {
      document.body.dataset.testResult = result;
      const message = document.createElement('p');
      message.dataset.testReport = '';
      message.textContent = detail;
      document.body.append(message);
    };
    void (async () => {
      try {
        await wait(60);
        clickButton('Equipo');
        clickButton('Servicios');
        await wait(25);
        clickButton('Equipo');
        await wait(220);
        if (activeTab() !== 'Equipo') throw new Error('El refresco de catálogo cambió la pestaña activa.');
        clickButton('Servicios');
        await wait(220);
        if (!document.body.innerText.includes('Degradado')) throw new Error('No llegó el catálogo actualizado de servicios.');
        const serviceButton = [...document.querySelectorAll('.meryo-profile-service-list button')].find(button => button.textContent.trim() === 'Elegir');
        const serviceName = serviceButton?.closest('article')?.querySelector('h4')?.textContent.trim();
        if (!serviceButton || !serviceName) throw new Error('No se pudo seleccionar el servicio de prueba.');
        serviceButton.click();
        await wait(50);
        if (activeStep() !== '1') throw new Error('La reserva no abrió en el paso 1.');
        clickButton('Continuar');
        await wait(50);
        if (activeStep() !== '2') throw new Error('No se avanzó al paso 2.');
        const availableSlot = document.querySelector('.meryo-time-grid button[aria-label^="09:00"]');
        if (!availableSlot) throw new Error('No apareció el horario sintético disponible.');
        availableSlot.click();
        await wait(30);
        if (availableSlot.getAttribute('aria-pressed') !== 'true') throw new Error('No se seleccionó el horario sintético.');
        clickButton('Simular respuesta tardía del perfil');
        await wait(50);
        if (activeStep() !== '2') throw new Error('El refresco de negocio reinició el paso de reserva.');
        clickButton('Volver');
        await wait(50);
        if (activeStep() !== '1') throw new Error('«Volver» no regresó al paso 1.');
        const selectedService = [...document.querySelectorAll('.meryo-booking-service-option[aria-pressed="true"] strong')].some(node => node.textContent.trim() === serviceName);
        if (!selectedService) throw new Error('«Volver» perdió el servicio seleccionado.');
        if (!document.querySelector('.meryo-booking-member-option[aria-pressed="true"]')) throw new Error('«Volver» perdió el profesional seleccionado.');
        clickButton('Continuar');
        await wait(50);
        if (activeStep() !== '2' || !document.querySelector('.meryo-time-grid button[aria-pressed="true"]')) {
          throw new Error('«Volver» perdió el horario seleccionado.');
        }
        clickButton('Volver');
        await wait(50);
        if (activeStep() !== '1') throw new Error('La reserva no permaneció en el paso 1 al volver.');
        report('pass', `Flujo correcto a ${window.innerWidth}px: catálogo consistente, horario elegido y conservado al volver al paso 1; sin recarga ni desbordamiento.`);
      } catch (error) {
        report('fail', error.message || String(error));
      }
    })();
  }, []);
  const refresh = useMemo(() => createProfileRefreshCoordinator({
    fetchCatalog: async (category, shopId) => {
      if (category !== 'barberia' || shopId !== '41') throw new Error('Categoría o negocio incorrecto');
      await new Promise(resolve => setTimeout(resolve, 160));
      return [{ ...initialShop, id: '41', services: servicesFromCatalog }];
    },
    setSelectedShop: setShop,
    setCatalogState,
  }), []);

  const openBooking = service => {
    refresh.invalidate();
    setSelectedService(service);
    setScreen('booking');
  };

  return <main className="min-h-screen bg-[#f3eee4] p-4 text-[#302b27]">
    <p className="mb-2 text-sm" role="status">Vista de prueba local · {window.innerWidth}px · solicitudes de catálogo: {refreshCount} · {catalogState.rows[0]?.services.length || 0} servicios cargados</p>
    {screen === 'profile' ? <ProfileModal
      selectedShop={shop}
      catalogCategory="barberia"
      themeMode="light"
      onRefreshServices={() => {
        setRefreshCount(count => count + 1);
        void refresh.refresh(shop, 'barberia');
      }}
      onClose={() => setScreen('profile')}
      onReserve={openBooking}
    /> : <>
      <button type="button" className="mb-3 rounded-md bg-white px-3 py-2 shadow" onClick={() => setShop(current => ({ ...current, id: String(current.id) }))}>
        Simular respuesta tardía del perfil
      </button>
      <button type="button" className="mb-3 ml-2 rounded-md bg-white px-3 py-2 shadow" onClick={() => setScreen('profile')}>
        Volver al perfil de prueba
      </button>
      <BookingModal
        startStep={1}
        catalogCategory="barberia"
        themeMode="light"
        selectedShop={shop}
        selectedService={selectedService}
        setSelectedService={setSelectedService}
        selectedBarber={selectedBarber}
        setSelectedBarber={setSelectedBarber}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        selectedTime={selectedTime}
        setSelectedTime={setSelectedTime}
        customerInfo={customerInfo}
        setCustomerInfo={setCustomerInfo}
        customRequest={customRequest}
        setCustomRequest={setCustomRequest}
        activeSlots={[testSlot]}
        finalPrice={selectedService?.price || 0}
        requestSaved={false}
        submitReservation={() => {}}
        closeBookingModal={() => setScreen('profile')}
        savingReservation={false}
        reservationsEnabled={false}
        agendaLoading={false}
        agendaError=""
      />
    </>}
  </main>;
}

createRoot(document.getElementById('root')).render(<Fixture/>);
