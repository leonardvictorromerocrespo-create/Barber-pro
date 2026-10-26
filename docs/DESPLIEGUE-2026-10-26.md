# Publicación autorizada de MERYO

El propietario autorizó reutilizar Vercel `barber-pro` y Supabase `prdmcjykjpxpcomonwuy`, sin contratar servicios. No se autorizan cobros reales. La autorización de publicación reemplaza la prohibición anterior de desplegar; el push requiere aclaración expresa por la restricción anterior.

## Bloque terminado: recuperación antes de migrar

Conexión PostgreSQL real verificada con certificado CA descargado desde el vínculo oficial del panel y nombre de servidor validado. Se corrigió la incompatibilidad de `StandardInputEncoding` con Windows PowerShell y se comprobó el transporte UTF-8 sin credenciales reales. El propietario restableció personalmente únicamente la contraseña SQL de meryo al desconocer la anterior. La contraseña vigente se introdujo en el asistente privado, fuera de Git, sin desactivar SSL.

Respaldo de PostgreSQL 17.6 en formato custom, esquema completo y roles sin contraseñas de roles, además de inventario de buckets y archivos actuales. Cuentas y datos de Auth incluidos. El esquema completo sigue dentro de la copia cifrada; no es un archivo de ejemplo ni la fixture nativa. Las claves de API existentes se guardaron en archivos privados separados; ninguna clave service_role se usa en variables VITE.

Copia previa: `2026-10-26T18-46-00.638Z.hosted.meryo.enc`, 1 035 300 bytes. Cifrado AES-256-GCM y descifrado autenticado comprobados. Restauración desde el archivo cifrado en una base nueva del cluster nativo existente, `meryo_restore_hosted_1793040594669`: conteos coincidentes de las 47 tablas de public/Auth/Storage y hashes de los cuatro archivos de respaldo coincidentes. Storage contiene cero objetos: no se afirma una prueba de subida o restauración de archivos inexistentes. No se restauró sobre producción ni sobre la aplicación local.

Esto verifica recuperación SQL y la integridad de objetos que existan; no emula los servicios Supabase Auth, Storage API ni Realtime. Las extensiones de plataforma permanecen en el archivo completo, aunque no se ejecutan en la restauración nativa. La configuración de proveedores OAuth, secretos de roles personalizados y configuración del hosting requieren custodia/configuración separadas.

Las diez migraciones incrementales existentes se aplicaron dentro de una transacción en la copia REAL recuperada. Pasaron sus guardas de deriva y todas las sentencias; la transacción de ensayo se revirtió. No se repitieron las suites históricas ni se aplicó el candidato meryo. Aún no se aplicaron a producción.

## Copia externa gratuita preparada, aún no activa

Workflow `.github/workflows/meryo-hosted-backup.yml`: diario a las 03:17 America/Lima, ejecución manual adicional, runner estándar Ubuntu con PostgreSQL nativo (sin Docker), exportación de lectura consistente y archivo cifrado. Restaura en PostgreSQL efímero del runner antes de subir únicamente el cifrado como artifact con retención de 30 días. No depende del PC ni del USB.

Cada copia es independiente de las modificaciones/borrados posteriores de la base y conserva el contenido de Storage que exista al tomarla. No es sincronización con borrado propagado. No captura un archivo creado y eliminado entre dos copias y no puede recuperar versiones anteriores al primer respaldo. Rechaza cambios de Storage durante la captura en vez de declarar falsa consistencia.

Límite conservador de 12 MiB por archivo (aproximadamente 360 MiB para 30 copias). Si se supera, falla y avisa; no compra almacenamiento ni omite archivos silenciosamente. Revisar el consumo y la política gratuita vigente de GitHub/Supabase antes de la primera activación. Los snapshots diarios no garantizan pérdida cero ni un RPO máximo: el scheduler de GitHub puede retrasar u omitir ejecuciones.

Un fallo de ejecución crea o actualiza una incidencia asignada al propietario. La recepción de avisos depende de sus notificaciones de GitHub; no está probada. Una caída del scheduler que impida iniciar el workflow no genera ese aviso: sigue pendiente monitoreo externo independiente. Borrar el repositorio o sus artifacts puede eliminar estas copias; no hay inmutabilidad WORM ni retención resistente al administrador. La clave de recuperación sigue requiriendo custodia USB separada.

Pendiente para activar: autorización de subir código/workflow a main, secretos en GitHub configurados privadamente, primera ejecución completa y descarga/restauración de su artifact. Hasta completar eso no se declara activa la copia externa.

## Publicación preparada

Vercel está autenticado y el proyecto existente no tenía variables de entorno. Su plan actual es Hobby. No se contrató ni cambió el plan; su limitación de uso no comercial debe resolverse antes de considerar esta publicación apta para operación comercial.

`vercel.json` conserva Vite y desactiva despliegues automáticos desde Git durante la transición. El despliegue CLI se prepara sin asignar todavía el dominio (`--prod --skip-domain`) y se promueve solo tras completar el backend y conexiones. No se cambia el diseño. Los cobros quedan bloqueados en SQL y frontend.

Referencias: [GitHub Actions y costos](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [retrasos del scheduler](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [Vercel Hobby](https://vercel.com/docs/plans/hobby), [despliegue sin promoción](https://vercel.com/docs/cli/deploy).
