import {useEffect,useState} from 'react';
import barberPhoto from '../assets/meryo-entry-barber-reference.png';
import beautyPhoto from '../assets/meryo-entry-beauty-reference.png';
import MeryoHeader from './MeryoHeader';
import JobBoardTab from './JobBoardTab';
import WelcomeOnboarding, {shouldShowWelcome} from './WelcomeOnboarding';
import './LandingPage.css';

const categoryCopy={
  barberia:{title:'barberías',action:'Buscar turnos de barbería',nearby:'Encuentra barberías cerca de ti',district:'Ver barberías por distrito'},
  belleza:{title:'salones de belleza',action:'Buscar horarios de salón',nearby:'Encuentra salones cerca de ti',district:'Ver salones por distrito'},
};

export default function LandingPage({setView, onExplore, onFindNearby, profile=null, identityLoading=false, onSignIn, onAccount, onProfessionalAccess, onJobs}) {
  const [showWelcome, setShowWelcome] = useState(shouldShowWelcome);
  const [nearbyCategory,setNearbyCategory]=useState('');
  const explore = category => onExplore ? onExplore(category) : setView('client');
  const enterAccount=()=>profile?onAccount?.():onSignIn?.();
  const nearby=category=>setNearbyCategory(category);
  useEffect(()=>{
    if(!nearbyCategory)return undefined;
    const onKeyDown=event=>{if(event.key==='Escape')setNearbyCategory('');};
    window.addEventListener('keydown',onKeyDown);
    return()=>window.removeEventListener('keydown',onKeyDown);
  },[nearbyCategory]);

  if (showWelcome) return <WelcomeOnboarding onFinish={() => setShowWelcome(false)} />;

  const selectedCategory=categoryCopy[nearbyCategory];

  return (
    <div className="meryo-cover">
      <MeryoHeader cover
        signedIn={Boolean(profile)} loading={identityLoading}
        onHome={()=>setView('landing')} onProfessional={onProfessionalAccess}
        onAccount={enterAccount} onNotifications={()=>setView('notifications')}
      />

      <JobBoardTab onOpen={onJobs}/>

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
                <div className="meryo-cover__entry-actions">
                  <button type="button" onClick={() => explore('barberia')}>Explorar barberías</button>
                  <button type="button" className="meryo-cover__nearby-button" onClick={() => nearby('barberia')}>Buscar turnos de barbería</button>
                </div>
              </div>
            </article>
            <article className="meryo-cover__entry meryo-cover__entry--beauty">
              <div className="meryo-cover__portrait">
                <img src={beautyPhoto} alt="Ilustración de perfil de una profesional de peluquería" loading="eager" decoding="async" />
              </div>
              <div className="meryo-cover__entry-copy">
                <h2>Peluquerías y belleza</h2>
                <p>Descubre cuidado capilar y servicios de belleza.</p>
                <div className="meryo-cover__entry-actions">
                  <button type="button" onClick={() => explore('belleza')}>Explorar salones</button>
                  <button type="button" className="meryo-cover__nearby-button" onClick={() => nearby('belleza')}>Buscar horarios de salón</button>
                </div>
              </div>
            </article>
          </div>
        </section>
      </main>

      <footer className="meryo-cover__footer">
        <a href="/privacidad.html">Privacidad</a>
        <a href="/condiciones.html">Condiciones</a>
      </footer>

      {selectedCategory&&<div className="meryo-nearby-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setNearbyCategory('');}}>
        <section className="meryo-nearby-dialog" role="dialog" aria-modal="true" aria-labelledby="meryo-nearby-title">
          <button type="button" className="meryo-nearby-close" aria-label="Cerrar" onClick={()=>setNearbyCategory('')}>×</button>
          <p className="meryo-nearby-eyebrow">MERYO · {nearbyCategory==='barberia'?'Barberías':'Peluquerías y belleza'}</p>
          <h2 id="meryo-nearby-title">{selectedCategory.nearby}</h2>
          <p className="meryo-nearby-copy">Permite usar tu ubicación para ordenar los negocios más cercanos. También puedes buscar por distrito.</p>
          <button type="button" className="meryo-nearby-primary" onClick={()=>{const category=nearbyCategory;setNearbyCategory('');onFindNearby?.(category);}}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>
            Usar mi ubicación
          </button>
          <button type="button" className="meryo-nearby-secondary" onClick={()=>{const category=nearbyCategory;setNearbyCategory('');explore(category);}}>
            {selectedCategory.district}
          </button>
          <p className="meryo-nearby-note">La ubicación solo se solicita si eliges esa opción.</p>
        </section>
      </div>}
    </div>
  );
}
