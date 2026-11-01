import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import barberPhoto from '../assets/meryo-entry-barber-reference.png';
import beautyPhoto from '../assets/meryo-entry-beauty-reference.png';
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
          <h1 id="meryo-cover-title" className="meryo-cover__sr-only">Explora barberías y salones de belleza en MERYO</h1>
          <div className="meryo-cover__entry-grid" aria-label="Elige qué explorar">
            <article className="meryo-cover__entry meryo-cover__entry--barber">
              <div className="meryo-cover__portrait">
                <img src={barberPhoto} alt="Ilustración de perfil de un barbero" fetchPriority="high" decoding="async" />
              </div>
              <div className="meryo-cover__entry-copy">
                <h2>Barberías</h2>
                <p>Encuentra al profesional para tu próximo corte.</p>
                <button type="button" onClick={() => explore('barberia')}>Explorar barberías</button>
              </div>
            </article>
            <article className="meryo-cover__entry meryo-cover__entry--beauty">
              <div className="meryo-cover__portrait">
                <img src={beautyPhoto} alt="Ilustración de perfil de una profesional de peluquería" loading="eager" decoding="async" />
              </div>
              <div className="meryo-cover__entry-copy">
                <h2>Peluquerías y belleza</h2>
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
