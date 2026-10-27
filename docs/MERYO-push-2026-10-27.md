# Push web: implementación y alcance de la comprobación

Base conservada: 96d5ab5. URL preparada: https://barber-pro-phi-taupe.vercel.app/#notifications . No se cambió el diseño, Google, MFA, RLS, modelo mensual ni los plazos de reservas. Cobros bloqueados.

## Envío y permisos

- Se reutiliza la cola transaccional de notificaciones y las relaciones de reservas/equipo existentes. Una solicitud genera el aviso del barbero asignado y conserva el aviso del propietario en su panel. Aceptar produce el mensaje de diez minutos al cliente; rechazo y vencimiento generan sus avisos persistentes y push.
- La base conserva quince minutos para responder y diez para pagar. TTL del push limitado al vencimiento; se descartan solicitudes y aceptaciones obsoletas. Ningún aviso confirma una reserva ni verifica un pago.
- Endpoints y claves de suscripción permanecen en meryo_private. La sesión real vincula el dispositivo a auth.uid(); no se puede reutilizar el endpoint de otra cuenta. Máximo cinco dispositivos por cuenta. Desde la migración 018, registrar y consultar el dispositivo propio requiere sesión real AAL1, también para una cuenta con rol administrativo. Consultar evidencia diagnóstica y solicitar pruebas exige administración real con MFA/AAL2 del servidor.
- La cola solo permite destinatarios relacionados con la reserva o una comprobación propia expresamente solicitada. Los clientes no pueden escribir notificaciones, leer secretos del emisor ni invocar el despachador privado.
- Supabase pg_net despierta el endpoint protegido de Vercel después del commit. pg_cron reintenta cada minuto, independientemente de la PC y del navegador. El trabajo previo de vencimientos continúa activo. Fallar el despertar no revierte la reserva: la cola queda persistida.
- Leases, hasta cinco intentos con espera creciente, registro por evento/endpoint y eliminación de suscripciones 404/410. Las entregas ya aceptadas no se reenvían al reintentar otros endpoints. Topic estable y hasta 200 marcadores de entrega en el Service Worker reducen duplicados. No se promete entrega exactamente una vez ante cualquier fallo de red.
- El emisor usa VAPID/Web Push, sin contratar proveedor adicional. Secretos únicamente en variables privadas del servidor y configuración privada. TLS PostgreSQL conserva verificación de certificado.

## Pantallas y recepción

La página personal Avisos muestra permiso del navegador, vinculación real del endpoint a la cuenta y avisos guardados. No incluye controles de prueba, detalles del emisor ni requisitos de MFA administrativo. La evidencia separada (proveedor aceptó, Service Worker reportó mostrar y usuario abrió) y el envío de diagnóstico propio quedan en `/?admin_view=avisos#admin`, protegido por el administrador y MFA existentes. La interfaz no interpreta la aceptación del proveedor como recepción humana.

Las notificaciones abren la cita por ID protegido por RLS. Si falta sesión, el login de Google conserva ese destino. Una cuenta distinta no obtiene datos de la cita. El aviso de diagnóstico abre el diagnóstico administrativo protegido, no crea una reserva ficticia. Este diagnóstico espera treinta segundos desde el servidor para permitir cerrar MERYO; requiere intervención real en el celular. Puede programarse desde la PC con MFA para los dispositivos de esa misma cuenta, aunque la PC no tenga una suscripción.

Se solicita sonido estándar y vibración mediante silent:false. El sistema operativo, canales de Chrome, silencio y No molestar deciden el resultado; el audio dentro de una página no cuenta como sonido externo.

## Evidencia técnica

- `tests/push-native.test.mjs`: cinco comprobaciones con Auth, roles y reservas nativas reales; transporte simulado explícitamente para probar destinatarios, aceptación, rechazo, vencimiento, reintentos, limpieza 410, acuses y no duplicar endpoints ya aceptados. No es prueba de celular.
- `tests/push-diagnostic-native.test.mjs`: MFA real del administrador sintético, diagnóstico solo propio, demora del servidor y ausencia de reservas creadas.
- `tests/push-web.test.mjs`: enlace conservado al pasar por OAuth, autenticación del despachador y deduplicación/acuse/apertura del Service Worker. No es recepción física.
- pg_net y pg_cron oficiales en PostgreSQL 17 aislado, sin Docker: https://github.com/leonardvictorromerocrespo-create/Barber-pro/actions/runs/40534975745 . HTTP solo después del commit, reintento programado y permisos privados comprobados.
- Copia externa previa descargada y restaurada: https://github.com/leonardvictorromerocrespo-create/Barber-pro/actions/runs/40531730090 . Sesenta y seis tablas y cero objetos de Storage. Migraciones 016 y 017 preservaron los registros de negocio.
- Build local/Vercel aprobado. El primer empaquetado excluía server/ y el endpoint fallaba; se pausó el emisor y se corrigió la inclusión de sus tres dependencias. La comprobación alojada posterior devolvió 401 sin credencial y 200 con ella. Todavía no equivalía a recepción en teléfono.
- En producción se observaron respuestas HTTP 200 del endpoint protegido a solicitudes reales de pg_net/pg_cron (IDs 11, 12 y 13), sin error de red. El servidor está habilitado; esto tampoco demuestra recepción física. Despliegue final: `dpl_2UEPpdSiXe1fPqjrHxKvHxxWo8MV`.
- El respaldo posterior a pg_net y las migraciones también se descargó y restauró: https://github.com/leonardvictorromerocrespo-create/Barber-pro/actions/runs/40537254629 . Sesenta y siete tablas, cero objetos de Storage existentes; se conserva el workflow externo diario.

## Prueba física pendiente

### Corrección posterior al intento fallido

El primer intento del usuario en Android/Chrome falló con emisor aparentemente deshabilitado, falta de suscripción y `AbortError: Lock broken by another request with the 'steal' option`. No hubo recepción comprobada.

- La carga agrupada ocultaba la configuración pública si fallaba una consulta privada. Ahora son independientes y solo se informa emisor deshabilitado ante un valor explícito del servidor.
- El SDK instalado recuperaba Web Locks usando `steal`. Se conserva exclusión entre pestañas con un lock que nunca roba otro bloqueo; la espera vencida usa el error de timeout compatible con Auth. El sondeo es secuencial, evita autenticaciones repetidas y no acepta resultados de una cuenta anterior.
- La migración 018 separó consentimiento personal y diagnóstico administrativo. Se ensayó con rollback sobre la copia alojada restaurada de 67 tablas y se aplicó conservando las huellas de datos de negocio y la definición de `es_admin()`.
- Pruebas afectadas aprobadas: mutex/timeout de Auth (3), acceso push con Auth/TOTP reales (1), pantallas, enlaces y Service Worker, y pruebas nativas de cola/diagnóstico en secuencia (6). Build local y Vercel aprobados. No equivalen a recepción física.
- Commits de corrección: `eafbd7d` y `b25bb64`. Despliegue: `dpl_AcpMKNF5weZueSURfaoSo58nFBzz`. Comprobación publicada 2026-10-27 19:49 UTC: emisor habilitado, cobros deshabilitados, registro personal sin MFA administrativo, diagnóstico con MFA, cero dispositivos registrados. Pantalla pública posterior mostró activación disponible y ningún diagnóstico ni error de emisor.
- Reintento solicitado: cerrar pestañas antiguas en Android, abrir `/?v=push18#notifications`, activar con Google sin MFA administrativo y avisar al vincular/cerrar/bloquear el celular. No se borran credenciales ni datos del navegador.

Dispositivo declarado por el usuario: Android con Chrome; modelo y versión aún no informados. Se solicitó abrir Avisos, permitir notificaciones, programar la comprobación propia, cerrar todas las pestañas MERYO, bloquear pantalla y tocar el aviso al recibirlo. Debe confirmarse si sonó antes de abrir la aplicación. Hasta registrar acuse real y respuesta del usuario, recepción, sonido y condiciones quedan pendientes.

Al cerrar la implementación todavía había cero suscripciones en producción y ninguna comprobación propia solicitada desde el celular. No se generó una entrega ficticia para completar esta evidencia. El paso restante corresponde al usuario en su Android; el servidor y la pantalla ya están disponibles.

La comprobación diagnóstica de una cuenta administrativa no demuestra por sí sola el recorrido completo entre un cliente y un barbero en dos dispositivos reales. Los destinatarios de esos eventos están comprobados en el entorno aislado; no se inventaron barberías ni reservas en producción para suplir esa prueba.

## Google Play y App Store

La implementación actual es Web Push. Android/Chrome no equivale a una aplicación de Google Play terminada. Un proyecto nativo necesitará registro de dispositivo, permisos, firma y su integración correspondiente con [FCM para Android](https://firebase.google.com/docs/cloud-messaging/android/get-started).

En iPhone el [Web Push de WebKit requiere una web app compatible añadida a la pantalla de inicio](https://webkit.org/blog/13878/); no se comprobó esa instalación ni recepción en iPhone. Una app nativa de App Store requiere su registro y tokens de [APNs](https://developer.apple.com/documentation/usernotifications/registering-your-app-with-apns). Tampoco se eligió ni publicó un contenedor nativo. No se activó ninguna cuenta o servicio de pago.

## Pagos encontrados

No existe adaptador operativo de pasarela en el repositorio. `server/payments.mjs` es un límite neutral que exige verificar firma/notificación y consultar el pago autoritativo antes de confirmar. No hay SDK/configuración concreta de Culqi, Mercado Pago, Izipay, Niubiz, Stripe o PayPal en los módulos activos. Los intents alojados no tienen proveedor registrado y las variables del despliegue no incluyen una pasarela. No se implementó otra simulación.

Para integrar el adelanto falta decidir el modelo de comercios para múltiples barberías, validar la disponibilidad en Perú/PEN, onboarding y titularidad de cada comercio, costos completos, liquidación/devoluciones y compatibilidad contractual del proveedor. Después deberán implementarse checkout/intención del 50 %, webhook firmado, consulta autoritativa, idempotencia, conciliación de pagos tardíos y pruebas de sandbox. No se seleccionó proveedor ni se prometió reparto de fondos o costos sin cotización validada.
