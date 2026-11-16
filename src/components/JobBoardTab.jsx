import {useEffect,useState} from 'react';

export default function JobBoardTab({onOpen}){
  const [entered,setEntered]=useState(false);
  const [collapsed,setCollapsed]=useState(false);
  useEffect(()=>{
    const frame=requestAnimationFrame(()=>setEntered(true));
    const timer=window.setTimeout(()=>setCollapsed(true),4200);
    return()=>{cancelAnimationFrame(frame);window.clearTimeout(timer);};
  },[]);
  const transform=!entered?'translateX(100%)':'translateX(0)';
  return <button
    type="button"
    onClick={onOpen}
    aria-label="Abrir bolsa de trabajo"
    title="Bolsa de trabajo"
    className="meryo-job-board-tab"
    style={{transform,width:collapsed?'2.85rem':'13rem'}}
  >
    <span className="meryo-job-board-tab__label" style={{opacity:collapsed?0:1}}>Bolsa de trabajo</span>
    <span className="meryo-job-board-tab__arrow" aria-hidden="true">&gt;</span>
  </button>;
}
