import { useEffect, useRef, useState } from 'react';
import MeryoLogo from './MeryoLogo';
import './MeryoIntelligence.css';

const STARTERS = {
  barberia: [
    'Quiero un cambio de look.',
    'Busco algo moderno y discreto.',
    'Quiero un corte fácil de mantener.',
    'No sé qué corte me queda.',
  ],
  belleza: [
    'Quiero renovar mi corte.',
    'Me interesa un cambio de color.',
    'Busco un tratamiento capilar.',
    'Quiero ideas para peinarme.',
  ],
};

const errorMessage = error => ({
  configuration_pending: 'MERYO Intelligence todavía necesita configuración segura del modelo. Revisa las variables faltantes del servidor indicadas arriba.',
  catalog_unavailable: 'No pudimos consultar el catálogo público ahora. No enviaré recomendaciones aproximadas; inténtalo más tarde.',
  model_unavailable: 'El modelo no está disponible por el momento. Tu consulta no se guardó; puedes volver a intentarlo.',
  model_incomplete: 'La respuesta quedó incompleta. Puedes intentarlo de nuevo.',
  model_response_invalid: 'No pudimos validar la respuesta. Inténtalo de nuevo.',
  message_too_long: 'Tu mensaje supera el límite de 600 caracteres.',
  rate_limited: 'Llegaste al límite temporal de consultas. Espera unos minutos antes de continuar.',
}[error] || 'No pudimos conectar con MERYO Intelligence. Puedes intentarlo de nuevo más tarde.');

function SparkleMark() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2.7 14 9.9l7.3 2.1-7.3 2.1-2 7.2-2-7.2-7.3-2.1 7.3-2.1 2-7.2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="m19.2 2 .8 2.7 2.7.8-2.7.8-.8 2.7-.8-2.7-2.7-.8 2.7-.8.8-2.7Z" fill="currentColor"/></svg>;
}

function CloseMark() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>;
}

export default function MeryoIntelligence({ open, category = 'barberia', themeMode = 'light', themeAppearance, district = '', onClose, onOpenShop }) {
  const activeCategory = category === 'belleza' ? 'belleza' : 'barberia';
  const isBeauty = activeCategory === 'belleza';
  const categoryLabel = isBeauty ? 'Peluquerías y salones' : 'Barberías';
  const [availability, setAvailability] = useState('checking');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [missingConfiguration, setMissingConfiguration] = useState([]);
  const closeRef = useRef(null);
  const scrollRef = useRef(null);
  const inFlight = useRef(false);
  const requestRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    const controller = new AbortController();
    requestRef.current?.abort();
    requestRef.current = null;
    inFlight.current = false;
    setAvailability('checking');
    setMessages([]);
    setDraft('');
    setError('');
    setMissingConfiguration([]);
    setSending(false);
    fetch(`/api/meryo-intelligence?category=${activeCategory}`, { method: 'GET', headers: { accept: 'application/json' }, signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'unavailable');
        if (active) {
          setAvailability(result.category === activeCategory ? (result.status === 'ready' ? 'ready' : result.status || 'unavailable') : 'unavailable');
          setMissingConfiguration(Array.isArray(result.missing) ? result.missing : []);
        }
      })
      .catch(() => { if (active) setAvailability('unavailable'); });
    requestAnimationFrame(() => closeRef.current?.focus());
    return () => {
      active = false;
      controller.abort();
      requestRef.current?.abort();
      requestRef.current = null;
      inFlight.current = false;
    };
  }, [open, activeCategory]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending, error]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = event => { if (event.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (event, suggestedText) => {
    event?.preventDefault();
    const text = String(suggestedText ?? draft).trim();
    if (!text || text.length > 600 || availability !== 'ready' || inFlight.current) {
      if (text.length > 600) setError('message_too_long');
      return;
    }
    const history = messages.slice(-8).map(item => ({ role: item.role, content: item.content }));
    const requestController = new AbortController();
    requestRef.current = requestController;
    inFlight.current = true;
    setSending(true);
    setError('');
    setDraft('');
    setMessages(current => [...current, { role: 'user', content: text }]);
    try {
      const response = await fetch('/api/meryo-intelligence', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ category: activeCategory, message: text, history, district }),
        signal: requestController.signal,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'unavailable');
      if (requestRef.current !== requestController) return;
      setMessages(current => [...current, {
        role: 'assistant',
        content: String(result.answer || '').trim(),
        recommendations: Array.isArray(result.recommendations) ? result.recommendations.slice(0, 3) : [],
      }]);
    } catch (requestError) {
      if (requestError.name !== 'AbortError' && requestRef.current === requestController) setError(errorMessage(requestError.message));
    } finally {
      if (requestRef.current === requestController) {
        requestRef.current = null;
        inFlight.current = false;
        setSending(false);
      }
    }
  };

  const status = availability === 'checking' ? 'Comprobando configuración…'
    : availability === 'configuration_pending' ? 'Configuración pendiente'
      : availability === 'catalog_unavailable' ? 'Catálogo temporalmente no disponible'
      : availability === 'ready' ? `Asesora lista para ${categoryLabel}` : 'No disponible en este entorno';
  const canSend = availability === 'ready' && !sending;

  return <div className="meryo-intelligence-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose?.(); }}>
    <section className="meryo-intelligence-panel" role="dialog" aria-modal="true" aria-labelledby="meryo-intelligence-title" data-meryo-theme={isBeauty ? 'beauty' : 'barberia'} data-meryo-mode={themeMode} data-meryo-appearance={themeAppearance}>
      <header className="meryo-intelligence-header">
        <div className="meryo-intelligence-brand">
          <MeryoLogo variant={themeMode === 'light' ? 'light' : 'dark'} className="meryo-intelligence-logo" />
          <span aria-hidden="true" className="meryo-intelligence-brand-divider" />
          <p>MERYO<br/><strong>INTELLIGENCE</strong></p>
        </div>
        <button ref={closeRef} type="button" className="meryo-intelligence-close" onClick={onClose} aria-label="Cerrar MERYO Intelligence"><CloseMark /></button>
      </header>

      <div className="meryo-intelligence-content">
        <div className="meryo-intelligence-intro">
          <p className="meryo-intelligence-eyebrow"><SparkleMark /> Asesora de estilo</p>
          <h1 id="meryo-intelligence-title">Encuentra un estilo que hable por ti</h1>
          <p>{isBeauty ? 'Cuéntame qué servicio de peluquería buscas. Te ayudaré a explorar opciones y profesionales disponibles en el catálogo.' : 'Cuéntame qué tienes en mente. Te ayudaré a encontrar el corte y el profesional adecuados.'}</p>
        </div>

        <div className="meryo-intelligence-status" role="status" aria-live="polite">
          <span className={`meryo-intelligence-status-mark is-${availability}`} aria-hidden="true" />
          <span>{status}</span>
        </div>
        {(availability === 'configuration_pending' || availability === 'catalog_unavailable') && <p className="meryo-intelligence-notice">{missingConfiguration.length > 0 ? <>Falta configuración del servidor: {missingConfiguration.map((name, index) => <span key={`${index}-${name}`}>{index > 0 ? ', ' : ''}<code>{name}</code></span>)}. No se enviarán consultas al modelo mientras esté incompleta.</> : `No se pudo consultar el catálogo público de ${categoryLabel}. No se enviarán recomendaciones aproximadas.`}</p>}
        {availability === 'unavailable' && <p className="meryo-intelligence-notice">Este entorno no tiene disponible la ruta segura del servidor. La conversación no se simulará.</p>}

        <div className="meryo-intelligence-conversation" ref={scrollRef} aria-live="polite" aria-relevant="additions text">
          {!messages.length && <div className="meryo-intelligence-starters">
            <p>¿Qué te gustaría encontrar?</p>
            <div>{STARTERS[activeCategory].map(text => <button key={text} type="button" onClick={() => submit(null, text)} disabled={!canSend}>{text}<span aria-hidden="true">↗</span></button>)}</div>
          </div>}
          {messages.map((message, index) => <article className={`meryo-intelligence-message meryo-intelligence-message--${message.role}`} key={`${index}-${message.role}`}>
            <p className="meryo-intelligence-message-label">{message.role === 'assistant' ? 'MERYO INTELLIGENCE' : 'TÚ'}</p>
            <p className="meryo-intelligence-message-copy">{message.content}</p>
            {!!message.recommendations?.length && <div className="meryo-intelligence-recommendations" aria-label={`Trabajos publicados relacionados con ${categoryLabel}`}>
              {message.recommendations.map(work => <article className="meryo-intelligence-recommendation" key={work.id}>
                <div><p>{work.category || 'Trabajo publicado'}{work.professionalName ? ` · ${work.professionalName}` : ''}</p><h2>{work.title}</h2><span>{work.shop?.name || work.shopName}{work.shop?.district ? ` · ${work.shop.district}` : ''}</span></div>
                <button type="button" onClick={() => onOpenShop?.(activeCategory, work.shopId)} disabled={!work.shopId}>{isBeauty ? 'Ver salón' : 'Ver barbería'}</button>
              </article>)}
            </div>}
          </article>)}
          {sending && <p className="meryo-intelligence-thinking" role="status">Pensando en tu estilo…</p>}
          {error && <p className="meryo-intelligence-error" role="alert">{error}</p>}
        </div>

        <form className="meryo-intelligence-composer" onSubmit={submit}>
          <label className="sr-only" htmlFor="meryo-intelligence-input">{isBeauty ? 'Cuéntame qué servicio de peluquería buscas' : 'Cuéntame qué corte buscas'}</label>
          <textarea id="meryo-intelligence-input" value={draft} onChange={event => setDraft(event.target.value.slice(0, 601))} maxLength={601} rows={2} placeholder={isBeauty ? 'Cuéntame qué servicio te interesa…' : 'Cuéntame qué tienes en mente…'} disabled={!canSend} />
          <div className="meryo-intelligence-compose-bottom"><span>{draft.length}/600 · Evita compartir datos personales</span><button type="submit" disabled={!canSend || !draft.trim()} aria-label="Enviar mensaje">{sending ? 'Enviando…' : 'Enviar'}<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg></button></div>
        </form>
        <p className="meryo-intelligence-privacy">La conversación se mantiene en esta sesión y no se guarda en MERYO.</p>
      </div>
    </section>
  </div>;
}
