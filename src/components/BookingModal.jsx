import { useEffect, useMemo, useRef, useState } from 'react';
import { fechaLima, listaDias, sumarDias } from '../lib/dates';

const dateFormatter = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const dayFormatter = new Intl.DateTimeFormat('es-PE', { weekday: 'short', timeZone: 'UTC' });
const dateValue = value => value ? new Date(value + 'T12:00:00Z') : null;
const formatDate = value => value ? dateFormatter.format(dateValue(value)) : 'Sin elegir';
const formatDay = value => value ? dayFormatter.format(dateValue(value)).replace('.', '') : '';
const initials = value => String(value || '?').trim().split(/\s+/).slice(0, 2).map(part => Array.from(part)[0] || '').join('').toLocaleUpperCase('es');

const steps = [
  { id: 1, label: 'Servicio y equipo' },
  { id: 2, label: 'Fecha y hora' },
  { id: 3, label: 'Revisar' },
];

export function BookingModal({
  catalogCategory = 'barberia',
  themeMode = 'dark',
  themeAppearance,
  startStep = 1,
  selectedShop,
  selectedService,
  setSelectedService,
  onServiceSelect,
  selectedBarber,
  setSelectedBarber,
  onBarberSelect,
  selectedDate,
  setSelectedDate,
  selectedTime,
  setSelectedTime,
  customerInfo,
  setCustomerInfo,
  customRequest,
  setCustomRequest,
  activeSlots = [],
  finalPrice = 0,
  requestSaved,
  submitReservation,
  closeBookingModal,
  savingReservation,
  reservationsEnabled,
  agendaLoading,
  agendaError,
  onLogin,
  accessMessage,
  identityLoading = false,
  identityError = '',
  onRetrySession,
  promotion = null,
  promotionError = '',
  onRegularPrice,
  onBackToOffers,
  salonPromotion = null,
  salonPromotionError = '',
  salonPriceDecision = null,
  onSalonRegularPrice,
  onCancelSalonPriceDecision,
  reservationValidationMessage = '',
  inspiration = null,
  inspirationIssue = '',
  onClearInspiration,
}) {
  const [step, setStep] = useState(startStep);
  const closeRef = useRef(null);
  const dialogRef = useRef(null);
  const closeHandler = useRef(closeBookingModal);
  closeHandler.current = closeBookingModal;
  const isBeauty = catalogCategory === 'belleza';
  const professional = isBeauty ? 'profesional' : 'barbero';
  const team = selectedShop?.equipo ?? [];
  const bookableServices = useMemo(
    () => (selectedShop?.services ?? []).filter(service => service.bookable &&
      (!(promotion || salonPromotion) || String(service.id) === String(selectedService?.id))),
    [selectedShop?.id, selectedShop?.services, promotion, salonPromotion, selectedService?.id]
  );
  const eligible = useMemo(
    () => team.filter(member => (member.servicios ?? []).some(id => String(id) === String(selectedService?.id))),
    [selectedShop?.id, selectedService?.id, selectedShop?.equipo]
  );
  const selectedMember = eligible.find(member => String(member.id) === String(selectedBarber));
  const hasCurrentSlot = activeSlots.some(slot => !slot.occupied && slot.time === selectedTime);
  const today = fechaLima(new Date());
  const days = useMemo(() => listaDias(7), [today]);
  const minDate = salonPromotion?.promotionDate || today;
  const maxDate = salonPromotion?.promotionDate || sumarDias(today, 30);
  const offer = promotion || salonPromotion;
  const formatMoney = value => Number.isFinite(Number(value)) ? 'S/ ' + Number(value).toFixed(2) : 'Por confirmar';
  const stepOneValid = Boolean(selectedService?.bookable && eligible.some(member => String(member.id) === String(selectedBarber)));
  const stepTwoValid = Boolean(selectedDate && selectedTime && hasCurrentSlot && !agendaLoading && !agendaError && !promotionError && !salonPromotionError && !reservationValidationMessage);
  const stepThreeValid = Boolean(stepTwoValid && !savingReservation && !identityLoading && !identityError && !requestSaved &&
    !salonPriceDecision && !inspirationIssue && (!reservationsEnabled || (customerInfo?.name?.trim() && customerInfo?.phone?.trim())));
  const price = Number(finalPrice);
  const duration = selectedService?.duration || (selectedService?.durationMinutes ? selectedService.durationMinutes + ' min' : 'Duración por confirmar');

  useEffect(() => {
    if (selectedShop) setStep(Math.min(3, Math.max(1, Number(startStep) || 1)));
  }, [selectedShop?.id, startStep]);

  useEffect(() => {
    if (!selectedShop) return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeHandler.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = [...(dialogRef.current?.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])') ?? [])]
        .filter(element => element.getClientRects().length);
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [selectedShop?.id]);

  if (!selectedShop) return null;

  const chooseService = service => {
    (onServiceSelect || setSelectedService)(service);
    setSelectedTime('');
  };
  const chooseMember = member => {
    (onBarberSelect || setSelectedBarber)(member.id);
    setSelectedTime('');
  };
  const chooseDate = value => {
    if (value < minDate || value > maxDate) return;
    setSelectedDate(value);
    setSelectedTime('');
  };
  const next = () => {
    if (step === 1 && stepOneValid) setStep(2);
    if (step === 2 && stepTwoValid) setStep(3);
  };
  const back = () => setStep(current => Math.max(1, current - 1));
  const backdropClass = 'meryo-booking-backdrop fixed inset-0 z-50 flex items-center justify-center';
  const wrapperClass = catalogCategory === 'barberia' ? 'meryo-soft-booking' : 'meryo-beauty-booking';

  return <div
    data-meryo-theme={catalogCategory === 'belleza' ? 'beauty' : 'barberia'}
    data-meryo-mode={themeMode}
    data-meryo-appearance={themeAppearance}
    className={backdropClass}
    onMouseDown={event => { if (event.target === event.currentTarget) closeBookingModal(); }}
  >
    <section
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={isBeauty ? 'meryo-booking-title' : undefined}
      aria-label={isBeauty ? undefined : 'Reserva de cita'}
      tabIndex={-1}
      data-meryo-theme={catalogCategory === 'belleza' ? 'beauty' : 'barberia'}
      data-meryo-mode={themeMode}
      data-meryo-appearance={themeAppearance}
      className={'meryo-booking-dialog ' + wrapperClass}
    >
      <header className="meryo-booking-dialog-header">
        {(isBeauty || accessMessage) && <div className="min-w-0">
          {isBeauty && <>
            <p className="meryo-booking-eyebrow">Reserva tu cita · salón</p>
            <h2 id="meryo-booking-title" className="meryo-booking-title">{selectedShop.name}</h2>
            <p className="meryo-booking-subtitle">No se cobra al enviar la solicitud.</p>
          </>}
          {accessMessage && <p role="status" className="meryo-booking-message">{accessMessage}</p>}
        </div>}
        <button ref={closeRef} type="button" onClick={closeBookingModal} className="meryo-booking-close ml-auto min-h-11 shrink-0 rounded-md px-3 py-2 text-sm font-semibold">Cerrar</button>
      </header>

      <ol className="meryo-booking-steps" aria-label="Pasos de la reserva">
        {steps.map(item => <li key={item.id} aria-current={step === item.id ? 'step' : undefined} className={step === item.id ? 'is-current' : item.id < step ? 'is-complete' : ''}>
          <span className="meryo-booking-step-number">{item.id}</span><span>{item.label}</span>
        </li>)}
      </ol>

      <div className="meryo-booking-scroll">
        {step === 1 && <section aria-labelledby="meryo-booking-services-title" className="meryo-booking-step-content">
          <div className="meryo-booking-step-heading"><span>01</span><div><h3 id="meryo-booking-services-title">Elige servicio y {professional}</h3><p>Selecciona un servicio y un profesional que lo ofrezca.</p></div></div>
          {promotion && <p className="meryo-booking-notice">Cortes al 50 %: precio habitual {formatMoney(promotion.regularPrice)} · oferta {formatMoney(finalPrice)}. El adelanto, si aceptan la cita, se calcula sobre el precio promocional.</p>}
          {salonPromotion && <p className="meryo-booking-notice">Promoción vigente: precio habitual {formatMoney(salonPromotion.regularPrice)} · precio de oferta {formatMoney(salonPromotion.promoPrice)}. El servidor comprobará la oferta antes de guardar.</p>}
          <div className="meryo-booking-choice-layout">
            <div className="meryo-booking-choice-group">
              <h4>Servicio</h4>
              {bookableServices.length ? <div className="meryo-booking-service-list">{bookableServices.map(service => {
                const isSelected = String(selectedService?.id) === String(service.id);
                const selectedOfferPrice = (promotion || salonPromotion) && isSelected;
                return <button key={service.id} type="button" aria-pressed={isSelected} onClick={() => chooseService(service)}
                  className={'meryo-booking-option meryo-booking-service-option' + (isSelected ? ' is-selected' : '')}>
                  <span className="min-w-0"><strong>{service.name}</strong><small>{service.duration || (service.durationMinutes ? service.durationMinutes + ' min' : 'Duración por confirmar')}</small></span>
                  <span className="meryo-booking-price">{selectedOfferPrice && <small className="meryo-booking-was">{formatMoney(service.price)}</small>}{formatMoney(selectedOfferPrice ? finalPrice : service.price)}</span>
                  {isSelected && <span aria-hidden="true" className="meryo-booking-check">✓</span>}
                </button>;
              })}</div> : <p className="meryo-booking-empty">Este negocio no tiene servicios con precio y duración definidos para reservar.</p>}
            </div>
            <div className="meryo-booking-choice-group">
              <h4>Elige tu {professional}</h4>
              {eligible.length ? <div className="meryo-booking-member-list">{eligible.map(member => {
                const isSelected = String(selectedBarber) === String(member.id);
                return <button key={member.id} type="button" aria-pressed={isSelected} onClick={() => chooseMember(member)}
                  className={'meryo-booking-option meryo-booking-member-option' + (isSelected ? ' is-selected' : '')}>
                  <span className="meryo-booking-member-avatar">{member.foto_url ? <img src={member.foto_url} alt="" onError={event => { event.currentTarget.hidden = true; }}/> : initials(member.nombre)}</span>
                  <span className="min-w-0"><strong>{member.nombre}</strong><small>Disponible para este servicio</small></span>
                  {isSelected && <span aria-hidden="true" className="meryo-booking-check">✓</span>}
                </button>;
              })}</div> : <p className="meryo-booking-empty">{selectedService ? 'No hay profesionales habilitados para este servicio.' : 'Elige un servicio para ver quiénes lo ofrecen.'}</p>}
            </div>
          </div>
        </section>}

        {step === 2 && <section aria-labelledby="meryo-booking-date-title" className="meryo-booking-step-content">
          <div className="meryo-booking-step-heading"><span>02</span><div><h3 id="meryo-booking-date-title">Elige fecha y hora</h3><p>Horarios consultados para {selectedMember?.nombre || 'el profesional seleccionado'}.</p></div></div>
          {reservationValidationMessage && <p role="alert" className="meryo-booking-notice">{reservationValidationMessage}</p>}
          {promotionError && <div role="alert" className="meryo-booking-error"><p>{promotionError} No se cambió el precio.</p><button type="button" onClick={onBackToOffers}>Volver a promociones y revisar el precio</button></div>}
          {salonPromotionError && <p role="alert" className="meryo-booking-error">{salonPromotionError}</p>}
          <div className="meryo-booking-date-heading"><h4>Fecha</h4><label>Otra fecha<input aria-label="Fecha de la cita" type="date" min={minDate} max={maxDate} disabled={Boolean(salonPromotion)} value={selectedDate || ''} onChange={event => chooseDate(event.target.value)}/></label></div>
          <div className="meryo-booking-day-strip" aria-label="Próximos siete días">
            {days.map((date, index) => <button key={date} type="button" aria-pressed={selectedDate === date} disabled={date < minDate || date > maxDate || Boolean(salonPromotion && date !== salonPromotion.promotionDate)}
              onClick={() => chooseDate(date)} className={'meryo-booking-day' + (selectedDate === date ? ' is-selected' : '')}>
              {selectedDate === date && <span className="meryo-booking-day-check" aria-hidden="true">✓</span>}
              <span>{index === 0 ? 'Hoy' : formatDay(date)}</span><strong>{new Intl.DateTimeFormat('es-PE', { day: 'numeric', timeZone: 'UTC' }).format(dateValue(date))}</strong><small>{new Intl.DateTimeFormat('es-PE', { month: 'short', timeZone: 'UTC' }).format(dateValue(date)).replace('.', '')}</small>
            </button>)}
          </div>
          <div className="meryo-booking-agenda">
            <div className="meryo-booking-agenda-heading"><h4>Horarios disponibles</h4><p>{formatDate(selectedDate)}</p></div>
            {agendaLoading && <p role="status" className="meryo-booking-empty">Consultando horarios del servidor…</p>}
            {!agendaLoading && agendaError && <div role="alert" className="meryo-booking-error"><p>{agendaError}</p><p>Los horarios no están disponibles para confirmar. Cambia de fecha o vuelve a intentarlo.</p></div>}
            {!agendaLoading && !agendaError && !activeSlots.length && <p className="meryo-booking-empty">{offer ? 'No quedan turnos de esta promoción para la fecha elegida. Revisa las ofertas o elige otra fecha.' : 'No hay horarios para esta fecha. Prueba otro día.'}</p>}
            {!agendaLoading && !agendaError && activeSlots.length > 0 && <div className="meryo-booking-legend"><span><i className="is-available"/> Disponible</span><span><i className="is-occupied"/> No disponible</span><span><i className="is-selected"/> Seleccionado</span></div>}
            <div className="meryo-time-grid" aria-label="Horarios">{activeSlots.map(slot => <button key={selectedDate + '-' + slot.time} type="button" disabled={slot.occupied || agendaLoading || Boolean(agendaError)} aria-pressed={selectedTime === slot.time}
              aria-label={slot.label + (slot.occupied ? ' · no disponible' : selectedTime === slot.time ? ' · seleccionado' : ' · disponible')}
              onClick={() => setSelectedTime(slot.time)}
              className={'meryo-booking-option meryo-time-slot min-h-11' + (slot.occupied ? ' is-unavailable' : selectedTime === slot.time ? ' is-selected' : '')}><span>{slot.label}</span>{!slot.occupied&&selectedTime===slot.time&&<span className="meryo-time-slot__check" aria-hidden="true">✓</span>}</button>)}</div>
            {(promotion || salonPromotion) && !agendaLoading && !activeSlots.some(slot => !slot.occupied) && <button type="button" onClick={onBackToOffers} className="meryo-booking-secondary">Volver a promociones</button>}
          </div>
          {salonPriceDecision && <div role="alert" className="meryo-booking-error meryo-price-decision">
            <p>La oferta ya no se aplica. El precio habitual actual es <strong>{formatMoney(salonPriceDecision.regularPrice)}</strong>. Revisa el horario antes de decidir; el precio no se cambia sin tu confirmación.</p>
            <button type="button" disabled={!hasCurrentSlot} onClick={onSalonRegularPrice}>Continuar al precio habitual</button>
            {!hasCurrentSlot && <p>Elige primero un horario disponible. Si cambió el turno, consulta la agenda actual.</p>}
            <button type="button" onClick={onCancelSalonPriceDecision}>Cancelar esta solicitud</button>
          </div>}
        </section>}

        {step === 3 && <section aria-labelledby="meryo-booking-review-title" className="meryo-booking-step-content">
          <div className="meryo-booking-step-heading"><span>03</span><div><h3 id="meryo-booking-review-title">Revisa tu solicitud</h3><p>Comprueba los datos antes de enviarla.</p></div></div>
          {reservationValidationMessage && <p role="alert" className="meryo-booking-notice">{reservationValidationMessage}</p>}
          {promotionError && <div role="alert" className="meryo-booking-error"><p>{promotionError} No se cambió el precio.</p><button type="button" onClick={onBackToOffers}>Volver a promociones y revisar el precio</button></div>}
          {salonPromotionError && <p role="alert" className="meryo-booking-error">{salonPromotionError}</p>}
          {salonPriceDecision && <div role="alert" className="meryo-booking-error meryo-price-decision">
            <p>La oferta venció o cambió. El precio habitual actual es <strong>{formatMoney(salonPriceDecision.regularPrice)}</strong>. Elige un horario actualizado para decidir si continúas.</p>
            <button type="button" onClick={() => setStep(2)}>Volver a elegir horario</button>
            <button type="button" onClick={onCancelSalonPriceDecision}>Cancelar esta solicitud</button>
          </div>}
          {inspiration && <section className="meryo-booking-reference">
            <div className="min-w-0">{inspiration.url && <img src={inspiration.url} alt="" loading="lazy"/>}<div><strong>Referencia de estilo: {inspiration.title || 'Trabajo seleccionado'}</strong><p>Se adjuntará a la solicitud si la publicación sigue disponible.</p></div></div>
            {inspirationIssue && <p role="alert">{inspirationIssue}</p>}
            <button type="button" onClick={onClearInspiration}>Continuar sin esta referencia</button>
          </section>}
          <div className="meryo-booking-review-layout">
            <div className="meryo-booking-review-fields">
              <h4>Datos del cliente</h4>
              <label>Nombre<input aria-label="Tu nombre" autoComplete="name" value={customerInfo?.name || ''} onChange={event => setCustomerInfo(previous => ({ ...previous, name: event.target.value }))} placeholder="Tu nombre"/></label>
              <label>Celular<input aria-label="Tu celular" type="tel" autoComplete="tel" value={customerInfo?.phone || ''} onChange={event => setCustomerInfo(previous => ({ ...previous, phone: event.target.value }))} placeholder="Tu celular"/></label>
              <label className="meryo-booking-request-label">Pedido especial <span>(opcional)</span><textarea aria-label="Pedido especial" value={customRequest} onChange={event => setCustomRequest(event.target.value)} placeholder="Cuéntanos algún detalle para esta cita."/></label>
            </div>
            <section className="meryo-booking-review-summary" aria-label="Resumen de la solicitud">
              <h4>Resumen</h4>
              <dl>
                <div><dt>Negocio</dt><dd>{selectedShop.name}</dd></div>
                <div><dt>Servicio</dt><dd>{selectedService?.name || 'Sin elegir'}</dd></div>
                <div><dt>Profesional</dt><dd>{selectedMember?.nombre || 'Sin elegir'}</dd></div>
                <div><dt>Fecha</dt><dd>{formatDate(selectedDate)}</dd></div>
                <div><dt>Hora</dt><dd>{activeSlots.find(slot => !slot.occupied && slot.time === selectedTime)?.label || 'Sin elegir'}</dd></div>
                <div><dt>Duración</dt><dd>{duration}</dd></div>
                {customRequest.trim() && <div><dt>Pedido especial</dt><dd>{customRequest}</dd></div>}
                {offer && <div><dt>Precio habitual</dt><dd className="meryo-booking-was">{formatMoney(offer.regularPrice)}</dd></div>}
                <div className="meryo-booking-review-total"><dt>{offer ? 'Precio final' : 'Precio'}</dt><dd>{formatMoney(price)}</dd></div>
                <div><dt>Adelanto (50 %), tras aceptar</dt><dd>{formatMoney(price * 0.5)}</dd></div>
              </dl>
              <p className="meryo-booking-pending">Esta solicitud queda pendiente de aceptación. El negocio tiene hasta 15 minutos para responder. Si acepta, recibirás un aviso para pagar el adelanto dentro del plazo indicado. No se realiza un cobro al enviar la solicitud.</p>
            </section>
          </div>
          {identityLoading && <p role="status" className="meryo-booking-empty">Restaurando tu sesión…</p>}
          {!identityLoading && identityError && <div role="alert" className="meryo-booking-error"><p>No pudimos comprobar tu sesión.</p><button type="button" onClick={onRetrySession}>Reintentar comprobación</button></div>}
          {!identityLoading && !identityError && !reservationsEnabled && <p className="meryo-booking-login-note">Al enviar, iniciarás sesión con Google o correo. Conservaremos esta selección.</p>}
          {inspirationIssue && <p role="alert" className="meryo-booking-error">{inspirationIssue}</p>}
          {requestSaved && <p role="status" className="meryo-booking-success">Solicitud enviada. Está pendiente de aceptación; no se ha realizado ningún cobro.</p>}
        </section>}
      </div>

      <footer className="meryo-booking-footer">
        <div className="meryo-booking-footer-summary">
          <span>{selectedService?.name || 'Elige un servicio'}</span>
          <strong>{selectedService ? formatMoney(price) : '—'}</strong>
        </div>
        <div className="meryo-booking-footer-actions">
          {step > 1 && <button type="button" className="meryo-booking-secondary min-h-11" onClick={back}>Volver</button>}
          {step < 3
            ? <button type="button" className="meryo-booking-primary min-h-11" disabled={step === 1 ? !stepOneValid : !stepTwoValid} onClick={next}>Continuar</button>
            : <button type="button" className="meryo-booking-primary meryo-booking-submit min-h-11" disabled={!stepThreeValid} onClick={submitReservation}>{requestSaved ? 'Solicitud enviada' : savingReservation ? 'Enviando…' : 'Solicitar cita'}</button>}
        </div>
      </footer>
    </section>
  </div>;
}

export default BookingModal;
