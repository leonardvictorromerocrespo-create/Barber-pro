import MeryoLogo from './MeryoLogo';
import {NotificationBell} from './NotificationAccess';
import './MeryoHeader.css';

export default function MeryoHeader({
  variant = 'dark', cover = false, brandRef, onLogoError, onHome,
  onProfessional, onAccount, onNotifications, signedIn = false, loading = false,
}) {
  return (
    <header className={cover ? 'meryo-site-header meryo-site-header--cover' : 'meryo-site-header meryo-site-header--catalog'}>
      <nav className="meryo-header-row" aria-label="Cabecera de MERYO">
        <button type="button" ref={brandRef} className="meryo-header-brand" onClick={onHome} aria-label="MERYO, inicio">
          <MeryoLogo variant={variant} className="meryo-header-logo" onError={onLogoError} />
        </button>
        <button type="button" className="meryo-header-professional" onClick={onProfessional} disabled={loading}>Soy profesional</button>
        <button type="button" className="meryo-header-account" onClick={onAccount} disabled={loading}>{signedIn ? 'Mi cuenta' : 'Ingresar'}</button>
        <NotificationBell onOpen={onNotifications} />
      </nav>
    </header>
  );
}
