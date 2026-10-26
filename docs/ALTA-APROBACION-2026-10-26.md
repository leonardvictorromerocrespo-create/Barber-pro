# Registro, aprobación y catálogo: comprobación local

Continuación de `8572240`, en `codex/integracion-selectiva-meryo`. No se cambió el diseño ni se añadieron funciones comerciales. Se guardó la conexión nativa que había quedado preparada y se comprobó únicamente este recorrido. No se consultó ni modificó producción, no hubo Docker, push ni despliegue.

## Resultado observado desde las pantallas

1. Crear cuenta con correo/contraseña: Supabase Auth local creó el usuario y el trigger creó su perfil cliente.
2. Iniciar sesión desde el formulario: contraseña validada por Auth, perfil consultado por PostgREST con el JWT real.
3. Registrar `MERYO Prueba Local`: RPC `registrar_barberia`, perfil convertido a barbero asociado a su barbería. El panel del propietario mostró estado pendiente; el catálogo tenía cero barberías.
4. Guardar latitud/longitud desde el perfil: necesarias para `activar_barberia`. Un alta sin ubicación puede conservarse pendiente, pero el servidor impide aprobarla.
5. Crear una segunda cuenta mediante la pantalla de registro. Solo en la base local `meryo_auth_local`, el operador de pruebas asignó a esa cuenta el rol admin en `profiles`. No se insertaron usuarios directamente en Auth ni se fabricaron sesiones, y no existe selector de rol en la aplicación.
6. Ingresar como ese administrador mediante el formulario y pulsar Activar. El servidor comprobó `es_admin()` y la interfaz volvió a leer estado activa/verificada antes del mensaje de éxito.
7. Cerrar sesión del administrador, abrir Buscar barbería: apareció una barbería. Ver barbería mostró la presentación registrada. Evidencia: `alta-aprobada-local-2026-10-26.png`.

No se encontró un error de interfaz que impidiera este recorrido; se conservaron sus componentes actuales. El alta no publica servicios, precios, fotos o video automáticamente.

## Verificaciones de este bloque

- Recorrido anterior realizado con las pantallas, Auth y PostgREST reales, no con el banco de actores anterior.
- `MERYO_REAL_AUTH_TEST=1 node --test tests/native-approval.test.mjs`: una prueba de integración aprobada. Consulta pública de la barbería activa; un visitante anónimo y un cliente con JWT emitido por Auth no pueden aprobar; el cliente no puede modificar su rol a admin. La prueba conserva una cuenta sintética local sin publicar sus credenciales.
- Build Vite `localauth` con clave pública local inyectada en memoria: aprobado. El guard del build excluye el cliente Supabase remoto. Salida ignorada en `dist/real-auth-local`.
- Sintaxis de los scripts nuevos, ESLint de cliente Auth/configuración Vite y `git diff --check`: aprobados. No se repitieron suites anteriores de reservas/pagos ni auditorías generales.

## Usar la aplicación instalada

Se deja encendida por instrucción expresa del propietario, que para esta sesión prevalece sobre detener las pruebas al terminar. URL: **http://127.0.0.1:5178/**. Solo escucha en loopback.

Si se reinicia el equipo: ejecutar `npm run dev` desde este repositorio. Reutiliza el PostgreSQL instalado y los ejecutables nativos existentes; no instala paquetes ni abre Docker. Para detener la sesión actual se puede escribir `stop` en su proceso; el lanzador detiene PostgreSQL si lo arrancó él.

Pasos para repetir con otra barbería:

1. Mi cuenta → Crear cuenta → volver → Iniciar sesión.
2. En el catálogo, Registro de barberías → Registrar; completar datos. En Mi barbería, completar latitud/longitud y Guardar perfil si faltan.
3. Volver al catálogo y Cerrar sesión. Soy barbero → entrar con el administrador local → Activar la barbería.
4. Cerrar sesión → Buscar barbería: debe aparecer en el catálogo.

El acceso del administrador de pruebas está en `%LOCALAPPDATA%/MERYO-tests/native-auth/acceso-admin-local.txt`, fuera de Git. Esa cuenta/contraseña solo sirve en esta base de pruebas. El propietario deberá identificar su cuenta real antes de autorizar permisos de administrador en producción.

## Servicios ya instalados utilizados

- PostgreSQL 17: instancia existente `127.0.0.1:55440`, base `meryo_auth_local`; la base anterior `meryo_test` se conservó.
- Supabase Auth v2.197.0, fuente oficial commit `4eee58f296d9698a1c2c0ae14d7a0b379c7622d3`, compilada con Go 1.27.3. Parche Windows ya preparado en `scripts/native-auth-windows.patch`: elimina únicamente SO_REUSEPORT de Unix del listener. No reemplaza autenticación, contraseñas, JWT ni migraciones de Auth. Esta compilación local no es una distribución oficial de Supabase para Windows.
- PostgREST v16.5, binario Windows oficial, SHA256 `17f595b0d8dd37473d0231417dea07c5ac9f791282ff5b017fae51ff29e5de2f`. Reutiliza las DLL de PostgreSQL instalado.
- Auth `127.0.0.1:55441`, PostgREST `127.0.0.1:55442`; Vite sirve proxy de ambos en `/__supabase`. No lee `.env` de producción para estas conexiones. CSP restringe conexiones del navegador al mismo origen/loopback; el cliente local falla si faltan configuración local o puerto correcto, sin fallback remoto.
- Binarios, fuentes, logs y secretos permanecen en `%LOCALAPPDATA%/MERYO-tests/native-auth`, fuera del repositorio. No se versionaron contraseñas, claves ni tokens de usuarios.
- Correo autoconfirmado **solo localmente**: no se verificó entrega ni confirmación por email. No se ejecutaron Storage ni Realtime y no se presentan como comprobados.

## Qué falta para desplegar esta funcionalidad

1. Validación final en un Supabase separado de pruebas con Auth/PostgREST gestionados y confirmación real por correo: remitente/SMTP, Site URL y redirecciones autorizadas. La prueba local no acredita entrega de correo ni equivalencia completa del backend remoto.
2. Cerrar las diferencias ya documentadas de la referencia SQL (tipos completos/precisiones, secuencias e historial aplicado) y contrastar en ese entorno las funciones `handle_new_user`, `registrar_barberia`, `activar_barberia`, `es_admin`, sus triggers, restricciones, RLS y grants. La referencia pública recuperada y las migraciones 001/002 bastaron para este recorrido local, no autorizan aplicar a ciegas el esquema candidato ni a producción.
3. Identificar la cuenta real del propietario y asignar su perfil admin mediante un operador autorizado del backend. Nunca trasladar la cuenta/contraseña local ni permitir autoasignar ese rol desde registro.
4. Con esas comprobaciones aprobadas, preparar únicamente los cambios incrementales necesarios y la configuración del frontend de destino; solicitar autorización antes de aplicarlos y desplegar. Nada de ello se ejecutó en este bloque.

Pagos, reservas, notificaciones al celular, Storage y Realtime quedan fuera del alcance de este recorrido. Esta aprobación de alta de barberías no significa que el marketplace completo esté listo para lanzamiento comercial.
