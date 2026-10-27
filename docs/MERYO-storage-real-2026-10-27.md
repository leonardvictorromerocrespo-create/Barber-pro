# Storage comprobado con los servicios oficiales

Ejecución aprobada: https://github.com/leonardvictorromerocrespo-create/Barber-pro/actions/runs/40522430522

El runner temporal gratuito de este repositorio público ejecutó PostgreSQL 17, Supabase Auth, PostgREST y el servidor oficial de Supabase Storage con backend de archivos en Linux. No utilizó Docker, otro proyecto Supabase, claves de producción ni archivos de clientes. El esquema y las políticas se recuperaron sin filas de la base nativa existente; solo se aprovisionaron los permisos de servicio privilegiado que el entorno alojado proporciona normalmente, sin ampliar permisos de clientes.

Recorrido HTTP/SDK comprobado:

1. Cuentas Auth reales sintéticas; administración sin MFA rechazada y aprobación con TOTP/AAL2 real.
2. Propietario registra perfil y servicio y sube un PNG. Descarga con igualdad exacta de bytes; catálogo y firma anónimos rechazados antes de aprobar.
3. Subidas y retiradas entre barberías rechazadas; formato HTML y exceso de tamaño rechazados.
4. Sustitución de portada conserva el archivo anterior. Subida de MP4 real generado para la prueba.
5. Administrador revisa y aprueba. Catálogo anónimo muestra servicio y archivos aprobados; descarga del video idéntica al original y disponibilidad individual no vacía.
6. Retirar contenido lo oculta y evita nuevas firmas públicas, conservando sus bytes almacenados. Una URL firmada emitida previamente conserva su vida máxima de 300 segundos.

No equivale a una prueba sobre el S3 alojado ni a un recorrido visual completo de cargas desde Windows. La integración utiliza el SDK y servidor oficiales; no existe una imitación local de Storage.

## Habilitación comercial pendiente

El indicador de subidas de producción continúa desactivado. La comprobación técnica anterior ya pasó; falta ampliar y comprobar el destino gratuito del respaldo completo: GitHub conserva actualmente copias cifradas de hasta 12 MiB durante 30 días y un video permitido puede ocupar 20 MB.

Se reutiliza el cliente dedicado de Google Drive previamente autorizado. Su conexión OAuth todavía requiere consentimiento de la cuenta. Está preparado un destino opcional en el workflow existente: si se configura su secreto privado, sube únicamente el archivo cifrado, comprueba cuota gratuita y carpeta privada, descarga con hash idéntico y restaura esa descarga en PostgreSQL aislado antes de declarar éxito. Evita subir simultáneamente archivos grandes al almacenamiento limitado de artifacts. Sin conexión, el respaldo existente de GitHub conserva su comportamiento de 12 MiB.

La alternativa Drive tendrá límite de seguridad de 250 MiB por copia, programación diaria 03:17 Lima y conservación de 30 días. Las copias anteriores propias pasan a la papelera recuperable; no se purgan archivos personales. La cuota se comparte con la cuenta Google y puede agotarse. GitHub puede retrasar u omitir ejecuciones programadas; no se garantiza pérdida cero ni recuperación continua. Las alertas existentes por fallos permanecen.

No se declara Drive activo hasta observar subida, descarga y restauración reales ejecutadas sin la PC. Se mantienen cobros y suscripciones bloqueados.
