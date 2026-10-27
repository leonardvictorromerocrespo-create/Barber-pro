# Registro de barbería y ubicación

Ruta pública prevista: https://barber-pro-phi-taupe.vercel.app/#shop-register . Se conserva diseño, Google y correo existentes, MFA administrativo, permisos, datos y cobros bloqueados. Sin migraciones ni escrituras de prueba en producción.

## Cambios

- La causa del bucle era la navegación a `barber` tras Google: el usuario recién creado tiene rol `cliente`, por lo que esa vista volvía a mostrar el acceso reservado a `barbero`. El rol no se cambia para arreglar navegación. Cliente nuevo → registro; cuenta con barbería asignada → gestión con estado pendiente/aprobado; administrador real → su puerta MFA.
- OAuth conserva una intención de navegación `access=barber` o `shop-register`, además del almacenamiento de sesión. No contiene roles ni sirve como autorización. Se muestran errores de perfil/Google y se conserva la alternativa por correo. Una cita enlazada sigue teniendo prioridad sobre este destino.
- Registro dedicado y formulario existente del catálogo reutilizan `ShopRegistration`. Campos latitud/longitud retirados del registro y de la edición de perfil. Mapa Leaflet/OpenStreetMap existente: tocar para seleccionar, marcador arrastrable, coordenadas en estado automáticamente, botón Usar mi ubicación iniciado por el usuario, errores y alternativa manual. Se advierte que el teléfono puede estar en otro lugar. El registro exige seleccionar la ubicación; el servidor conserva su validación.
- La gestión muestra explícitamente Solicitud pendiente de aprobación o Barbería aprobada. No se concede aprobación al registrar ni al entrar con Google.
- En el entorno nativo solo se permitió la imagen de `https://tile.openstreetmap.org` en CSP para visualizar el mapa existente; no se modificaron permisos de base de datos, Storage ni Auth.

## Evidencia y alcance

- Cuatro pruebas de navegación/representación aprobadas: destino conservado, roles reales determinan la pantalla, errores visibles, sin coordenadas manuales. Build aprobado.
- `tests/shop-onboarding-native.test.mjs` aprobado con Auth y PostgREST reales en el PostgreSQL local existente: cuenta no administradora, registro, coordenadas persistidas, estado pendiente y oculto al público, propietario sin facultad de aprobar, aprobación con sesión MFA real del administrador de pruebas existente y guardado del perfil después. No se repitió la auditoría general.
- Selector de mapa comprobado en una página temporal de componente bajo `dist`, sin Auth ni API ni escrituras: clic → coordenadas seleccionadas; arrastre → coordenadas distintas; error al no obtener geolocalización conserva el punto manual. Esta página está excluida de Git/despliegue y no reemplaza Auth.
- Verificación específica Google con otra cuenta: pendiente de intervención del usuario. Se abrió el selector real de Google desde Acceso barbero local, con retorno al Auth local `127.0.0.1:5178` y `access=barber`. Solo estaba disponible la cuenta habitual administradora; se solicitó Usar otra cuenta. No se eligió la cuenta administradora ni se alteró su rol para simular la prueba. No declarar este recorrido Google físico completo hasta el retorno y registro desde esa cuenta.

La cuenta y barbería del test automatizado son exclusivamente locales. Sus credenciales y pruebas quedan fuera de Git, en el directorio privado ya existente. No se crearon servicios, proyectos o contenedores adicionales.

## Publicación y paso pendiente

Corrección publicada en `c8599fc`, despliegue `dpl_G9zYrQgFWg7vpQJ32uRBwmRv7h5W` promovido al dominio existente. Lectura pública 2026-10-27 20:46 UTC: HTTP 200, bundle `index-BSz9MTgI.js`, ruta de registro, estado pendiente, módulo de marcador arrastrable y Usar mi ubicación presentes. Evidencia privada: `shop-onboarding-publication-proof.json`.

El usuario pidió mostrar la selección porque no veía la pestaña. Se hizo visible el navegador existente y se abrió Usar otra cuenta en Google. La verificación Google no administradora continúa pendiente de que introduzca su cuenta. El Auth/PostgREST/PostgreSQL local permanece temporalmente encendido para ese retorno; detener únicamente esos procesos al finalizar la comprobación, sin Docker ni otras instancias.

## Recorrido Google completado posteriormente

El primer retorno tardío indicó `bad_oauth_state / OAuth state has expired`. No fue un acceso completado. Se inició una autorización nueva; la otra cuenta Google ya estaba iniciada y volvió al registro sin pedir Authenticator ni regresar al login. Se verificó en la base local una identidad real `google`, sin rol administrativo.

Desde las pantallas se completó MERYO Google Mapa Local (datos explícitos de prueba), se tocó el mapa y se arrastró el marcador. Registrar guardó las coordenadas y mostró Solicitud pendiente de aprobación en la gestión. Se agregó un servicio desde la pantalla. El administrador de pruebas existente inició sesión y verificó su TOTP real; su RPC aprobó exclusivamente esa barbería local. El catálogo local la incluyó. Volver a Acceso barbero con la cuenta Google abrió la gestión y Barbería aprobada. Se guardó la descripción desde ese perfil y se contrastó su persistencia y estado activo en PostgreSQL.

Evidencia privada: `shop-google-onboarding-proof.json`, `shop-google-map-registration.png`, `shop-google-pending.png` y `shop-google-approved.png`. No hay credenciales de Google en el repositorio ni barberías de prueba creadas en producción.

El error vencido reveló que GoTrue puede devolver errores sin `auth_callback`. Se añadió `oauthFailure` para reconocer errores en query/hash, mostrar un aviso de reintento claro y conservar el destino recordado, sin extender ni evadir la vigencia del estado OAuth. La regresión específica y el build pasaron; no se repitió la auditoría ni pruebas ajenas al cambio.

Publicación final: `1f65ada`, despliegue `dpl_22cd63Sge6TEej4qsFaZWp2vGtwN`, promovido al mismo dominio. Verificada por lectura pública la ruta y el mensaje de acceso vencido; el comprobante privado de publicación ya indica la prueba Google completada. Al terminar se detuvieron solo Auth, PostgREST y PostgreSQL locales del proyecto, conservando datos y evidencia. No quedan pasos pendientes de login Google para este bloque.
