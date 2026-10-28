# MERYO: perfil público y avisos de cuenta

## Alcance

- El perfil público muestra la dirección guardada y el mapa Leaflet únicamente cuando existen coordenadas válidas. El visitante no necesita geolocalización; no se inventa un punto inicial. “Cómo llegar” abre Google Maps con el destino guardado.
- Las cuentas autenticadas reciben una tarjeta discreta para activar avisos: “Activar” solicita el permiso oficial y registra el dispositivo; “Ahora no” queda aplazado por cuenta y navegador. Un dispositivo ya vinculado no vuelve a recibir la oferta. Si el navegador bloqueó el permiso, el mensaje dirige a Mi cuenta → Notificaciones.
- Mis citas conserva estados, vencimientos y acciones de negocio, pero ya no muestra controles de diagnóstico, activación técnica ni textos de planes, mensualidades o suscripciones. La campana mantiene el acceso a los avisos.

## Verificación

Se ejecutó `npm run build` y las pruebas afectadas de ubicación, oferta de avisos, render de notificaciones, polling visible y guardas de inactividad. Resultado: 8 pruebas pasaron y 1 fue omitida porque requiere un entorno nativo; no se modificó producción durante la verificación local.

Los cobros y la tienda permanecen fuera de este bloque. La integración de Mercado Pago continúa bloqueada hasta confirmar sus condiciones y la verificación de pago del servidor.
