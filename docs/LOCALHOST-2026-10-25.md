# MERYO en localhost aislado

**Actualización:** las pantallas integradas y restricciones vigentes están en `PANTALLAS-2026-10-25.md`. El banco separado y las rutas por actores/recibos descritas más abajo son históricos y ya no están disponibles en el servidor de la aplicación.

Continuación de `cc2f369`, reutilizando el cluster nativo y el contrato incremental que ya pasó las pruebas. No se creó un proyecto, cluster o contenedor nuevo. No se reinstalaron paquetes ni se repitieron las suites previas de reservas/operaciones/catálogo/servidor. No se consultó producción.

## Inicio

Desde `C:/Users/51934/OneDrive/Escritorio/barber-pro`, ejecutar `npm run dev`.

El script inicia, si está detenido, SOLO `%LOCALAPPDATA%/MERYO-tests/pg17-20261024`; comprueba que el destino sea `127.0.0.1:55440/meryo_test`, que exista el contrato previamente validado y no aplica migraciones automáticamente. No lee DATABASE_URL para elegir destino ni tiene fallback a producción. Al cerrar el proceso con Ctrl+C detiene el cluster si él lo inició. Si estaba encendido previamente, corresponde detenerlo explícitamente al acabar las pruebas.

- Interfaz MERYO existente: `http://127.0.0.1:5178/`.
- Banco local de reservas: `http://127.0.0.1:5178/tests/browser/reservations.html`.

El servidor escucha solo en loopback, puerto fijo 5178. No exponerlo a la red: usa actores sintéticos seleccionables, SIN autenticación real. La interfaz original conserva su diseño y sus operaciones comerciales bloqueadas. El banco separado permite verificar el contrato público preparado sin reescribir esa interfaz ni presentar una sesión de pruebas como Supabase Auth.

## Aislamiento

En modo localtest, Vite sustituye el módulo remoto por `supabase.local.js`. El build falla si incluye el módulo remoto o el SDK Supabase. El módulo original también comprueba el hostname: en localhost/127.0.0.1/IPv6 loopback crea la fachada local antes de poder instanciar un cliente remoto, incluso si se sirve otro build.

La fachada solo lee el catálogo sintético desde una ruta relativa del servidor. Login, registro, RPC y mutaciones de la interfaz original devuelven error local y no envían credenciales ni operaciones a Supabase. No se emulan sesiones/JWT. La CSP del servidor local limita connect-src al propio origen/WebSocket local y bloquea otros servicios, imágenes externas, video externo e iframes. Esto puede dejar imágenes del diseño sin cargar; la distribución y estilos se conservan. Los intentos antiguos de leer la vista eliminada de reservas quedan bloqueados, no se interpretan como una agenda válida.

El servidor tiene un conjunto cerrado de rutas SQL parametrizadas para agenda/solicitud/respuesta/cancelación/recibo sintético. Rechaza orígenes ajenos y POST sin encabezado local. No acepta SQL arbitrario ni URLs de conexión de la petición. Solo inserta la fixture con IDs reservados 900001/900002 y usuarios 2000…; no vacía tablas ni borra registros anteriores. Activa reservas y entorno staging SOLO en el PostgreSQL local. Conserva las reservas creadas durante las pruebas para inspección.

El recibo LOCAL llama al contrato exclusivo de servidor con proveedor `localhost-fixture`, entorno no-live y `charged:false`. No existe conexión de ese servidor a una pasarela. Es una simulación para comprobar el contrato; no prueba un cargo, firma de webhook ni conciliación reales. No debe desplegarse este banco/servidor. No se habilitaron reservas ni pagos en producción.

## Verificado en esta continuación

`npm run test:local` pasó seis pruebas contando su agrupadora: fachada sin envíos de Auth/mutaciones; CSP y módulo local servidos; solicitud → aceptación manual → recibo sintético → confirmada por PostgreSQL; rechazo de barbero ajeno/aislamiento de cliente; dos solicitudes HTTP simultáneas con un ganador y liberación por rechazo; expiración por temporizador del servidor sin navegador. Para comprobar el temporizador se adelantó exclusivamente el vencimiento de la reserva sintética creada por esa prueba, sin esperar otros cinco minutos ni alterar registros existentes.

`npm run build:local` y ESLint aprobados. Se comprobó además que el build local no incluye la URL ni clave del cliente remoto. Las verificaciones nuevas cubren la configuración/HTTP que se acaba de añadir: no sustituyen ni repiten las suites previas. La comprobación del recorrido fue por HTTP, no una prueba completa de la interfaz original en navegador. El banco JSX se compiló con el servidor Vite. Al cerrar el bloque se detuvieron servidor y PostgreSQL del proyecto.

## Límites y siguiente bloqueo

- **Supabase Auth:** este PostgreSQL contiene una tabla auth.users y auth.uid de fixture. No hay servicio GoTrue validando registro, correo, contraseñas, JWT, expiración de sesión ni revocación. Hace falta un entorno con Supabase Auth y sus endpoints/credenciales de pruebas, más PostgREST para comprobar RLS bajo JWT reales. El encabezado de actor local es solo una herramienta de pruebas.
- **Storage:** el snapshot conserva bucket/políticas, pero no se inició Storage API ni un almacén de archivos. Hace falta el servicio Storage y almacenamiento de pruebas para verificar subida/descarga, MIME/tamaño y rutas por barbería. SQL no demuestra esos controles de extremo a extremo.
- **Realtime:** el temporizador local no es Realtime. No se inició el servicio de replicación/WebSocket de Supabase. Hace falta ese servicio, publicación/configuración y JWT de pruebas para comprobar suscripciones, filtros y permisos reales.
- **Notificación al celular:** sigue pendiente demostrar llegada al teléfono con aplicación cerrada y sonido. Ni el correo ni este temporizador lo satisfacen. No se añadió otro canal.

Permanece la limitación de la referencia parcial: precisión/escala y parámetros de secuencias originales no recuperados; la prueba usa la estructura local que ya estaba preparada, no certifica equivalencia completa con el backend remoto. El siguiente bloqueo para validar los servicios citados es disponer de esos servicios Supabase en un entorno separado de pruebas; no hace falta contratar otro proyecto para continuar usando este banco PostgreSQL. No se levantaron servicios adicionales ni se hizo push/despliegue.
