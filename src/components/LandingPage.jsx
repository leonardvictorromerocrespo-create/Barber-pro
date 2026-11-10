import {useEffect, useRef, useState} from 'react';
import PortraitLight from './PortraitLight';
import barberPhoto from '../assets/meryo-entry-barber-reference.png';
import beautyPhoto from '../assets/meryo-entry-beauty-reference.png';
import MeryoHeader from './MeryoHeader';
import WelcomeOnboarding, {shouldShowWelcome} from './WelcomeOnboarding';
import './LandingPage.css';

export default function LandingPage({setView, onExplore, profile=null, identityLoading=false, onSignIn, onAccount, onProfessionalAccess}) {
  const [showWelcome, setShowWelcome] = useState(shouldShowWelcome);
  const [selected, setSelected] = useState(null);
  const selection = useRef(null);
  const navigationTimer = useRef(null);
  useEffect(() => () => window.clearTimeout(navigationTimer.current), []);
  const explore = category => {
    if (selection.current) return;
    selection.current = category;
    setSelected(category);
    const navigate = () => onExplore ? onExplore(category) : setView('client');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) navigate();
    else navigationTimer.current = window.setTimeout(navigate, 820);
  };
  const enterAccount=()=>profile?onAccount?.():onSignIn?.();

  if (showWelcome) return <WelcomeOnboarding onFinish={() => setShowWelcome(false)} />;

  return (
    <div className="meryo-cover">
      <MeryoHeader cover
        signedIn={Boolean(profile)} loading={identityLoading}
        onHome={()=>setView('landing')} onProfessional={onProfessionalAccess}
        onAccount={enterAccount} onNotifications={()=>setView('notifications')}
      />

      <main className="meryo-cover__main">
        <section className="meryo-cover__hero" aria-labelledby="meryo-cover-title">
          <h1 id="meryo-cover-title" className="meryo-cover__sr-only">Explora barberías y salones de belleza en MERYO</h1>
          <div className="meryo-cover__entry-grid" aria-label="Elige qué explorar">
            <article className={`meryo-cover__entry meryo-cover__entry--barber${selected==='barberia'?' is-selected':''}`}>
              <div className="meryo-cover__portrait">
                <PortraitLight category="barberia" source={barberPhoto} /><img src={barberPhoto} alt="Ilustración de perfil de un barbero" fetchPriority="high" decoding="async" />
              </div>
              <div className="meryo-cover__entry-copy">
                <h2>Barberías</h2>
                <p>Encuentra al profesional para tu próximo corte.</p>
                <button type="button" aria-busy={Boolean(selected)} disabled={Boolean(selected)} onClick={() => explore('barberia')}>Explorar barberías</button>
              </div>
            </article>
            <article className={`meryo-cover__entry meryo-cover__entry--beauty${selected==='belleza'?' is-selected':''}`}>
              <div className="meryo-cover__portrait">
                <PortraitLight category="belleza" source={beautyPhoto} /><img src={beautyPhoto} alt="Ilustración de perfil de una profesional de peluquería" loading="eager" decoding="async" />
              </div>
              <div className="meryo-cover__entry-copy">
                <h2>Peluquerías y belleza</h2>
                <p>Descubre cuidado capilar y servicios de belleza.</p>
                <button type="button" aria-busy={Boolean(selected)} disabled={Boolean(selected)} onClick={() => explore('belleza')}>Explorar salones</button>
              </div>
            </article>
          </div>
        </section>
      </main>

      <footer className="meryo-cover__footer">
        <a href="/privacidad.html">Privacidad</a>
        <a href="/condiciones.html">Condiciones</a>
      </footer>
    </div>
  );
}
