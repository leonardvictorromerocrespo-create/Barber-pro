# Acceso, MFA, respaldos y plazo de pago

Continuación de `88369d9`, conservando los recorridos anteriores y la interfaz MERYO. Cambios locales en la misma rama; sin Docker, despliegue, push de Git ni escrituras a producción. Las migraciones nuevas son incrementales sobre el contrato existente: **006–010**, aplicadas solo al PostgreSQL nativo local. No se ejecutó `db/candidate`.

## Funciona y está comprobado en localhost

### Google y reserva en preparación

- Un visitante explora perfiles, servicios y horarios sin sesión. Solicitar cita lleva al acceso, con Google y correo/contraseña como alternativa.
- Google Cloud: proyecto de identidad **MERYO Acceso**, ID `lithe-land-512807-c6`; app MERYO en modo **Prueba**, sin vincular facturación ni activar servicios de pago. El propietario autorizó expresamente la política de Google y la creación del cliente web local. Añadió su cuenta como usuario de prueba y se verificó su presencia en la tabla.
- Cliente OAuth limitado al origen `http://127.0.0.1:5178` y retorno `http://127.0.0.1:5178/__supabase/auth/v1/callback`. El secreto quedó exclusivamente en `%LOCALAPPDATA%/MERYO-tests/native-auth/connections.json`, no en el frontend, Git ni mensajes.
- Se hizo el recorrido real: visitante → servicio Corte MERYO → 27/10/2026 a las 11:30 → pedido especial → Solicitar cita → Google → regreso automático al mismo servicio/fecha/hora/pedido. El nombre vino del perfil y el celular quedó vacío como dato faltante. No se creó una reserva ni un cobro al comprobar el regreso.
- Se comprobó en la base que la identidad Google pertenece a un perfil cliente activo, sin rol administrador. El trigger ignora roles y asignaciones enviados en metadatos y usa únicamente nombre/identidad de presentación.
- Borrador mínimo en `sessionStorage`, con vencimiento de 30 minutos, sin contraseñas, tokens ni roles. Se vuelve a consultar catálogo/servicios/horarios, en vez de confiar en precios o disponibilidad del borrador. No hay solicitud automática después de autenticarse. Logout y envío exitoso eliminan el borrador. Si se cierra la pestaña, sus datos no se conservan entre pestañas; la comprobación completa se hizo manteniendo la misma ventana OAuth abierta.
- Después de guardar una solicitud válida, el servidor completa únicamente los campos de contacto que estaban vacíos en el perfil. No cambia roles ni reemplaza un nombre/teléfono ya existente. Así pueden recuperarse en futuros accesos.
- Sesión real del SDK Supabase: PKCE, persistencia y renovación de tokens; rotación de refresh tokens en el Auth nativo. La sesión SPA no se presenta como cookie HttpOnly. Las escrituras SQL también comprueban la sesión en `auth.sessions`: un JWT aún vigente deja de servir para escribir cuando su sesión se revoca.
- Se retiró el destino de producción incrustado en el cliente: un preview remoto sin configuración explícita falla antes de conectarse. Para un destino autorizado se requieren `VITE_SUPABASE_URL` HTTPS, `VITE_SUPABASE_PUBLISHABLE_KEY` y, tras configurar el proveedor, `VITE_MERYO_GOOGLE_ENABLED=true`. Nunca poner claves `service_role`, contraseñas SQL o secretos OAuth en variables `VITE_*`.

### Administración y RLS

- El acceso administrativo exige TOTP real de Supabase Auth. `es_admin()` comprueba el perfil/rol activo, JWT firmado con `aal2`, sesión existente/no vencida y factor verificado. No depende de un interruptor de React ni de metadatos de Google.
- Activar/suspender barberías y las ramas administrativas de RLS quedan protegidas por esa comprobación del servidor. Se mantienen los permisos ordinarios de gestión de la barbería propia.
- Allowlist explícita de columnas para actualizar perfil y barbería: no se permite cambiar rol, propietario, estado de verificación o aceptación automática desde una petición del navegador. Las escrituras de perfiles, barberías, servicios, horarios, bloqueos y medios requieren cuenta/sesión activa, además de sus políticas de propiedad existentes.
- Se verificó con usuarios de Auth reales: una contraseña administrativa sola es insuficiente; un código inválido se rechaza; un TOTP válido emite AAL2 y permite la acción; eliminar el factor vuelve a negar privilegios aunque el JWT conserve AAL2. También se comprobaron metadatos maliciosos de registro, acceso a barbería ajena, modificación de servicios ajenos y tokens de sesiones revocadas.
- No se crearon administradores nuevos para estas comprobaciones. Se usó la cuenta administrativa local existente, con un factor temporal de prueba que se eliminó al terminar. El Google del propietario sigue siendo cliente: **no fue promovido automáticamente**.

### Vincular tu misma aplicación Authenticator y preparar recuperación

1. Iniciar sesión con una cuenta MERYO cuyo perfil ya tenga autorización administrativa del backend. En localhost, el acceso preexistente está en `%LOCALAPPDATA%/MERYO-tests/native-auth/acceso-admin-local.txt`; solo sirve para pruebas locales.
2. Entrar en Administración → Añadir entrada MERYO en Authenticator. Escanear el QR con la misma app que ya usas, creando otra entrada. El emisor local dice **MERYO Local**; el de producción dirá **MERYO**. No compartir QR, secreto ni códigos por chat.
3. Introducir el código únicamente en MERYO y verificarlo. El panel queda protegido hasta que Auth confirme AAL2.
4. Desde **Authenticator y recuperación**, registrar y verificar otro factor en un dispositivo distinto antes de perder el principal. Ese dispositivo/factor aún requiere configuración por el propietario; no se da por vinculado su celular mediante una prueba automatizada.
5. Si se pierde el celular, entrar con el factor de respaldo. Si se pierden todos los factores, no hay un botón de salto, código maestro ni usuario alternativo creado automáticamente. El operador autorizado de Supabase debe verificar la identidad por un canal independiente, registrar solicitud/evidencia y aprobación, suspender temporalmente el perfil, revocar sesiones, retirar exclusivamente los factores perdidos por la API administrativa oficial, y exigir nuevo enrolamiento. Conservar el mismo UID y rol; reactivar solo tras verificar el nuevo factor. Recuperar una contraseña o entrar por Google no omite MFA. Antes de producción deben designarse los responsables y ensayarse este procedimiento en staging.

## Plazos y pagos

- Continúan los **15 minutos** para respuesta manual del barbero. Tras aceptar se fija desde el servidor el nuevo plazo aprobado de **600 segundos**.
- Notificación transaccional: **“Tu barbero aceptó la cita. Tienes 10 minutos para pagar el adelanto y confirmarla.”** La app muestra el aviso y una cuenta regresiva con reloj/vencimiento del servidor.
- Durante el plazo el horario sigue bloqueado; el worker de servidor expira/libera y notifica al vencer sin pago verificado. No depende de dejar abierta la pestaña.
- Se conservan los vencimientos históricos; una cita anterior que no tenía plazo se identifica como caso que requiere revisión, sin inventarle otro plazo retroactivo.
- Se instaló el contrato de recibos verificados con **`pagos_habilitados=false`**. La pasarela sigue pendiente y el botón de pago permanece bloqueado. No hay cargos de prueba ni recibos falsos en el recorrido del usuario.
- Las carreras se comprobaron **solo en la base restaurada aislada**, con recibos SQL sintéticos del contrato del servidor: duplicados idempotentes, comisión cero, pago tardío a una hora ya liberada/reocupada y pago simultáneo al vencimiento. Los registros de esas pruebas se limpiaron por sus UUID propios; no se afectó la base de la app. Estas comprobaciones no son una prueba de pasarela ni de cobro real.

## Push: implementado y configurado; entrega aún no verificada

- Emisor real Web Push con `web-push` 3.6.7, claves VAPID privadas fuera de Git y worker local. No se creó un producto Firebase de pago ni se contrató proveedor.
- Suscripciones ligadas al UID autenticado, baja al cerrar sesión, cola con leases/reintentos y descarte de endpoints inválidos. Solo se admiten endpoints HTTPS de proveedores de navegadores conocidos, evitando peticiones a direcciones internas/arbitrarias.
- TTL limitado por el plazo que queda en el servidor. El evento aceptado lleva el mensaje aprobado; rechazo/expiración también producen avisos.
- Al pulsar la notificación se abre `/?cita=<uuid>#my-bookings`, con lectura de la cita por RLS y foco en su tarjeta/pago. Si no hay sesión se exige autenticar. La URL no permite leer citas ajenas.
- El Service Worker pide notificación con `silent:false` y registra una confirmación limitada de recepción solo después de `showNotification`. Que el proveedor acepte un envío no se etiqueta como entrega al dispositivo. No hay un recibo de recepción real comprobado todavía.
- Falta autorizar notificaciones y verificar entrega/sonido en el dispositivo real con la app cerrada. Para el teléfono hace falta un **origen HTTPS de pruebas autorizado**, accesible desde él; `127.0.0.1` del PC no sirve como dirección del teléfono. No se abrió un túnel público ni se desplegó para eludir esa restricción. En un despliegue, montar también el endpoint de recibos del emisor y supervisar el worker.
- El arranque local ya usa `--use-system-ca`: conserva validación TLS con los certificados de confianza del sistema. No se deshabilitó SSL.

## Respaldo local comprobado; copia independiente pendiente

- Directorio privado `%LOCALAPPDATA%/MERYO-backups`, ACL del usuario, clave de recuperación fuera del archivo cifrado. Dump PostgreSQL consistente mediante snapshot, archivos de aplicación y configuración privada empaquetados y cifrados con **AES-256-GCM**. Verificación de descifrado/hash; corrupción o clave incorrecta se rechazan.
- Tarea de Windows **MERYO-Backup-Local-Diario**, a las **03:00**, retención configurada de **30 días**. Requiere PC encendida/sesión Windows iniciada y disponibilidad del PostgreSQL local. Se corrigió el primer fallo del lanzador y se verificó una ejecución manual y la ejecución diaria del 26/10/2026 a las 03:00, ambas con resultado **0**. No se promete RPO diario mientras el PC esté apagado ni se presenta esto como un job de producción.
- Se restauró el respaldo en otra base `meryo_restore_*` de la instancia de pruebas existente, sin sobrescribir `meryo_auth_local` ni producción. Se verificaron conteos de tablas y hashes de los archivos recuperados. No se presenta como restauración operativa de todos los servicios gestionados de Supabase.
- Este respaldo cubre la base **local**, fuentes/archivos locales y configuración nativa. **No incluye objetos de Supabase Storage de producción** ni acredita backups de la base comercial remota. El dump de PostgreSQL por sí solo no incluye los objetos de Storage.
- `independentDestination` sigue en null: no hay una copia independiente activa. El script admite un disco externo/NAS confirmado como independiente y verifica los bytes copiados; un directorio sincronizado no se da por subido a la nube solo porque exista en C:.

### Opción gratuita prioritaria y pasos pendientes

1. Elegir **Google Drive de tu propia cuenta**, si su espacio libre alcanza, o un USB/NAS ya disponible. Google ofrece hasta 15 GB gratuitos compartidos entre Drive, Gmail y Fotos; no significa que todo ese espacio siga libre. Comparar el tamaño del respaldo y crecimiento/30 días antes de contratar capacidad. Los videos de Storage requieren otro cálculo.
2. Para Drive, crear una carpeta privada MERYO Backups y conectar un proceso específico de copia/lectura remota, con autorización separada. El acceso Google de MERYO solicita solo identidad/perfil, **no permisos de Drive**. La carpeta de sincronización local no prueba la copia independiente; hay que verificar el archivo remoto y restaurar una copia descargada.
3. Copiar la clave de recuperación `recovery/backup.key` a un lugar seguro independiente y protegido, separado de los archivos `.meryo.enc`. No enviarla por chat ni subirla junto al respaldo. Esa custodia también está pendiente de completar por el propietario.
4. Después de conectar el destino, ejecutar y comprobar copia independiente/restauración y retención remota de 30 días. No se contrataron Google One, PITR, almacenamiento de pago ni un nuevo Supabase.
5. Para respaldar la aplicación comercial faltan una conexión SQL de exportación autorizada y acceso de lectura/listado/descarga a los buckets reales de Storage, configurados privadamente. También se necesitan sus IDs, estructura de objetos y políticas actuales para preparar las reglas de Storage sin inventarlas. No se pide ningún secreto en mensajes.

## Verificaciones y cierre

Se ejecutaron **24 resultados de pruebas pertinentes**: MFA/roles reales (4), borrador/OAuth y revocación (3), cifrado/endpoints/push worker unitarios (3), carreras de pago en la base restaurada (4), reservas con plazo aprobado/contacto (8), render afectado (1) y configuración que falla cerrada (1). Pasaron el build `localauth`, ESLint de los archivos afectados y comprobaciones de sintaxis. Los dobles unitarios no se presentan como Auth, push o pagos reales. No se repitieron las suites históricas completas ni una auditoría general.

Evidencia visual de Google/reserva conservada **fuera de Git** en `%LOCALAPPDATA%/MERYO-tests/proofs`. No se versionaron secretos, QR de MFA ni capturas con datos personales de la cuenta. Se deja la aplicación encendida en **http://127.0.0.1:5178/** con la sesión Google del propietario como cliente y la selección de reserva preparada.

Bloqueos de producción: URL HTTPS y backend separado de pruebas, callback/configuración Google del destino y paso de modo Prueba a publicación cuando corresponda; UID administrador autorizado y enrolamiento/recuperación del dispositivo real; contraste/aplicación autorizada de las migraciones y políticas de Storage contra el esquema real; job fiable fuera del PC; copia independiente y restore de datos/objetos reales; prueba push en teléfono; y pasarela/webhook real con importe/moneda/comercio y conciliación. Nada se desplegó ni se habilitaron cobros.

Referencias oficiales consultadas: [Google en Supabase](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [TOTP/AAL2 de Supabase](https://supabase.com/docs/guides/auth/auth-mfa/totp), [OAuth de Google](https://developers.google.com/identity/protocols/oauth2/web-server), [capacidad gratuita de Drive](https://support.google.com/drive/answer/2375123), [límites de respaldos de Supabase y Storage](https://supabase.com/docs/guides/platform/backups).
