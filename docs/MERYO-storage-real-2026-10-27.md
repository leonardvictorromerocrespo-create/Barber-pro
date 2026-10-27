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

## Copia independiente comprobada y habilitación

La comprobación técnica anterior pasó. Antes de activar cargas se resolvió el límite previo de 12 MiB del destino artifacts: un video permitido puede ocupar 20 MB. Drive sustituye ese destino para las nuevas copias; los artifacts anteriores no se borran.

Se reutilizó el cliente dedicado de Google Drive y el usuario completó el consentimiento. El secreto está configurado en GitHub, fuera del código. El workflow sube únicamente el archivo cifrado, comprueba cuota gratuita y carpeta privada, descarga con hash idéntico y restaura esa descarga en PostgreSQL aislado antes de declarar éxito. Evita subir simultáneamente archivos grandes al almacenamiento limitado de artifacts. La carpeta queda fijada en la conexión privada y puede recuperarse por metadatos de la aplicación; no se crea un destino nuevo cada día.

Ejecución externa aprobada: https://github.com/leonardvictorromerocrespo-create/Barber-pro/actions/runs/40524260498 . La descarga independiente restauró 66 tablas y cuatro archivos del archivo de respaldo, con integridad verificada. Storage de producción contenía cero objetos: no se declara haber restaurado fotos de clientes que todavía no existen. La prueba de contenido binario y permisos corresponde al entorno oficial aislado descrito arriba.

Drive tiene límite de seguridad de 250 MiB por copia, programación diaria 03:17 Lima y conservación de 30 días. Las copias anteriores propias pasan a la papelera recuperable; no se purgan archivos personales. La papelera también puede consumir cuota hasta su vaciado automático por Google. La cuota se comparte con la cuenta Google y puede agotarse. GitHub puede retrasar u omitir ejecuciones programadas; no se garantiza pérdida cero ni recuperación continua. Las alertas existentes por fallos permanecen. Las ejecuciones y la restauración se realizan en el runner de GitHub: no necesitan la PC encendida ni el USB conectado.

La migración incremental 015 habilita únicamente el indicador de cargas ya probado y actualiza su mensaje de configuración. El script de publicación exige el ensayo revertido, la prueba oficial de Storage y la verificación directa de la ejecución externa exitosa y reciente. Comprueba que Storage no haya cambiado desde el respaldo vacío antes de activar. No cambia políticas RLS, datos de barberías, roles ni pagos. Se mantienen cobros y suscripciones bloqueados.
