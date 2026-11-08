import {useState} from 'react';
import MeryoLogo from './MeryoLogo';
import mapBarber from '../assets/welcome-map-barber.jpg';
import barberScene from '../assets/welcome-barber-scene.jpg';
import beautyScene from '../assets/welcome-beauty-scene.jpg';
import mapSalons from '../assets/welcome-map-salons.jpg';
import './WelcomeOnboarding.css';

const SESSION_KEY = 'meryo.welcome.completed.v1';
let completedInThisPage = false;

export function shouldShowWelcome() {
  if (completedInThisPage) return false;
  try { return window.sessionStorage.getItem(SESSION_KEY) !== '1'; }
  catch { return true; }
}

const screens = [
  {
    image: mapBarber,
    imageAlt: 'Mapa ilustrado de Perú con ubicaciones de barberías y un barbero atendiendo a un cliente.',
    title: 'Planea tu próximo corte',
    description: 'Descubre barberías, elige tu servicio y consulta los horarios disponibles.',
    tone: 'map',
    imageType: 'map',
  },
  {
    image: barberScene,
    imageAlt: 'Un barbero corta el cabello de un cliente en una barbería luminosa.',
    title: 'Encuentra tu barbería favorita',
    description: 'Conoce sus servicios y solicita tu próxima cita.',
    tone: 'barber',
    imageType: 'photo',
  },
  {
    image: beautyScene,
    imageAlt: 'Una estilista peina a una clienta en un salón de belleza.',
    title: 'Tu estilo, en buenas manos',
    description: 'Descubre peluquerías y salones. Inspírate con sus trabajos.',
    tone: 'beauty',
    imageType: 'photo',
  },
  {
    image: mapSalons,
    imageAlt: 'Mapa ilustrado junto a imágenes de una barbería y un salón de belleza.',
    title: 'Tu próximo estilo, más cerca',
    description: 'Explora negocios, compara servicios y encuentra un turno.',
    tone: 'map',
    imageType: 'map',
  },
];

export default function WelcomeOnboarding({onFinish}) {
  const [index, setIndex] = useState(0);
  const screen = screens[index];
  const finish = () => {
    completedInThisPage = true;
    try { window.sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* Keep the current app session usable. */ }
    onFinish?.();
  };
  const advance = () => index === screens.length - 1 ? finish() : setIndex(value => value + 1);

  return (
    <main className={`meryo-welcome meryo-welcome--${screen.tone}`} aria-label="Bienvenida a MERYO">
      <div className="meryo-welcome__shell">
        <header className="meryo-welcome__header">
          <MeryoLogo variant="light" className="meryo-welcome__logo" />
          <button type="button" className="meryo-welcome__skip" onClick={finish}>Omitir</button>
        </header>
        <div className="meryo-welcome__stage" key={index}>
          <figure className={`meryo-welcome__visual meryo-welcome__visual--${screen.imageType}`}>
            <img
              src={screen.image}
              alt={screen.imageAlt}
              fetchPriority={index === 0 ? 'high' : 'auto'}
              decoding="async"
            />
          </figure>
          <section className="meryo-welcome__copy" aria-labelledby="meryo-welcome-title" aria-live="polite">
            <div className="meryo-welcome__copy-inner">
              <h1 id="meryo-welcome-title">{screen.title}</h1>
              <p>{screen.description}</p>
              <div className="meryo-welcome__steps" role="group" aria-label="Pantallas de bienvenida">
                {screens.map((item, itemIndex) => (
                  <button
                    key={item.title}
                    type="button"
                    className={itemIndex === index ? 'is-active' : ''}
                    aria-label={`Ir a la pantalla ${itemIndex + 1}: ${item.title}`}
                    aria-current={itemIndex === index ? 'step' : undefined}
                    onClick={() => setIndex(itemIndex)}
                  />
                ))}
              </div>
              <button type="button" className="meryo-welcome__next" onClick={advance}>
                {index === screens.length - 1 ? 'Explorar MERYO' : 'Siguiente'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
