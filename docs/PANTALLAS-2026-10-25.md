# Pantallas MERYO conectadas al contrato público

Continuación de `8936c32`, en la rama de integración existente. Se conserva la landing, catálogo, filtros/mapa, tarjetas y modal de reserva MERYO. No se cambió el esquema ni se ejecutaron migraciones ni pruebas en producción. No se usó Docker, push ni despliegue.

## Abrir

Desde `C:/Users/51934/OneDrive/Escritorio/barber-pro`: `npm run dev`. Reutiliza el PostgreSQL nativo `127.0.0.1:55440/meryo_test` y sirve exclusivamente loopback en `http://127.0.0.1:5178/`.

| Pantalla | URL local | Estado comprobable ahora |
|---|---|---|
| Inicio y catálogo | `/#landing`, `/#client` | Catálogo, precios y servicios activos de PostgreSQL local; perfiles y calendario del modal. Las tarjetas destacadas usan ese catálogo, no datos inventados. |
| Crear cuenta / acceso | `/#client-register`, `/#client-login`, `/#barber-login` | Formularios existentes conectados a la API de Supabase Auth, con errores visibles y cierre de sesión real cuando hay servicio. En este entorno se bloquean expresamente por falta de Auth. No crean cuentas ni sesiones locales falsas. |
| Registro de barbería | Formulario al final de `/#client` | Conectado a `registrar_barberia`, incluyendo presentación, contacto y coordenadas. Requiere cliente autenticado real. Queda pendiente de revisión, sin activación ni rol admin desde el navegador. |
| Mi barbería | `/#shop-manage` | Perfil/servicios/precios/horarios preparados con módulos adaptados del ZIP. Acceso condicionado al perfil de barbero real y su barberia_id. Sin Auth solo muestra el requisito de acceso; no expone editores privados ni simula propiedad. |
| Solicitar cita | Botón Reservar del catálogo | Servicios e IDs reales; horas de `horarios_disponibles`, con duración del servicio y errores visibles. `crear_reserva` recibe el instante completo, servicio y cliente autenticado. La solicitud queda bloqueada en localhost sin Auth. |
| Panel barbero | `/#barber` | Consulta por barberia_id y acciones `responder_reserva`; acepta/rechaza y respeta una respuesta expirada. Sin Auth muestra acceso, no un barbero ficticio. |
| Mis citas | `/#my-bookings` o dentro del catálogo | Consulta por cliente_id o barberia_id del perfil verificado. Muestra los estados reales, plazos y montos. Sin sesión muestra acceso requerido; se retiró el historial de demostración. |
| Administración | `/#admin` | Acceso depende de `auth.getUser()` y perfil activo admin con el mismo ID. Activación por RPC `activar_barberia`, con lectura posterior para confirmar resultado; la base conserva la autorización final. No hay botón de convertirse en admin. |

## Qué se integró

`meryo-api.js` concentra lecturas y transiciones públicas; no llama al esquema candidato meryo, a slots falsos ni al pago de prueba. `useIdentity` valida el usuario mediante getUser y perfil, sin conceder roles por datos del formulario, URL, localStorage o encabezados de pruebas. Auth sigue siendo Supabase; PostgreSQL por sí solo no lo reemplaza.

Se adaptaron TabServicios, TabHorarios, estilos de formularios y formato del ZIP. Todos los cambios de perfil/servicios/horarios/bloqueos exigen una fila devuelta por el servidor antes de mostrar éxito. Los errores de lectura se muestran y no se ocultan como listas vacías válidas. Se omitió acepta_auto: aceptación manual siempre. No se adoptaron porcentajes, 15 minutos, regla de devolución de tres horas ni repartos.

Se preservan los componentes de diseño existentes. El modal muestra los servicios persistidos y el calendario público en Lima, limpia la selección al cambiar servicio/fecha y no anuncia un cobro. Aceptada se presenta como pendiente de pago; un estado expirada nunca se muestra como aceptación correcta. Los registros históricos de proveedores de prueba no reciben una etiqueta que acredite un cobro real.

Las rutas de actores sintéticos y recibos locales de la continuación anterior se cerraron: POST en `/__local/*` devuelve 403; reservas privadas por encabezados de actor también se rechazan. El antiguo banco en `/tests/browser/` devuelve 410. No se creó otro banco separado. Los archivos históricos permanecen en Git; no son el flujo de la aplicación.

## Comprobaciones de este bloque

- Ocho pruebas nuevas de la API: identidad/rol/usuario activo; bloqueo sin Auth sin peticiones; nombres y argumentos de RPC públicos; error/datos vacíos sin éxito; aceptación vencida; filtro de Mis citas; registro sin elevar roles; etiquetado de pagos de prueba.
- Prueba actualizada de la fachada y tres escenarios HTTP con PostgreSQL existente: servicios/precios/duración y agenda reales; cierre de todos los endpoints antiguos incluso con encabezados falsificados; CSP/alias locales en App y módulos de gestión.
- Una prueba de renderizado estático de las pantallas existentes (React SSR) verifica formularios, acceso denegado de admin, Mis citas sin sesión y el modal con servicios de PostgreSQL, sin crear sesiones. No es interacción de navegador ni prueba del servicio Auth. El acceso automatizado al navegador sigue deshabilitado en Work.
- Resultado: 14 pruebas contando la agrupadora de HTTP aprobadas; build local y ESLint aprobados. No se repitieron las suites SQL, catálogo u operaciones que siguen intactas. Se actualizó únicamente la suite local cuyas rutas cambiaron, eliminando su anterior recorrido de actores sintéticos.
- El build local falla si incorpora el cliente remoto o SDK Supabase. Los imports de los módulos integrados también se sustituyen por la fachada local. CSP restringe conexiones al origen local. No se añadieron secretos ni llamadas a producción.

## Incompleto y bloqueado

No se puede dar por probado el registro/login, crear o editar una barbería, solicitar/aceptar citas o consultar datos privados con usuarios reales mientras falten **Supabase Auth (GoTrue) y PostgREST de pruebas**, con API de datos, JWT y perfiles/RLS coherentes en el backend de pruebas. Se necesita la URL del entorno separado y su clave pública configuradas de forma privada; ninguna clave de servidor debe entrar en el frontend. El PostgreSQL actual contiene auth.users/auth.uid de fixture y NO constituye ese servicio ni soporta sus sesiones. Esta continuación no conectó otro entorno ni usó producción como sustituto.

Los componentes y sus contratos están preparados, pero no se afirma que un E2E autenticado esté funcionando. Una vez disponible esa infraestructura habrá que configurar el cliente de pruebas y comprobar el recorrido sobre las pantallas; no habilitar la URL de producción como atajo. Storage y Realtime siguen sin servicios locales validados. Tampoco se probó notificación al celular con aplicación cerrada y sonido.

Pago real bloqueado: no hay botón de simular o confirmar cobro, checkout ni proveedor conectado. No se puede completar una reserva pagada desde estas pantallas hasta integrar y verificar al proveedor por servidor.

Este documento sustituye las instrucciones del banco separado y accesos por actor descritas en `LOCALHOST-2026-10-25.md`; las verificaciones históricas de aquel bloque se conservan como tales. El servidor/cluster se detienen al cerrar las comprobaciones; `npm run dev` vuelve a iniciarlos para uso local.
