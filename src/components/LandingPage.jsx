import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import barberPhoto from '../assets/meryo-entry-barber.jpeg';
import beautyPhoto from '../assets/meryo-entry-beauty.jpeg';
import {consumeLandingIntro} from '../lib/landing-intro';
import './LandingPage.css';

const logoSource = '/meryo-logo.png';
const introDuration = 2700;

function reducedMotionEnabled() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch { return false; }
}

function BrandLogo({className = '', onError}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className={`meryo-cover__wordmark ${className}`}>Meryo</span>;
  return <img src={logoSource} alt="MERYO" className={className} onError={() => {setFailed(true);onError?.();}} />;
}

export default function LandingPage({setView, onExplore}) {
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
    const timeout = window.setTimeout(() => setIntro(false), introDuration);
    return () => window.clearTimeout(timeout);
  }, [intro]);
  const skipIntro = () => setIntro(false);

  const explore = category => onExplore ? onExplore(category) : setView('client');

  return (
    <div className="meryo-cover" data-intro={intro ? 'playing' : 'done'}>
      <header className="meryo-cover__header">
        <button ref={brandRef} className="meryo-cover__brand" aria-label="MERYO, inicio" onClick={() => setView('landing')}>
          <BrandLogo className="meryo-cover__brand-image" onError={skipIntro}/>
        </button>
        <nav className="meryo-cover__nav" aria-label="Navegación de portada">
          <button type="button" onClick={() => explore('barberia')}>Explorar barberías</button>
          <button type="button" onClick={() => explore('belleza')}>Explorar salones</button>
          <button type="button" onClick={() => setView('barber-login')}>Soy profesional</button>
        </nav>
      </header>

      <main className="meryo-cover__main">
        <section className="meryo-cover__hero" aria-labelledby="meryo-cover-title">
          <div className="meryo-cover__copy">
            <p className="meryo-cover__eyebrow">MERYO · CUIDADO PERSONAL</p>
            <h1 id="meryo-cover-title">Encuentra tu próximo estilo.</h1>
            <p>Explora profesionales, conoce su trabajo y solicita tu cita.</p>
          </div>

          <div className="meryo-cover__entry-grid" aria-label="Elige qué explorar">
            <article className="meryo-cover__entry meryo-cover__entry--barber">
              <div className="meryo-cover__portrait">
                <img src={barberPhoto} alt="Imagen ilustrativa de un barbero profesional" fetchPriority="high" decoding="async" />
              </div>
              <div className="meryo-cover__entry-copy">
                <h2>Barberías</h2>
                <p>Encuentra el corte y el profesional para tu estilo.</p>
                <button type="button" onClick={() => explore('barberia')}>Explorar barberías</button>
              </div>
            </article>
            <article className="meryo-cover__entry meryo-cover__entry--beauty">
              <div className="meryo-cover__portrait">
                <img src={beautyPhoto} alt="Imagen ilustrativa de una profesional de peluquería" loading="eager" decoding="async" />
              </div>
              <div className="meryo-cover__entry-copy">
                <h2>Peluquerías y salones</h2>
                <p>Descubre cuidado capilar y servicios de belleza.</p>
                <button type="button" onClick={() => explore('belleza')}>Explorar salones</button>
              </div>
            </article>
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
