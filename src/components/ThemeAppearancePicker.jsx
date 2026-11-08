import { useEffect, useRef, useState } from 'react';
import { THEME_APPEARANCES } from '../lib/theme-appearances';
import './ThemeAppearancePicker.css';

export default function ThemeAppearancePicker({ category = 'barberia', appearance, onSelect }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const options = THEME_APPEARANCES[category] || THEME_APPEARANCES.barberia;
  const categoryLabel = category === 'belleza' ? 'Peluquerías y Belleza' : 'Barberías';

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = event => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeEscape = event => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeEscape);
    };
  }, [open]);

  return <div className="meryo-appearance-picker" ref={rootRef}>
    <button
      type="button"
      className="meryo-appearance-trigger"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={`meryo-appearance-options-${category}`}
      onClick={() => setOpen(value => !value)}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.64 5.64l12.72 12.72m0-12.72L5.64 18.36"/></svg>
      <span>Apariencia</span>
    </button>
    {open&&<section
      id={`meryo-appearance-options-${category}`}
      className="meryo-appearance-panel"
      role="dialog"
      aria-label={`Apariencia de ${categoryLabel}`}
    >
      <p className="meryo-appearance-heading">Apariencia de {categoryLabel}</p>
      <div className="meryo-appearance-options" role="group" aria-label="Paletas disponibles">
        {options.map(option=><button
          key={option.id}
          type="button"
          className={`meryo-appearance-option${appearance===option.id?' is-selected':''}`}
          aria-pressed={appearance===option.id}
          onClick={()=>{onSelect(option.id);setOpen(false);}}
        >
          <span className="meryo-appearance-swatches" aria-hidden="true">{option.colors.map(color=><i key={color} style={{backgroundColor:color}}/>)}</span>
          <span className="meryo-appearance-option-name">{option.label}</span>
          {appearance===option.id&&<span className="meryo-appearance-current">Actual</span>}
        </button>)}
      </div>
    </section>}
  </div>;
}
