# Equipo y agenda individual

Continúa sobre 2feb4f2 y el bloque administrativo b68667c. Se conserva el diseño, Google, MFA administrativo y el catálogo sin perfiles demo. No cambia cobros ni habilita suscripciones.

## Contrato incremental 014

- El propietario invita un correo verificado mediante enlace de un solo uso, válido siete días. El token se guarda únicamente como hash en la base; el enlace usa fragmento y se comparte personalmente. No hay envío automático de invitaciones.
- Cada integrante entra con su propia cuenta de Supabase Auth. Aceptar una invitación no concede propiedad ni administración. Un integrante no puede crear invitaciones, editar el perfil o gestionar servicios del local; solamente consulta su agenda y actúa sobre las citas asignadas. Se conserva su historial personal como cliente.
- El propietario asigna servicios, activa o desactiva integrantes, añade/edita/retira jornadas y descansos semanales y bloqueos por fechas. Las retiradas conservan registros. No puede desactivar un integrante con citas futuras vigentes ni cambiar horarios que invaliden reservas existentes.
- El cliente elige un integrante real habilitado para el servicio. La disponibilidad requiere horario general del local y jornada individual, descontando descansos, bloqueos y citas. Las horas se interpretan en Lima, independientemente de la zona de la computadora.
- La solicitud guarda ID y nombre del integrante. La base serializa solicitudes por local, aplica exclusión por integrante y rechaza también citas simultáneas del mismo cliente. Dos integrantes pueden atender en paralelo. Las reservas históricas sin integrante no se reasignan: bloquean conservadoramente todos los integrantes durante su intervalo mientras estén vigentes.
- Aceptación manual de 15 minutos y pago de 10 minutos conservados. Solo una verificación de pago del servidor puede confirmar; la pasarela sigue deshabilitada. Las notificaciones se dirigen al integrante asignado y al propietario; esto no demuestra entrega push con la app cerrada.

## Verificaciones específicas

- Cinco pruebas nativas con Auth y PostgREST reales: vinculación por correo, invitación de uso único, aislamiento entre integrantes y barberías, asignación de servicios, descansos/bloqueos, duración, dos reservas simultáneas para distintos integrantes y un solo ganador para la misma hora/integrante.
- Control final adicional: edición atómica de jornada, rechazo de servicios ajenos y bloqueos pasados, capacidad de respuesta por cita y prohibición de confirmar mediante UPDATE directo.
- Tres pruebas de datos de interfaz: invitación tras login/expiración, borrador con integrante sin campos de autoridad y conversión de fechas Lima sin normalizar fechas imposibles.
- Recorrido desde las pantallas en localhost con cuentas sintéticas reales: propietario invita; cuenta acepta tras login; integrante ve solo su agenda; propietario asigna servicio, jornada, descanso y bloqueo, y edita la jornada; cliente anónimo consulta disponibilidad y recupera barbero/fecha/hora después de autenticarse.
- El cliente solicita desde la pantalla y el integrante asignado acepta desde su panel. Se observa el plazo de pago de diez minutos y el cobro bloqueado. Sin efectuar pago, el mantenimiento del servidor vence la solicitud automáticamente; el historial conserva su aceptación anterior.
- Respaldo cifrado de 61 tablas y cero objetos de Storage restaurado antes de migrar; ensayo 014 sobre esa copia preserva los datos originales y revierte. Evidencias detalladas y credenciales sintéticas se mantienen fuera de Git en AppData/Local/MERYO-deployment y MERYO-tests.

## Accesos

- Propietario: `https://barber-pro-phi-taupe.vercel.app/?shop_view=equipo#shop-manage` y `?shop_view=agenda#shop-manage`.
- Cliente: `https://barber-pro-phi-taupe.vercel.app/#client`.
- Administrador: `https://barber-pro-phi-taupe.vercel.app/#admin`, con rol real y MFA del servidor.

Estos enlaces seleccionan pantallas; no conceden permisos. Las cargas de Storage se mantienen sujetas a la comprobación HTTP aislada y a su habilitación independiente. El respaldo automático externo gratuito tiene un límite de 12 MiB por copia completa: no se debe prometer cobertura ilimitada de videos.
