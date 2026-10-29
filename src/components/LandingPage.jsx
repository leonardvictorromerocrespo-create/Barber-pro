import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import clipperPhoto from '../assets/meryo-landing-clipper.webp';
import {consumeLandingIntro} from '../lib/landing-intro';
import './LandingPage.css';

const logoSource = '/meryo-logo.png';
const introDuration = 2700;

function reducedMotionEnabled() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function BrandLogo({className = '', onError}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className={`meryo-cover__wordmark ${className}`}>Meryo</span>;
  return <img src={logoSource} alt="MERYO" className={className} onError={() => {setFailed(true);onError?.();}} />;
}

export default function LandingPage({setView}) {
  const [intro, setIntro] = useState(false);
  const introDecision = useRef(null);
  const brandRef = useRef(null);
  const introLogoRef = useRef(null);
  useLayoutEffect(() => {
    if (introDecision.current !== null) return;
    introDecision.current = consumeLandingIntro({reducedMotion: reducedMotionEnabled()});
    setIntro(introDecision.current);
  }, []);
  useLayoutEffect(() => {
    if (!intro || !brandRef.current || !introLogoRef.current) return;
    const target = brandRef.current.getBoundingClientRect();
    const logo = introLogoRef.current;
    logo.style.setProperty('--meryo-intro-x', `${target.left + target.width / 2 - window.innerWidth / 2 - logo.offsetWidth / 2}px`);
    logo.style.setProperty('--meryo-intro-y', `${target.top + target.height / 2 - window.innerHeight / 2 - logo.offsetHeight / 2}px`);
    logo.style.setProperty('--meryo-intro-scale', `${target.width / logo.offsetWidth}`);
  }, [intro]);
  useEffect(() => {
    if (!intro) return undefined;
    // Content stays rendered and usable underneath the short entrance.
    const timeout = window.setTimeout(() => setIntro(false), introDuration);
    return () => window.clearTimeout(timeout);
  }, [intro]);

  const skipIntro = () => setIntro(false);

  return (
    <div className="meryo-cover" data-intro={intro ? 'playing' : 'done'}>
      <header className="meryo-cover__header">
        <button ref={brandRef} className="meryo-cover__brand" aria-label="MERYO, inicio" onClick={() => setView('landing')}>
          <BrandLogo className="meryo-cover__brand-image" onError={skipIntro}/>
        </button>
        <nav className="meryo-cover__nav" aria-label="Navegación de portada">
          <button type="button" onClick={() => setView('client')}>Explorar</button>
          <button type="button" onClick={() => setView('barber-login')}>Acceso barbero</button>
        </nav>
      </header>

      <main className="meryo-cover__main">
        <section className="meryo-cover__hero" aria-labelledby="meryo-cover-title">
          <div className="meryo-cover__copy">
            <h1 id="meryo-cover-title">
              <span>El estilo no se improvisa.</span>
              <span className="meryo-cover__gold">Se reserva.</span>
            </h1>
            <p>Encuentra barberías cerca de ti, conoce su trabajo y solicita tu cita.</p>
            <div className="meryo-cover__actions">
              <button type="button" className="meryo-cover__primary" onClick={() => setView('client')}>Buscar barbería</button>
              <button type="button" className="meryo-cover__secondary" onClick={() => setView('barber-login')}>Soy barbero</button>
            </div>
          </div>

          <div className="meryo-cover__visual" aria-label="Barbero usando una máquina de corte profesional" role="img">
            <img src={clipperPhoto} alt="" fetchPriority="high" decoding="async" />
            <span className="meryo-cover__gold-light" aria-hidden="true" />
            <span className="meryo-cover__edge-light" aria-hidden="true" />
          </div>
        </section>
      </main>

      <footer className="meryo-cover__footer">
        <a href="/privacidad.html">Privacidad</a>
        <a href="/condiciones.html">Condiciones</a>
      </footer>

      {intro && (
        <div className="meryo-cover__intro" aria-label="Presentación de MERYO">
          <div ref={introLogoRef} className="meryo-cover__intro-logo">
            <BrandLogo className="meryo-cover__intro-image" onError={skipIntro}/>
            <span className="meryo-cover__intro-light" aria-hidden="true" />
          </div>
          <button type="button" className="meryo-cover__skip" onClick={skipIntro}>Saltar</button>
        </div>
      )}
    </div>
  );
}
