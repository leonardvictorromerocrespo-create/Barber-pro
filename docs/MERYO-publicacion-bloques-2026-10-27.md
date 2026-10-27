# Bloques publicados el 27 de octubre de 2026

Sitio: https://barber-pro-phi-taupe.vercel.app

Despliegue vigente: `dpl_GZyHJXXDtDiFY9tW8xYx7yLSohmg`. Commits funcionales: administración `b68667c`, equipo y agenda `434644d`, respaldo externo `f29b317` y habilitación verificada de contenido `5226c4e`. Migraciones incrementales 013, 014 y 015 aplicadas después de sus comprobaciones. Datos anteriores conservados; ningún dato de prueba ni archivo de cliente usado para pruebas en producción.

## Acciones utilizables

- Administración con Google, rol real y MFA: `/?admin_view=usuarios#admin`, `/?admin_view=reservas#admin` y `/?admin_view=resumen#admin`. Búsqueda, filtros y detalle; revisión, aprobación, rechazo con motivo, suspensión, reactivación e historial conservados.
- Propietario: `/?shop_view=equipo#shop-manage` para invitar cuentas verificadas y asignar servicios; `/?shop_view=agenda#shop-manage` para jornadas, descansos y bloqueos individuales. Integrantes acceden a su agenda autorizada. Las invitaciones se comparten personalmente: no se promete envío automático.
- Contenido: `/?shop_view=contenido#shop-manage`, imágenes de hasta 5 MB y video de hasta 20 MB, bucket privado y publicación condicionada a la aprobación del local. Sustituir o retirar conserva archivos. Las firmas ya emitidas duran hasta cinco minutos.
- Cliente: `/#client`, explora sin sesión, elige servicio e integrante y consulta disponibilidad real; login conserva selección. Solicitud manual de 15 minutos, aceptación y ventana de pago de 10 minutos. El servidor evita superposiciones y libera vencimientos. La pasarela no está integrada; no se cobra ni se simula confirmación.

Los enlaces solamente seleccionan pantallas; no conceden roles. El catálogo público contiene cero barberías aprobadas reales al comprobarlo: mantiene el mensaje vacío y excluye las cinco demos confirmadas.

## Evidencia reutilizable

- Pruebas específicas de SQL nativo con Auth y PostgREST reales: invitaciones ligadas a correo, aislamiento de roles, edición segura, servicios ajenos rechazados, jornadas y duración, bloqueos, concurrencia y prohibición de confirmar por UPDATE directo.
- Recorrido visual local de equipo y reserva: invitación, aceptación, servicio asignado, jornada/descanso/bloqueo/edición, horarios públicos descontados, login con borrador, solicitud, aceptación y vencimiento sin pago. No se repitieron las auditorías generales.
- Storage oficial aislado: https://github.com/leonardvictorromerocrespo-create/Barber-pro/actions/runs/40522430522 . Subida y descarga exacta de PNG y MP4, privacidad antes de aprobar, MFA, catálogo publicado y permisos entre barberías comprobados mediante SDK/HTTP. No se presenta como un recorrido visual de cargas ni como una prueba sobre S3 de producción.
- Drive externo: https://github.com/leonardvictorromerocrespo-create/Barber-pro/actions/runs/40524260498 y https://github.com/leonardvictorromerocrespo-create/Barber-pro/actions/runs/40525288534 . Dos archivos cifrados en la misma carpeta privada; las dos descargas se restauraron en el runner. Sesenta y seis tablas y cero objetos de Storage existentes; integridad de los archivos del respaldo comprobada.
- Build local y build de Vercel aprobados. Lectura pública posterior confirma cargas habilitadas, pagos deshabilitados y catálogo sin demos. El panel publicado conserva la sesión real de administración y MFA.

## Respaldos y límites

GitHub ejecuta la tarea diaria a las 03:17 Lima, usando conexiones privadas de Supabase y Drive y sin procesos locales ni USB. El respaldo incluye PostgreSQL con Auth, metadatos y objetos actuales de Storage; la clave de descifrado se conserva separada. Los objetos retirados siguen almacenados y también forman parte de las copias siguientes. Cada ejecución comprueba espacio libre, descarga y restaura antes de marcar éxito. Conservación de 30 días; archivos antiguos propios pasan a papelera recuperable. No se adquirió capacidad adicional.

El límite de seguridad es 250 MiB por copia y la cuota Drive se comparte con otros servicios de la cuenta; puede agotarse. Un cambio concurrente de Storage invalida el respaldo y genera fallo, en vez de prometer una copia consistente incompleta. El scheduler de GitHub puede retrasarse; el objetivo es diario, sin promesa de pérdida cero. Las alertas existentes registran fallos en GitHub. La configuración de proveedores administrados requiere sus registros privados además del SQL.

## Pendientes para lanzamiento comercial completo

- Integrar y validar la pasarela real antes de habilitar cobros o confirmar pagos.
- Comprobar entrega push y sonido con la aplicación cerrada en el celular del usuario; Realtime no sustituye esa prueba.
- SMTP continúa sin configurar por decisión del propietario; Google es el acceso operativo.
- Los locales reales deben completar su registro con cuenta propietaria y obtener aprobación. No se asignó una identidad por suposición al perfil histórico que carece de propietario identificado.
