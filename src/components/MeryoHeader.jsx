import MeryoLogo from './MeryoLogo';
import {NotificationBell} from './NotificationAccess';
import './MeryoHeader.css';

export function MeryoThemeToggle({mode='dark',onToggle,className='meryo-theme-toggle'}) {
  const nextMode=mode==='dark'?'claro':'oscuro';
  return <button type="button" className={className} onClick={onToggle} aria-label={`Activar modo ${nextMode}`} title={`Activar modo ${nextMode}`}>
    {mode==='dark'
      ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>
      : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.9 13A8.7 8.7 0 0 1 11 3.1 8.8 8.8 0 1 0 20.9 13Z"/><path d="M16.5 3.5v4m-2-2h4"/></svg>}
  </button>;
}

export default function MeryoHeader({
  variant = 'dark', cover = false, brandRef, onLogoError, onHome,
  onProfessional, onAccount, onNotifications, signedIn = false, loading = false,
  themeMode='dark', onToggleTheme,
}) {
  return (
    <header className={cover ? 'meryo-site-header meryo-site-header--cover' : 'meryo-site-header meryo-site-header--catalog'}>
      <nav className="meryo-header-row" aria-label="Cabecera de MERYO">
        <button type="button" ref={brandRef} className="meryo-header-brand" onClick={onHome} aria-label="MERYO, inicio">
          <MeryoLogo variant={variant} className="meryo-header-logo" onError={onLogoError} />
        </button>
        <button type="button" className="meryo-header-professional" onClick={onProfessional} disabled={loading}>Soy profesional</button>
        {!cover&&<MeryoThemeToggle mode={themeMode} onToggle={onToggleTheme}/>}
        <button type="button" className="meryo-header-account" onClick={onAccount} disabled={loading}>{signedIn ? 'Mi cuenta' : 'Ingresar'}</button>
        <NotificationBell onOpen={onNotifications} />
      </nav>
    </header>
  );
}
