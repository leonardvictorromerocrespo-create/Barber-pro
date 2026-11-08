import {useState} from 'react';
import barberPhoto from '../assets/meryo-entry-barber-reference.png';
import beautyPhoto from '../assets/meryo-entry-beauty-reference.png';
import MeryoHeader from './MeryoHeader';
import WelcomeOnboarding, {shouldShowWelcome} from './WelcomeOnboarding';
import './LandingPage.css';

export default function LandingPage({setView, onExplore, profile=null, identityLoading=false, onSignIn, onAccount, onProfessionalAccess}) {
  const [showWelcome, setShowWelcome] = useState(shouldShowWelcome);
  const explore = category => onExplore ? onExplore(category) : setView('client');
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
    </div>
  );
}
