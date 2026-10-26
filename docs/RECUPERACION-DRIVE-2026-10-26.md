# Seguridad y recuperación: continuación del 26/10/2026

## Cambios comprobados de este bloque

- Mi cuenta abre `#account-security` para cualquier identidad real ya autenticada. Enrolar TOTP no concede un rol. La cuenta Google del propietario sigue siendo cliente; no se modificó su autorización administrativa.
- Se mostró el QR privado al propietario, que confirmó haberlo escaneado. El vínculo no se da por verificado hasta que GoTrue acepte el código introducido personalmente en MERYO. La pantalla permite recuperar la verificación del mismo factor pendiente después de recargar, sin generar otro secreto. No se guardaron QR ni códigos en el repositorio.
- Se conserva la protección SQL administrativa de los commits anteriores: rol activo, sesión no revocada, AAL2 firmado y factor verificado. No se repitieron las pruebas aprobadas de MFA/RLS porque no cambió ese SQL.
- Se preparó un conector **separado** de Google Drive con `google-auth-library`, PKCE, estado aleatorio, retorno temporal en loopback y permiso exclusivo `drive.file`. Sus credenciales y tokens solo se guardan en AppData, fuera de Git. No se amplían los scopes del login MERYO.
- El transporte de respaldo solo admite archivos `.meryo.enc`, comprueba capacidad gratuita disponible y carpeta privada, sube por flujo, descarga y compara SHA-256. Se limita a 250 MiB por ejecución hasta revisar capacidad. La retención envía a la papelera únicamente archivos propios cifrados de la carpeta seleccionada, con antigüedad mayor a 30 días. Nunca sube `recovery/backup.key`.
- Dos pruebas unitarias nuevas comprueban retención y corrupción de descarga (no equivalen a entrega real en Drive). Pasaron el render afectado, ESLint de las dos pantallas modificadas y build `localauth`.

## Estado real, sin confundir preparación con ejecución

La tarea local diaria a las 03:00 conserva retención de 30 días. Se consultó su última ejecución: 26/10/2026 03:00, resultado 0. Las restauraciones locales de base/cuentas y archivos ya documentadas siguen vigentes; no se repitieron. Incluyen Auth nativo, **no objetos de Supabase Storage**.

El propietario autorizó conectar Drive; se preparó el formulario del cliente dedicado `MERYO Backups Drive local`. Su creación requiere confirmación puntual del navegador. Hasta completar consentimiento, subida, descarga y restauración aislada del archivo descargado, **Drive no está activo ni verificado**. No se cambió `independentDestination` para fingir que lo está.

## Pasos operativos tras recibir las conexiones

1. Crear el cliente de escritorio dedicado y guardar su JSON exclusivamente en `%LOCALAPPDATA%/MERYO-backups/drive-client.json`. Habilitar Drive API sin vincular facturación. No usar el secreto web de MERYO.
2. Ejecutar `node --use-system-ca scripts/connect-drive-backup.mjs`. Abrir privadamente la URL de `drive-consent-url.txt`; el propietario autoriza su propia cuenta. El proceso no imprime códigos ni tokens. El cliente solicita únicamente `drive.file` y acceso offline.
3. Ejecutar `uploadAndVerifyDrive` sobre un archivo cifrado local. Si pasa, restaurar su `downloaded` con `node scripts/run-backup.mjs restore-test <ruta>`. Solo crea una base nueva `meryo_restore_*`, nunca sobrescribe la principal. Revisar conteos y hashes del manifiesto.
4. Solo después de esa restauración satisfactoria, configurar `independentDestination: {kind: 'google-drive'}` en el JSON privado de respaldos. Actualizar la tarea con `scripts/schedule-local-backup.ps1`, que añade certificados del sistema para HTTPS, y comprobar una ejecución de la tarea con copia remota. Revisar `drive-status.json`, `backup-status.json` y `restore-status.json`, sin publicar credenciales.
5. Copiar personalmente la clave a un USB protegido o gestor de contraseñas independiente. No al mismo Drive ni a la carpeta del archivo cifrado. Comprobar acceso a esa copia sin mostrarla. Sin custodia independiente de la clave, la recuperación ante pérdida del PC sigue incompleta.

## Recuperación del celular

El camino compatible es un segundo factor **verificado en otro dispositivo** antes de perder el principal. Desde Seguridad MERYO se puede añadir esa entrada y verificarla personalmente. El segundo factor no eleva el rol. No se implementan códigos maestros, cuentas alternativas ni recuperación automática que omita MFA.

Si se pierden todos los factores, se conserva el procedimiento del operador autorizado documentado en ACCESO-SEGURIDAD: verificación independiente de identidad, suspensión, revocación de sesiones, retirada exclusivamente de factores perdidos mediante Auth Admin oficial y nuevo enrolamiento antes de reactivar. Requiere operador/custodia reales; un enlace de correo no concede administración.

## Conexiones y límites pendientes

- Sesión autorizada en Supabase Dashboard del proyecto existente, conexión SQL privada para exportación y permiso servidor de listado/descarga de Storage. La lectura previa de metadatos no proporciona acceso de exportación a cuentas/archivos. No inventar buckets ni presentar el dump nativo como respaldo comercial.
- Google mantiene el proyecto OAuth en modo Prueba. Los refresh tokens con Drive caducan a los siete días en ese modo; requiere resolver el estado de publicación del consentimiento antes de considerar estable una automatización de 30 días. No se publicó ni cambió ese estado.
- La tarea Windows requiere computadora encendida, sesión iniciada, PostgreSQL disponible e Internet para Drive. Para independencia del PC hace falta un ejecutor siempre disponible con origen/destino autorizados y secretos bajo custodia; no se contrató ninguno.
- No se modificó producción, desplegó, hizo push ni activó facturación.

Referencias oficiales: [OAuth y caducidad](https://developers.google.com/identity/protocols/oauth2#expiration), [límites y umbrales actuales de Drive](https://developers.google.com/workspace/drive/api/guides/limits), [MFA de Supabase](https://supabase.com/docs/guides/auth/auth-mfa/totp). Se debe volver a revisar costo/capacidad si cambia el volumen; no se autoriza comprar almacenamiento ni aumentar cuotas.

## Continuación: cliente Drive creado con autorización expresa

- El propietario autorizó crear `MERYO Backups Drive local`. Google confirmó la creación del cliente de escritorio; se guardó privadamente en `MERYO-backups/drive-client.json`. No se añadió a Git. Se habilitó exclusivamente Google Drive API, sin vincular facturación.
- Se abrió el consentimiento de la cuenta del propietario con el alcance único `drive.file`. La pantalla dice que permite ver/editar/crear/eliminar **solo archivos usados en esta aplicación**. Se dejó visible para que el propietario pulse Continuar; aún no existe `drive-connection.json`. No se da por activa la copia independiente.
- La descarga automatizada del JSON no produjo un archivo verificable; se guardaron los valores del diálogo privado en el archivo privado y se cerró ese diálogo. No usar capturas de la pantalla que contiene el secreto como evidencia pública.
- El propietario informó que verificó MFA; la lectura posterior del servidor todavía devolvió un factor `unverified` para su identidad Google, rol cliente. La pantalla conserva ese factor y su formulario. Se solicitó completar allí la verificación y comunicar solo cualquier mensaje de error. No se afirma MFA personal completado hasta que el servidor coincida.
- Solo tiene un celular. Para recomendar la restauración compatible se pidió identificar la aplicación Authenticator. No se retiró ningún factor, crearon códigos maestros ni cambiaron roles.
- Indicó USB como medio de custodia, pero no se detectó volumen removible conectado. No se copió ninguna clave. Esa respuesta no se interpreta como sesión/acceso a Supabase; la exportación del backend y Storage reales sigue pendiente.
- Se evita conservar una segunda descarga cifrada en cada ejecución diaria de Drive después de comparar hashes; la copia original local conserva su retención. Comprobación de sintaxis aprobada para este cambio, sin repetir pruebas históricas.
