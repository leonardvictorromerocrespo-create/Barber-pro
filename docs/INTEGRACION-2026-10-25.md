# Bloque 1: integración selectiva de catálogo

Base: `67568fd`; rama `codex/integracion-selectiva-meryo`. Fuente consultada: `C:/Users/51934/Downloads/barber-pro/barber-pro`. No se reemplazó App completo ni el diseño MERYO.

Incorporado/adaptado: distritos, búsqueda sin distinguir tildes/mayúsculas, filtros por distrito, orden por calificación/precio/distancia, cálculo de distancias y fechas de Lima. El mapa Leaflet es de lectura: solo se carga a pedido, omite coordenadas ausentes/inválidas y abre el modal de perfil existente. No guarda ubicación. Usa las coordenadas opcionales de la consulta de catálogo ya existente; no presupone nuevas tablas/RPC. Leaflet 1.9.4 es la única dependencia añadida.

Autenticación, pruebas SQL, esquema candidato y configuración Supabase intactos. `reservationsEnabled` sigue en false. No se incorporaron `acepta_auto`, comisión porcentual, plazo de 15 minutos, regla de devolución de 3 horas ni RPC de pago simulado. No se contactó Supabase durante las pruebas del bloque.

Comprobaciones: build aprobado; nueve pruebas unitarias aprobadas (cinco existentes y cuatro nuevas); ESLint aprobado después de ajustar la exportación de la pantalla de pruebas. Navegador con fixture ficticia y aislada: búsqueda "rimac" encuentra "Rímac", mapa abre/cierra y su botón selecciona el perfil. El fixture no importa Supabase/Auth/App; su servidor bloquea conexiones de backend por CSP. Las pruebas de base de datos anteriores no se repitieron porque ese código no cambió.

Reproducir: `npm test`, `npm run lint`, `npm run build`. Prueba visual aislada: `node tests/browser/serve-catalog.mjs`, puerto 5176 en loopback; detener el proceso al finalizar. No usar datos reales en el fixture. El build del fixture solo escribe en `dist/catalog-check` (ignorado).

Pendiente: recuperar definiciones reales autorizadas de Supabase y contrastarlas antes de integrar escrituras. Nunca ejecutar `db/candidate` sobre el proyecto existente. Las reglas comerciales pendientes siguen pendientes y no se heredan del ZIP. El pago simulado no se incorpora a la aplicación comercial.
