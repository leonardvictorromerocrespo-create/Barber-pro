# Destino de avisos de reservas

Se conserva el push y sonido ya comprobados en Samsung A16, Google, MFA administrativo, RLS y diseño. No se reenviaron comprobaciones de transporte al celular ni se crearon reservas de prueba en producción. No hay nuevas migraciones ni cambios de datos alojados.

## Corrección

- Tanto Nueva solicitud como El barbero aceptó mantienen `/?cita=UUID#my-bookings`. Ese destino muestra únicamente el detalle autorizado de esa cita, con una salida a todas las citas. No abre diagnóstico ni Administración.
- Se valida el identificador como UUID, sin tratarlo como autorización. SQL/RLS existente decide qué reservas devuelve la instantánea. Una cuenta ajena ve que la cita no está disponible, sin datos del destinatario.
- El identificador prevalece sobre un destino administrativo residual al regresar de OAuth. Google conserva la cita y descarta `admin_view` cuando hay una cita válida. Correo/contraseña regresa a la misma cita. El detalle se conserva también durante el cambio de hash después del acceso.
- Sin sesión, se ofrece el acceso existente Google/correo; no se exige MFA administrativo al cliente o al barbero asignado. Administración conserva su puerta de rol real y MFA/AAL2, sin cambios.
- La solicitud muestra Aceptar/Rechazar solo con `puede_responder` del servidor y conserva 15 minutos. La aceptación usa exclusivamente el vencimiento de pago actual del servidor (10 minutos), mostrando importe del 50 %. Al llegar a cero se bloquea la respuesta y se consulta el estado actual; el navegador no expira ni confirma una cita.
- Cancelación, rechazo y vencimiento se muestran desde la consulta actual, sin reutilizar el estado del texto antiguo de la notificación.
- El botón del adelanto permanece deshabilitado. No hay checkout ni simulación. La consulta comercial a Mercado Pago sigue pendiente del usuario; no se eligió proveedor ni se habilitaron cobros.

## Comprobación del bloque

- `tests/booking-link.test.mjs`: tres casos: destino de cita prevalece durante OAuth; vencimiento según estado actual; apertura de Nueva solicitud y aceptación en una ventana ya abierta en Administración sin heredar ese destino. La ejecución del Service Worker es aislada, no un envío físico nuevo.
- `tests/booking-link-screen.test.mjs`: regresión del detalle durante el hash de login y ausencia de MFA administrativo en el acceso normal.
- `tests/booking-link-native.test.mjs`: Auth y PostgREST reales sobre el PostgreSQL nativo existente. Cliente/barbero AAL1, lectura denegada para tercero y anónimo, respuesta no autorizada denegada, aceptación real, 900/600 segundos, 50 %, cancelación y vencimiento actuales. No prueba ni escribe en Supabase alojado. Las reservas aisladas reutilizadas para pantallas se cancelan al terminar.
- Build de producción aprobado (108 módulos; aviso existente de tamaño del bundle).
- Pantallas locales: enlace ajeno sin detalle; enlace sin sesión → Google/correo; correo con cuenta real de prueba → misma cita; cliente ve solo su detalle aceptado, cuenta regresiva y adelanto bloqueado; cancelada muestra el estado actual sin pago; barbero asignado regresa a la solicitud con Aceptar/Rechazar y responde desde la pantalla. Sin MFA administrativo.
- Evidencia local privada: `MERYO-tests/proofs/booking-link-client.png` y `booking-link-barber.png`. No son capturas del Samsung ni evidencia de cobro.

La llegada/sonido físicos siguen respaldados por la comprobación anterior. Este bloque verifica destino, permisos, Auth y acciones en entorno aislado. No se afirma que se haya completado un cobro ni una reserva comercial entre dos celulares.

## Publicación

Commit funcional `b0f2b32`, Vercel `dpl_DQ6D4634xhVz7WWD4nEEJNm7jEGE`, promovido al dominio existente https://barber-pro-phi-taupe.vercel.app . Lectura pública 2026-10-27 20:13 UTC: HTTP 200, asset `/assets/index-uIWX243L.js`, detalle, retorno a la misma cita y adelanto bloqueado presentes. Sin migraciones ni escrituras de datos en producción. Las reservas de esta comprobación aislada quedaron liberadas y se detuvo solo el PostgreSQL/Auth/PostgREST local del proyecto. Evidencia de publicación privada: `booking-link-publication-proof.json`.
