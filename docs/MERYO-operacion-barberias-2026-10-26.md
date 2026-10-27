# Entrega: revisión administrativa y perfil del propietario

## Acciones conectadas

- Administración (`/#admin`): buscar por barbería, distrito o propietario; filtrar estado; revisar ficha, propietario real, contacto, ubicación, servicios, cuentas vinculadas y contenido registrado; aprobar, rechazar con motivo, suspender y reactivar. La transición y el estado esperado se validan en SQL, con MFA y bloqueo de fila. No hay cambios de rol desde esta interfaz.
- Demos: sección separada por los cinco IDs ya confirmados. Se excluyen del catálogo y de los contadores comerciales; no se borran ni se reactivan mediante moderación.
- Mi barbería (`/#shop-manage`): preparar nombre, descripción, dirección, distrito, coordenadas, contacto, servicios y horarios mientras está pendiente. El mapa permite señalar la ubicación. El servidor registra la propiedad dentro del registro existente; no se deduce del correo ni de metadatos OAuth.
- Cambiar nombre, dirección, distrito o ubicación de una barbería activa vuelve a dejarla pendiente y sin verificación. Editar presentación/contacto mantiene su estado. Ninguna edición de perfil puede conceder aprobación. Los servicios/horarios se restringen al propietario registrado.
- Historial persistente de registro, perfil y moderación, visible al propietario y al administrador autorizado. Las filas previas no reciben un historial inventado.
- Ficha pública en ventana: perfil, ubicación, servicios, equipo efectivamente registrado, reseñas reales y visor de portafolio/video cuando haya contenido publicado. Al volver de Mi barbería se recarga el catálogo para evitar mostrar una presentación anterior.

## Verificación de este bloque

Se usaron los servicios nativos existentes: Supabase Auth y PostgREST con PostgreSQL en `127.0.0.1:55440`, base `meryo_auth_local`. Los usuarios sintéticos se crearon en Auth real; la cuenta administrativa de pruebas tiene sesión firmada y un factor TOTP exclusivamente sintético. No son actores alternativos de la aplicación ni cuentas de producción.

Desde las pantallas: inicio de sesión del propietario → registro de barbería → presentación y servicio guardados antes de aprobación → administrador local con MFA → revisión y aprobación → ficha en catálogo → modificación posterior de presentación → recuperación del cambio desde la ficha del servidor. Se corrigió el refresco del catálogo al volver del perfil. La prueba no subió archivos ni efectuó pagos.

Las pruebas afectadas comprobaron denegación de AAL1, ausencia de autoaprobación, rechazo con motivo, validación de servicio/ubicación, rechazo de cambios concurrentes, revisión de identidad, suspensión/reactivación, historial y permisos entre barberías. Se comprobó separadamente el SQL de Storage (no su servicio HTTP), y se revirtió toda la metadata de archivo de ensayo. Build aprobado. No se repitió la auditoría general.

Antes de migrar producción se exportó un respaldo completo cifrado nuevo, con 56 tablas y cero objetos de Storage, y se restauró en una base aislada. La migración 012 se ensayó allí en una transacción revertida. Al aplicarla, los hashes de las filas existentes de barberías, perfiles, servicios, horarios, reservas, pagos, reseñas y media permanecieron idénticos. Evidencias privadas: `MERYO-deployment/shop-operations-{rehearsal,applied,ui-proof}.json`; las credenciales y los respaldos no están en Git.

## Archivos: preparado, aún bloqueado

El código incluye carga, previsualización, sustitución y retirada lógica de portada/fotos/video con rutas nuevas, sin sobrescribir ni borrar objetos. Bucket privado `meryo-shop-content`; formatos JPG/PNG/WebP y MP4/WebM; hasta 5 MB por imagen y 20 MB por video; RLS por propietario y visibilidad pública solo al estar aprobada. Se comprueba metadata de tamaño, MIME y propietario del objeto antes de registrar el contenido. Los enlaces temporales duran 5 minutos; retirar conserva el objeto y deja de emitir enlaces públicos.

**Las subidas permanecen deshabilitadas en SQL y en la pantalla** (`shop_content_settings.uploads_enabled=false`). Hace falta demostrar carga, descarga, sustitución y permisos con el servicio real de Supabase Storage en un entorno separado. La instancia local solo tiene sus definiciones SQL recuperadas para probar políticas; no se creó un sustituto de Storage ni se presentan estas pruebas como un servicio real.

Con autorización se consultó la posibilidad gratuita: el panel Supabase indica que el propietario de la organización ya alcanzó el límite de dos proyectos gratuitos activos y bloquea crear otro. No se pausó, borró, actualizó de plan ni modificó ningún otro proyecto. La conexión necesaria es un proyecto Supabase de pruebas con cupo gratuito disponible; nunca enviar claves por chat.

También falta resolver capacidad del respaldo antes de habilitar cargas comerciales: la copia externa gratuita actual tiene un límite preventivo de 12 MiB por archivo completo. Un video o varias imágenes pueden superarlo; entonces el job falla y alerta, sin borrar contenido ni comprar capacidad. No se promete respaldo continuo ni pérdida cero.

## Pendientes del encargo completo

Esta entrega no completa aún el panel administrativo global: faltan informes de reservas/importes/pagos verificados/ingresos MERYO, consulta de usuarios, detalle de reservas e integración del estado verificable de los respaldos en el panel. El resumen publicado cuenta barberías reales por estado; no inventa ingresos o planes.

Faltan invitaciones de equipo con aceptación desde sus propias cuentas, permisos de integrantes y agenda individual por barbero (incluidas asociaciones servicio/barbero, descansos y bloqueos individuales). No se invita personal desde un campo que le asigne roles directamente. Se conserva la agenda existente por barbería hasta cerrar y probar ese contrato.

Push con aplicación cerrada y sonido sigue pendiente de prueba real en dispositivo. Pasarela, mensualidades y condiciones comerciales continúan sin activar. Se mantienen 15 minutos de respuesta y 10 minutos de pago, con confirmación exclusiva del servidor.

La publicación móvil todavía requiere su bloque específico; este cambio no agrega una autenticación distinta ni modifica el contrato de sesiones existente. No se contrataron servicios ni se utilizó Docker.
