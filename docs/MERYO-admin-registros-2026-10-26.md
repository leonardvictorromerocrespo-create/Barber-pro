# Administración: usuarios, reservas y resumen

Usuarios: búsqueda por nombre, correo, teléfono, barbería o ID, filtros por rol/propiedad y acceso, páginas de 50 registros y ficha con datos mínimos del perfil. No se exponen secretos de Auth ni se habilitan cambios de rol.

Reservas: filtros de fechas de las citas en Lima, barbería, estado y búsqueda por cliente/servicio/ID; detalle con importes, datos de contacto necesarios, vencimientos y fechas realmente guardadas. El nuevo historial registra operaciones posteriores a la migración, sin inventar eventos previos. Identifica datos relacionados con demos.

Resumen: contadores de barberías, reservas por estado, importe solicitado y pagos de producción respaldados por recibos verificados del servidor y aún pagados. No confunde una solicitud con un cobro. Ingresos por mensualidad y suscripciones figuran como no habilitados, sin cifras inventadas; se excluyen los cinco demos confirmados.

Los cuatro RPC exigen `es_admin()` del servidor, que conserva el perfil real, sesión vigente, AAL2 y factor verificado. Ningún cliente o barbero puede consultar esta información administrativa. Se conserva el módulo anterior de revisión de barberías.

Pruebas específicas: 4 comprobaciones nativas con Auth/PostgREST reales, filtros y transiciones de una solicitud sintética rechazada sin pago; prueba de render que detecta fechas inválidas y evita mostrar totales antes de la respuesta del servidor. Recorrido de pantallas: sesión administrativa local con MFA → búsqueda y detalle del propietario → rango de fechas y búsqueda por ID → detalle de reserva e historial. El formulario lee las fechas visibles al enviarse, incluso si el navegador las completa sin emitir el evento React habitual.

Antes de migrar se realizó un nuevo respaldo cifrado de 60 tablas y se restauró en una base aislada. El ensayo transaccional de 013 preservó filas y permisos. No hubo datos sintéticos en producción. La evidencia y los backups permanecen fuera de Git.

Enlaces: `/?admin_view=usuarios#admin`, `/?admin_view=reservas#admin`, `/?admin_view=resumen#admin`. Estos parámetros eligen una pantalla; no conceden permisos. El acceso tras Google conserva los controles existentes.
