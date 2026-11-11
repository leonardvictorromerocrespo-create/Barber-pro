import {useEffect, useRef} from 'react';
import sprite from '../assets/catalog-fox.webp';
import walkFrames from '../assets/catalog-fox-walk.webp';
import './CatalogFox.css';

const seenKey = 'meryo.catalog-fox.seen.v4';
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
      try {
        await Promise.all([sprite, walkFrames].map(src => {
          const image = new Image();
          image.src = src;
          return image.decode();
        }));
      } catch { return; }
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
      const walkMs = 3550;
      const hopMs = 1080;
      const duration = walkMs + hopMs + 1270;
      const landed = (walkMs + hopMs) / duration;
      animation = node.animate([
        {transform: place(x, y), offset: 0},
        {transform: place(Math.max(x, Math.min(mx - 48, areaBox.width - 196)), y), offset: walkMs / duration},
        {transform: place(mx - 22, Math.min(y, my) - 24), offset: (walkMs + hopMs * .52) / duration},
        {transform: place(mx, my), offset: landed},
        {transform: place(mx, my), opacity: 1, offset: (walkMs + hopMs + 750) / duration},
        {transform: place(clamp(areaBox.width - size), my - 8), opacity: 0, offset: 1},
      ], {duration, fill: 'forwards'});
      timer = window.setTimeout(() => {
        node.dataset.pose = 'jump';
        timer = window.setTimeout(() => {
          node.dataset.pose = 'wave';
          words.current.textContent = '¡Nos vemos!';
        }, hopMs);
      }, walkMs);
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
    <div className="meryo-catalog-fox__sprite" style={{'--fox-sheet': `url(${sprite})`, '--fox-walk': `url(${walkFrames})`}} />
  </div>;
}
