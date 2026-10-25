# Backend recuperado y correcciones incrementales

Rama `codex/integracion-selectiva-meryo`, posterior a `07192ea`, sin reemplazar el diseño ni el código de autenticación existente. Producción solo se consultó en una transacción de lectura; ninguna de las migraciones nuevas se ejecutó allí. Docker no se utilizó.

## Referencia y límites

Se recuperó el catálogo real autorizado de Supabase y se versionó en `db/reference/supabase-2026-10-25`. Ya no dependemos de un archivo de Claude. Contiene tablas, funciones, restricciones, índices, triggers, RLS, permisos, Storage y cron. Ver README de la referencia para procedencia y hash.

El catálogo confirmó permiso TRUNCATE para roles de navegador en tablas públicas, además de permisos de secuencias excesivos. RLS no protege TRUNCATE. El pago de prueba estaba disponible para authenticated, y las dos funciones de confirmación antiguas no contrastaban importe/moneda/comerciante/plazo. La exclusión GiST existente sí impide reservas activas solapadas por barbería. No se probó ningún ataque en producción.

La lectura complementaria de tipos con precisión y configuración comercial actual no pudo descargarse: el acceso del navegador local aparece deshabilitado en Work. La primera referencia no permite certificar precisión/escala ni reconstruir Supabase completo. El usuario confirmó que no tiene staging ni proveedores de pruebas.

## Implementado y probado localmente

- `001_privileges_and_payment_lock.sql`: retira TRUNCATE/REFERENCES/TRIGGER/MAINTAIN y manipulación de secuencias a anon/authenticated; conserva permisos de edición de perfil/presentación y notificaciones por columna; cierra pago simulado y ambos endpoints de confirmación antiguos, también para service_role.
- `002_manual_booking_flow.sql`: conserva el contrato público existente, la exclusión y los RPC. Solicitud siempre manual incluso si la barbería tiene acepta_auto=true; plazo de respuesta fijo de cinco minutos, adelanto del 50 %, pago configurable inicialmente 300 segundos. Serializa el límite de solicitudes por perfil; usa reloj efectivo después de adquirir bloqueos. Cuentas inactivas no solicitan, reseñan ni leen reservas/pagos/avisos privados. Registro de barbería bloquea el perfil para evitar dos registros simultáneos. Cancelación con pago se bloquea hasta definir política y devoluciones; la cancelación sin pago sigue liberando el horario.
- `003_verified_payment_contract.sql`: registro de intención ligado a reserva/cliente/proveedor/referencia/comerciante/importe/moneda/entorno/método; confirmación solo por service_role; recibos idempotentes. Un pago tardío queda en conciliación y nunca revive un horario. Comisión de 100/200 céntimos o NULL pendiente; no se calcula porcentaje ni se reparten fondos. NULL sustituye la ambigüedad de registrar una comisión decidida como cero.
- `004_external_notification_outbox.sql` y `server/notifications.mjs`: cola transaccional de avisos al barbero, contactos privados verificados/con consentimiento, leases con SKIP LOCKED, reintentos acotados y clave idempotente. Descarta avisos de solicitudes vencidas o resueltas. Adaptador de correo Resend preparado; aceptación de su API se registra como accepted, nunca como prueba de entrega al buzón.
- `server/payments.mjs`: frontera independiente del proveedor. Exige verificación de notificación y consulta autoritativa antes de invocar SQL. Sin adaptador configurado falla cerrado. No hay proveedor simulado predeterminado ni creación de cobros reales.

`meryo_private` es infraestructura NUEVA propuesta por estas migraciones, no una tabla que se afirme existente. `launch_settings` nace con reservas deshabilitadas y entorno disabled. Comisión/criterio/cancelación/devolución/liquidación quedan pendientes. No habilitar esos controles solo porque pasen pruebas locales.

## Comprobaciones

PostgreSQL nativo en el cluster exclusivo `127.0.0.1:55440/meryo_test`, sin datos reales. La fixture reconstruye el contrato público observado con numeric sin precisión: valida transiciones, concurrencia y permisos, no redondeos del backend real ni Auth/JWT/PostgREST/Storage efectivos.

`npm run test:incremental`: 14 escenarios y su prueba contenedora aprobados. Solicitudes simultáneas (10 conexiones/1 ganador), límite por cliente concurrente, aceptación manual y plazos, expiración, deadline después de esperar un bloqueo, aislamiento, cuentas inactivas, intento/recibo verificado, importe/comerciante/moneda incorrectos, reenvío concurrente idempotente, pago tardío, rechazo de sandbox en modo producción, cancelación/pago simultáneos, rollback ante fallo de cola y cola con dos trabajadores sin duplicar lease. La entrega usa receptor sintético local; NO demuestra llegada externa.

`npm test`: 13 pruebas aprobadas, incluyendo las nueve anteriores sin reemplazarlas. Nuevas pruebas de la frontera de pago y adaptador/trabajador de correo. ESLint y build aprobados. No se repitió la suite de `db/candidate`: ese esquema no cambió ni se usó para estas migraciones. El cluster nativo se detiene al cerrar el bloque.

Reproducir: `powershell -File tests/setup-db.ps1`, `npm run test:incremental`; detener con `pg_ctl` como se documenta en `MERYO-estado-2026-10-24.md`. La nueva suite recrea SOLO public/auth/meryo_private en la base de pruebas fija. No ejecutar concurrentemente con `npm run test:db`, que utiliza la misma base. Las migraciones son secuenciales, de una aplicación; `002` comprueba hash de las funciones originales y se detiene si detecta deriva. El generador local `scripts/prepare-incremental.mjs` no conecta a ninguna base.

## Bloqueos concretos para lanzamiento

1. Recuperar la lectura complementaria con navegador autorizado habilitado, o conectar Supabase con lectura de metadatos. Contrastar de nuevo funciones y tipos antes de aplicar migraciones. La referencia descargada permite trabajar localmente mientras tanto.
2. Crear/conectar un Supabase de pruebas separado con datos sintéticos. No se creó un proyecto con compromisos de cuenta/facturación. Probar allí migraciones, Auth, RLS, Storage, cron y recuperación; después adaptar y validar la interfaz de reservas al contrato público. El frontend conserva `reservationsEnabled=false` y aún tiene rutas legadas que no se habilitan.
3. Elegir proveedor y titular que recibe el adelanto. Faltan creación de checkout, adaptador de firma/API, sandbox y pruebas de conciliación/reembolso. La frontera implementada no sustituye esas piezas. No hay proveedor real probado en el código recuperado.
4. Habilitar una cuenta de correo de pruebas con dominio remitente verificado y destinatario consentido; alojar/programar el trabajador fuera del navegador y demostrar entrega/bounce en un buzón real con la aplicación cerrada. Falta webhook de entrega firmado/monitorización y medición de latencia; correo por sí solo no garantiza recepción dentro de cinco minutos. WhatsApp/SMS requerirían su propia cuenta, consentimiento y validación de plantillas/costos.
5. Decidir criterio S/1 o S/2, cancelaciones, devoluciones, liquidación y reprogramación. No se implementa una reprogramación pagada ni se aplica la regla de tres horas del ZIP. No prometer una devolución antes de confirmar su ejecución por el proveedor.
6. E2E real separado con cliente/barbero, aplicación cerrada, fallos/reintentos, expiración automática, aceptación/pago concurrentes y webhook duplicado/tardío. Solo después se podrá solicitar autorización de despliegue/cobros. No se hizo push ni despliegue.

## Proveedores: decisión preparada, no contratación

Consulta de páginas oficiales el 25 de octubre de 2026. Reconfirmar el contrato específico antes de aceptar tarifas.

| Opción | Precio publicado y capacidad | Decisión pendiente |
|---|---|---|
| Culqi Online | Nacional/Yape 3,44 %, internacional 3,99 % y US$0,20 fijo para ventas Online. El tarifario indica un mínimo S/3,50 para montos menores a S/87,72 asociado a los conceptos con asterisco; confirmar su aplicación por método, no extrapolar a todos. [Tarifario](https://culqi.com/precios/) | Soporta API/cargos/órdenes; no se validó split para la cuenta MERYO. Solicitar confirmación comercial de mínimos por adelanto pequeño y capacidades marketplace antes de elegir. [API](https://docs.culqi.com/) |
| Mercado Pago Perú | Página de Checkout anuncia 3,49 % + S/1,00; comprobar plazos, impuestos y tarifa de la cuenta antes de presupuestar. [Checkout](https://www.mercadopago.com.pe/herramientas-para-vender/check-out) | Split 1:1 documentado; vendedor KYC6 y OAuth de cada barbería. Validar elegibilidad, medios y devoluciones antes de implementar reparto. [Requisitos](https://www.mercadopago.com.pe/developers/es/docs/split-payments/split-1-1/prerequisites) |
| Resend, correo | Gratis 3.000 correos/mes, tope 100/día; Pro US$20/mes por 50.000. Dominio verificado y configuración DNS requeridos. [Precios](https://resend.com/pricing) | Adaptador preparado para pruebas externas una vez conectada la cuenta. Idempotencia del proveedor 24h; TTL de la cola máximo una hora. [Documentación](https://resend.com/docs/dashboard/emails/idempotency-keys) |

Recomendación de evaluación: sandbox de Mercado Pago para validar la modalidad marketplace por barbería documentada; no supone contratar ni activar split. Si el piloto cobra en una única cuenta del negocio, confirmar primero titularidad y condiciones. Con una comisión MERYO de S/1 o S/2, el costo de la pasarela debe asignarse explícitamente: son conceptos diferentes y no se descuenta automáticamente del margen de MERYO.

## Continuación acotada: conexión de pruebas pendiente

Comprobación de acceso posterior a `c4acb82`: no hay conector Supabase disponible en esta sesión, CLI instalada, variables de entorno de Supabase/staging/base de datos ni configuración local de proyecto de pruebas en el repositorio. El navegador continúa deshabilitado en Work. No se consultó ni modificó producción, no se inició PostgreSQL/Docker y no se repitieron las pruebas aprobadas. No se pudo ejecutar todavía ninguna migración ni recorrido en un Supabase separado.

Acceso necesario: identificar un proyecto Supabase de pruebas separado (URL/ID) y proporcionar una conexión SQL configurada de forma privada con permisos para crear/alterar tablas, funciones, RLS, grants y jobs requeridos por las migraciones, además de insertar datos sintéticos. Para verificar Auth/JWT/PostgREST y el camino exclusivo del servidor se necesitan también URL de API, clave pública y una credencial exclusiva del servidor DE ESE PROYECTO, configuradas fuera de Git y del chat. Una sesión autenticada del Dashboard de pruebas permite trabajar con SQL Editor, pero no sustituye por sí sola las credenciales de API necesarias para validar el recorrido de la aplicación. Si el proyecto no existe, hay que crearlo primero en la cuenta del propietario; no se creó ni contrató infraestructura en esta continuación.

Metadatos pendientes del snapshot: tipos completos con precisión/escala de numeric y longitudes de caracteres; parámetros de identidad/secuencias; valores actuales de las claves comerciales conocidas. El historial completo aplicado y la versión de PostgreSQL son comprobaciones adicionales necesarias para preparar una base fiel y compatibilidad. Los objetos internos completos de Auth/Storage/extensiones tampoco están contenidos en el snapshot público; deberán validarse en el Supabase de pruebas, sin reemplazar los esquemas gestionados. Estos datos pueden obtenerse mediante SQL de lectura, conector autorizado o export de esquema: NO requieren técnicamente navegador. La dependencia anterior era de acceso, porque el Dashboard era la única sesión autorizada disponible. Con la restricción actual no se volverá a consultar producción; una validación en staging deberá indicar qué parte usa la referencia parcial y no afirmar equivalencia completa con producción.

El criterio pendiente de notificación es **llegada al celular con la aplicación cerrada y sonido**. El correo implementado no satisface ese criterio. No se verificó recepción en un teléfono ni sonido y no se amplía esta tarea para implementar otro canal. Esta validación seguirá como bloqueo independiente incluso si las reservas pasan en staging.

Siguiente paso al disponer del acceso: comprobar identidad y separación del proyecto de pruebas antes de cualquier escritura, cargar únicamente estructura de referencia/datos sintéticos, aplicar secuencialmente las migraciones preparadas y comprobar allí el recorrido solicitado, los permisos, expiración y concurrencia. No ejecutar las suites locales destructivas existentes contra staging cambiándoles la URL; están diseñadas para una base loopback exclusiva. No desplegar la aplicación ni hacer push.
