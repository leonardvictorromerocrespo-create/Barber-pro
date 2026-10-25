# Referencia recuperada, no migración

Lectura autorizada del catálogo de `prdmcjykjpxpcomonwuy` mediante SQL Editor de Supabase, el 25 de octubre de 2026. Consulta dentro de `BEGIN READ ONLY` / `ROLLBACK`. No contiene filas de clientes, reservas, perfiles ni secretos. No ejecutar `functions.sql`: es una referencia del estado observado, que incluye defectos conocidos.

`schema.json` conserva columnas/defaults/identidad/nulabilidad, relaciones y ACL, constraints, índices, definiciones y ACL de 22 funciones de aplicación, triggers públicos y de Auth, políticas públicas/Storage, grants de tabla/columna y defaults, extensiones, bucket y cron, y publicación Realtime. `functions.sql` facilita revisar las funciones del mismo snapshot.

SHA256 de schema.json: `377EDDE779EF3DBC99AADF3736A7E3253A109DA75AB126E14B980DD3818D3AD5`.

El export inicial NO incluye precisión/escala de numeric, límites varchar, parámetros de secuencias ni valores comerciales actuales. Tampoco es un backup completo de Supabase Auth, Storage u objetos de extensiones. La lectura complementaria quedó pendiente al deshabilitarse el navegador local. No certificar una migración de producción con esta referencia parcial; completar y contrastar nuevamente antes de autorizar aplicación.

Estado observado: 12 tablas públicas, 22 funciones de aplicación; exclusión GiST de reservas activas por barbería/rango; cron `expirar-reservas` activo cada minuto; Realtime en reservas y notificaciones. Bucket público `barberias-media`, 50 MiB, JPG/PNG/WEBP/MP4/WEBM; escrituras por carpeta de barbería. Esto no constituye entrega externa de notificaciones ni verifica un proveedor de pagos.

La copia de pruebas recrea únicamente estructura pública en `meryo_test` (127.0.0.1:55440). Usa tipos numeric sin precisión por la limitación anterior y simula auth.uid/roles. No sustituye un E2E de Supabase ni valida redondeos del esquema real. Nunca restaurar esta fixture en producción.
