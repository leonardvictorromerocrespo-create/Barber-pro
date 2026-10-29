import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LIMA_CENTRO } from '../lib/distritos';

// Read-only adaptation of ZIP MapView. No editing, URL injection or database calls.
export default function CatalogMap({ markers, location, onSelect,focusZoom=15,label='Mapa de barberías',mapHeight='h-[300px]' }) {
  const element = useRef(null), map = useRef(null), layer = useRef(null), select = useRef(onSelect);
  useEffect(() => { select.current = onSelect; }, [onSelect]);
  useEffect(() => {
    const instance = L.map(element.current, { scrollWheelZoom: false }).setView([LIMA_CENTRO.lat, LIMA_CENTRO.lng], 11);
    map.current = instance;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(instance);
    layer.current = L.layerGroup().addTo(instance);
    return () => { instance.remove(); map.current = null; layer.current = null; };
  }, []);
  useEffect(() => {
    if (!map.current) return;
    layer.current.clearLayers();
    markers.forEach(marker => {
      const popup = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = marker.title;
      const detail = document.createElement('p'); detail.textContent = marker.detail;
      const button = document.createElement('button'); button.textContent = 'Ver barbería';
      button.type = 'button'; button.addEventListener('click', () => select.current(marker.id));
      popup.append(title, detail);if(select.current)popup.append(button);
      L.circleMarker([marker.lat, marker.lng], { radius: 9, color: '#fbbf24', fillOpacity: 0.8 }).addTo(layer.current).bindPopup(popup);
    });
    const points = markers.map(marker => [marker.lat, marker.lng]);
    if (location) {
      L.circleMarker([location.lat, location.lng], { radius: 7, color: '#3b82f6', fillOpacity: 1 }).addTo(layer.current).bindTooltip('Tu ubicación');
      points.push([location.lat, location.lng]);
    }
    if (points.length) map.current.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: focusZoom });
    else map.current.setView([LIMA_CENTRO.lat, LIMA_CENTRO.lng], 11);
  }, [markers, location,focusZoom]);
  return <div ref={element} className={`relative z-0 ${mapHeight} w-full rounded-2xl`} role="region" aria-label={label} />;
}
