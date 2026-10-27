# Esquema de prueba de Storage

Solo definiciones SQL del entorno nativo existente y versiones/hashes de migraciones oficiales. No contiene filas de usuarios, factores MFA, sesiones, contenido, claves ni credenciales. Se exporta con `scripts/export-storage-ci-schema.mjs`; no se aplica a producción.

El workflow manual `meryo-storage-isolated.yml` compila versiones fijadas de Supabase Auth y Storage, usa PostgREST oficial y PostgreSQL 17 nativo en un runner Ubuntu estándar del repositorio público. No usa Docker ni secretos de producción. Solo crea cuentas, factores, datos y archivos sintéticos efímeros. La pasarela queda bloqueada.

El test HTTP comprueba el mismo cliente/API de MERYO con archivos reales (PNG y MP4 sintéticos): carga, descarga con comparación de bytes, privacidad antes de aprobación, rechazo de acceso entre barberías, formato/tamaño, reemplazo y retirada sin borrado, aprobación con MFA, catálogo y disponibilidad. La existencia del workflow no acredita que haya pasado: consultar su ejecución y `meryo-storage-proof.json` en el resumen del job.

Esto no añade un proyecto alojado ni cambia el límite gratuito de Supabase. El runner se destruye al terminar y no es un nuevo backend comercial.
