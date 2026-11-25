import {useEffect,useId,useRef,useState} from 'react';
import {DISTRITOS} from '../lib/distritos';

const fieldClass='meryo-catalog-field min-h-10 min-w-0 rounded-lg px-3 py-2 text-sm';

function DistrictPicker({district,onDistrict,districtPrompt}) {
  const [open,setOpen]=useState(false);
  const selectedIndex=Math.max(0,DISTRITOS.indexOf(district)+1);
  const [activeIndex,setActiveIndex]=useState(selectedIndex);
  const pickerRef=useRef(null);
  const triggerRef=useRef(null);
  const optionRefs=useRef([]);
  const listboxId=useId();
  const options=[{value:'',label:districtPrompt},...DISTRITOS.map(value=>({value,label:value}))];

  useEffect(()=>{
    if(!open)return undefined;
    const closeOnOutsideClick=event=>{
      if(!pickerRef.current?.contains(event.target))setOpen(false);
    };
    const focusActiveOption=window.requestAnimationFrame(()=>optionRefs.current[activeIndex]?.focus());
    document.addEventListener('pointerdown',closeOnOutsideClick);
    return ()=>{
      window.cancelAnimationFrame(focusActiveOption);
      document.removeEventListener('pointerdown',closeOnOutsideClick);
    };
  },[open,activeIndex]);

  const closePicker=({restoreFocus=false}={})=>{
    setOpen(false);
    if(restoreFocus)window.requestAnimationFrame(()=>triggerRef.current?.focus());
  };
  const moveActiveOption=(index)=>{
    const next=Math.max(0,Math.min(options.length-1,index));
    setActiveIndex(next);
    optionRefs.current[next]?.focus();
  };
  const handleOptionKeyDown=(event,index)=>{
    if(event.key==='ArrowDown'){event.preventDefault();moveActiveOption(index+1);}
    else if(event.key==='ArrowUp'){event.preventDefault();moveActiveOption(index-1);}
    else if(event.key==='Home'){event.preventDefault();moveActiveOption(0);}
    else if(event.key==='End'){event.preventDefault();moveActiveOption(options.length-1);}
    else if(event.key==='Escape'){event.preventDefault();closePicker({restoreFocus:true});}
  };

  return <div ref={pickerRef} className={`meryo-district-picker min-w-0 flex-1${open?' is-open':''}`}>
    <button ref={triggerRef} type="button" className="meryo-catalog-field meryo-district-trigger min-h-10 w-full rounded-lg px-3 py-2 text-sm"
      aria-label={`Distrito: ${district||districtPrompt}`} aria-haspopup="listbox" aria-expanded={open} aria-controls={listboxId}
      onClick={()=>{setActiveIndex(selectedIndex);setOpen(value=>!value);}}>
      <span className="truncate">{district||districtPrompt}</span>
      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m5 7.5 5 5 5-5"/></svg>
    </button>
    {open&&<div id={listboxId} className="meryo-district-listbox" role="listbox" aria-label="Elige un distrito">
      {options.map((option,index)=><button key={option.value||'all-districts'} ref={element=>{optionRefs.current[index]=element;}}
        type="button" role="option" aria-selected={option.value===district} tabIndex={activeIndex===index?0:-1}
        className={`meryo-district-option${option.value===district?' is-selected':''}`}
        onFocus={()=>setActiveIndex(index)} onKeyDown={event=>handleOptionKeyDown(event,index)}
        onClick={()=>{onDistrict(option.value);closePicker({restoreFocus:true});}}>{option.label}</button>)}
    </div>}
  </div>;
}

export default function CatalogFilters({
  query,district,hasLocation,onQuery,onDistrict,onUseLocation,locationStatus='idle',
  showSearch=true,districtPrompt='Todos los distritos',businessLabel='barbería',businessPlural='barberías',
}) {
  return <section className="meryo-catalog-controls" aria-label={`Buscar ${businessPlural}`}>
    {showSearch&&<><label className="sr-only" htmlFor="meryo-catalog-search">Buscar {businessLabel} por nombre o distrito</label>
    <input id="meryo-catalog-search" type="search" autoComplete="off" value={query}
      onChange={event=>onQuery(event.target.value)} placeholder="Nombre del negocio o distrito"
      className={`${fieldClass} meryo-catalog-search w-full`}/></>}
    <div className="meryo-catalog-filter-row mt-2">
      <DistrictPicker district={district} onDistrict={onDistrict} districtPrompt={districtPrompt}/>
      {onUseLocation&&<button type="button" aria-label={locationStatus==='loading'?'Obteniendo ubicación':'Usar mi ubicación'} aria-pressed={hasLocation} aria-busy={locationStatus==='loading'} disabled={locationStatus==='loading'} onClick={onUseLocation} className="meryo-catalog-control-button min-h-10 min-w-0 flex-1 rounded-lg px-2 py-2 text-center text-[.8rem] font-semibold disabled:cursor-wait disabled:opacity-70"><svg className="meryo-catalog-location-icon hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>{locationStatus==='loading'?'Buscando…':hasLocation?'Ubicación encontrada':'Usar mi ubicación'}</button>}
    </div>
  </section>;
}
