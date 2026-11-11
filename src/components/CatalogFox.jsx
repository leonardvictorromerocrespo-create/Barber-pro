import {useEffect, useRef} from 'react';
import sprite from '../assets/catalog-fox.webp';
import './CatalogFox.css';

const seenKey = 'meryo.catalog-fox.seen.v1';
let seenHere = false;

export default function CatalogFox() {
  const actor = useRef(null);
  const words = useRef(null);
  useEffect(() => {
    if (seenHere) return;
    try { if (localStorage.getItem(seenKey)) return; } catch { /* In-memory fallback. */ }
    const node = actor.current;
    const area = node.parentElement;
    let stopped = false;
    let animation;
    let timer;
    const stop = () => {
      stopped = true;
      node.hidden = true;
      animation?.cancel();
      window.clearTimeout(timer);
    };
    async function start() {
      const image = new Image();
      image.src = sprite;
      try { await image.decode(); } catch { return; }
      if (stopped || seenHere) return;
      const turn = area.querySelector('.meryo-turn-finder__trigger');
      const map = area.querySelector('.meryo-catalog-map-control > button');
      if (!turn || !map) return;
      const areaBox = area.getBoundingClientRect();
      const from = turn.getBoundingClientRect();
      const to = map.getBoundingClientRect();
      const size = 58;
      const clamp = x => Math.max(0, Math.min(areaBox.width - size, x));
      const x = clamp(from.left - areaBox.left + 3);
      const mx = clamp(to.left - areaBox.left + (to.width - size) / 2);
      const y = from.top - areaBox.top - size + 4;
      const my = to.top - areaBox.top - size + 4;
      const place = (left, top) => `translate3d(${left}px, ${top}px, 0)`;
      seenHere = true;
      try { localStorage.setItem(seenKey, '1'); } catch { /* In-memory fallback. */ }
      node.style.transform = place(x, y);
      node.hidden = false;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced || !node.animate) {
        timer = window.setTimeout(stop, 3200);
        return;
      }
      node.dataset.pose = 'walk';
      animation = node.animate([
        {transform: place(x, y), offset: 0},
        {transform: place(Math.max(x, Math.min(mx - 48, areaBox.width - 145)), y), offset: .50},
        {transform: place(mx - 22, Math.min(y, my) - 24), offset: .62},
        {transform: place(mx, my), offset: .73},
        {transform: place(mx, my), opacity: 1, offset: .89},
        {transform: place(clamp(areaBox.width - size), my - 8), opacity: 0, offset: 1},
      ], {duration: 4700, fill: 'forwards'});
      timer = window.setTimeout(() => {
        node.dataset.pose = 'jump';
        timer = window.setTimeout(() => {
          node.dataset.pose = 'wave';
          words.current.textContent = '¡Nos vemos!';
        }, 1080);
      }, 2350);
      animation.onfinish = stop;
    }
    void start();
    window.addEventListener('resize', stop, {once: true});
    area.addEventListener('pointerdown', stop, {capture: true, once: true});
    return () => {
      stop();
      window.removeEventListener('resize', stop);
      area.removeEventListener('pointerdown', stop, true);
    };
  }, []);

  return <div ref={actor} className="meryo-catalog-fox" hidden aria-hidden="true">
    <div ref={words} className="meryo-catalog-fox__speech">Bienvenido a MERYO, plataforma de barberías.</div>
    <div className="meryo-catalog-fox__sprite" style={{backgroundImage: `url(${sprite})`}} />
  </div>;
}
