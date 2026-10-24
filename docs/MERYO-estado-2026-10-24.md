# MERYO: preparación local para lanzamiento comercial

## Alcance y respaldo

No se desplegó, habilitó cobros ni aplicó SQL a producción. Se conserva la interfaz oscura/dorada y la aplicación existente. Se sustituyeron los textos visibles Barber Pro por MERYO y el título del navegador; no se rediseñó.

- Base remota: `aa7e1f9` en `main`; una rama y ningún PR al consultar GitHub.
- Preservación: `codex/preservar-avances-escritorio`, commit `4ca4fd2`, únicamente `src/App.jsx`.
- Trabajo: `codex/meryo-reservas-seguras`.
- Respaldo fuera del repositorio: `C:/Users/51934/OneDrive/Escritorio/MERYO-respaldo-20261024/App.jsx` y `aa7e1f9.patch`.
- SHA256 del original: `B9F52AB5D0069CC77E714AF2394B0D208344FBC39D6FA302B99372B0C7793C96`.
- Copia comprobada por hash; parche comprobado en reversa y aplicado sobre una copia de `aa7e1f9`, con igualdad del contenido recuperado normalizando CRLF/LF. Los scripts de edición y la copia recuperada están fuera del repositorio.

## Evidencia de infraestructura existente

El repositorio contiene frontend React/Vite y un cliente Supabase, sin backend propio, migraciones, RLS, funciones SQL, triggers, jobs, pruebas anteriores ni auditorías documentadas. No hay AGENTS.md aplicable encontrado. El README previo era la plantilla Vite.

El código referencia `barberias`, `profiles`, `reservas`, `notificaciones` y `reservas_ocupadas_publicas`; eso NO demuestra su definición, tipos, grants ni políticas. La consulta de metadatos falló por DNS (`ENOTFOUND`) para el proyecto configurado. No se consultaron filas ni se efectuaron escrituras remotas. El usuario preparará un export de solo esquema.

## Correcciones locales

- La ruta `barber-login` utiliza el formulario real existente. Se agregó `client-register` con validación HTML y `signUp`, sin asignar roles desde el navegador. El registro completo depende del aprovisionamiento seguro de perfiles por servidor, aún no verificado.
- `signOut` real, limpieza de datos locales al cerrar sesión y al recibir `SIGNED_OUT`; un error no se presenta como cierre satisfactorio.
- La restauración de perfil y el login de cliente exigen perfil activo.
- Una solicitud no se etiqueta como pago ni reserva confirmada. Métodos de pago deshabilitados; no existe cobro real.
- La creación de reservas y la aceptación/rechazo quedan bloqueadas por `reservationsEnabled = false` hasta integrar el esquema real. Los puntos de llamada RPC son preparación, NO integración lista. Lecturas antiguas siguen usando el esquema legado; falta mapear los contratos.
- No se escribe una notificación desde el navegador después de una inserción fallida. En el candidato SQL, reserva y notificaciones se guardan en la misma transacción.
- No se borran notificaciones a los cinco segundos. La reproducción de sonido maneja el rechazo del navegador.
- La afiliación verifica la fila guardada, no publica la barbería como activa de forma optimista. La activación administrativa exige una fila retornada.
- Se eliminó la comisión fija de S/5. La pantalla indica "Por definir"; el candidato admite solo 100 o 200 céntimos, o NULL hasta decidir el criterio. No existe reparto de fondos.

## Candidato SQL: deliberadamente separado del legado

`db/candidate/001_reservations.sql` CREA un esquema nuevo `meryo`; no pretende que estas tablas existan. Es un contrato ensayado, no una migración aprobada sobre datos reales. Fallará si el esquema ya existe, en lugar de sobrescribirlo.

- Modelo piloto explícito: un recurso de agenda por barbería, slots no superpuestos creados por servidor, servicios de hasta 60 minutos. Múltiples barberos, duración variable y horarios reales requieren adaptar el modelo al export y al producto antes de lanzamiento.
- `solicitada` bloquea el slot durante cinco minutos. Solo un barbero activo de esa barbería puede aceptar/rechazar.
- Aceptación produce `pendiente_pago`, con plazo configurado por servidor (300 segundos iniciales, límites 60–1800).
- Precio, adelanto del 50 % y comisión se calculan/leen en servidor, nunca se aceptan del navegador. Para importes impares en céntimos, el adelanto redondea hacia arriba un céntimo.
- `confirmada` exige llamada de un verificador de servidor mediante `service_role`. Cliente/barbero no tienen EXECUTE. Se exige importe del adelanto, PEN, referencia y proveedor; las referencias son únicas y la repetición del mismo pago es idempotente.
- La función no verifica firmas del proveedor: esa responsabilidad corresponde al adaptador de pagos que aún NO existe. El nombre `test-provider` aparece únicamente en pruebas y no identifica un proveedor comercial.
- Pagos fuera de plazo no resucitan una reserva. Requieren conciliación/devolución externa; no se ha implementado una devolución automática.
- Bloqueo de fila del slot, índice único parcial de reserva activa y transacciones previenen dobles reservas. Las transiciones vuelven a leer el estado después del bloqueo.
- RLS limita lectura de reservas a cliente propietario y barbero de la barbería; datos de otros clientes/negocios no son visibles. No hay escrituras directas para usuarios. Cuentas, roles, precios y configuración requieren mantenimiento confiable del servidor.
- Rechazo, cancelación sin pago y vencimiento liberan el slot. Cancelaciones ya pagadas se rechazan hasta definir devoluciones. Reprogramación aún pendiente de diseño e implementación atómica.
- Expiración se comprueba con reloj del servidor al consultar disponibilidad, solicitar, decidir y verificar pago. Un job de barrido persiste vencimientos y genera notificaciones. `002_expiration_scheduler.sql` es una plantilla opcional para pg_cron, NO ejecutada ni validada en este entorno.
- Notificaciones durables en base de datos no equivalen a entrega push, email o WhatsApp. Falta canal, reintentos y monitoreo.

## Validación sin Docker

Se abrió Docker para intentar PostgreSQL aislado. Las pruebas no llegaron a completar allí. A petición del usuario, se detuvo ÚNICAMENTE `meryo-local-audit-20261024`, sin eliminar contenedor, volúmenes o datos ni detener otros proyectos. Docker no es requisito del proyecto.

Se utilizó PostgreSQL nativo 17.11 ya instalado, en cluster exclusivo:

- Datos: `%LOCALAPPDATA%/MERYO-tests/pg17-20261024`.
- Escucha: `127.0.0.1:55440`, usuario de prueba `meryo_test_admin`, base `meryo_test`.
- Memoria compartida: 32 MB; máximo 20 conexiones. Sin datos personales ni credenciales de producción.
- Auth de prueba local `trust`; la instancia se detiene al finalizar. No es configuración para alojamiento o producción.
- `auth.uid()` y los roles Supabase se simulan en esa base. Esto valida PostgreSQL/RLS, no JWT, PostgREST ni Auth reales.

Repetir: iniciar SOLO este cluster con `powershell -File tests/setup-db.ps1`, ejecutar `npm run test:db`, y detenerlo con:

```powershell
& 'C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe' -D "$env:LOCALAPPDATA\MERYO-tests\pg17-20261024" -m fast -w stop
```

Las pruebas tienen dirección, puerto y nombre de base locales fijos; no leen DATABASE_URL ni variables de producción. Recrean únicamente los esquemas `meryo` y `auth` de `meryo_test`; no apuntar esta suite a otra base. Para otro equipo, crear primero un cluster aislado y esos roles/base, o adaptar explícitamente la configuración tras revisar el destino.

Resultados: build y ESLint aprobados; cinco pruebas unitarias aprobadas (errores, cierre de sesión, comisión y verificación de perfiles al iniciar sesión). Suite PostgreSQL: once escenarios aprobados más su prueba contenedora, cero fallos. Casos: transiciones, roles inactivos, elevación de permisos, RLS entre barberías/clientes, diez solicitudes concurrentes con un único ganador, aceptación concurrente, expiración, cancelación/pago concurrentes, recibos duplicados, importe incorrecto y rollback si falla notificación. No se deben confundir estos resultados con un E2E del proveedor.

Revisión de navegador local: landing, acceso barbero y registro cliente renderizados; no se enviaron formularios ni credenciales.

Dependencias: `npm audit fix` sin `--force` actualizó versiones compatibles en el lockfile; resultado final reportado por npm: cero vulnerabilidades conocidas en 199 paquetes. No equivale a ausencia de vulnerabilidades desconocidas. `pg` se añadió solo como dependencia de desarrollo para probar PostgreSQL real. Se ignoran archivos `.env` para evitar incorporarlos por accidente.

## Bloqueos para lanzamiento comercial (orden)

1. Export de esquema real: tablas/tipos, constraints/índices, funciones, triggers, vistas, RLS, grants y jobs. Sin datos, contraseñas ni claves. Confirmar que la URL configurada pertenece al proyecto vigente.
2. Proyecto Supabase de staging separado, usuarios sintéticos cliente/barbero/admin y catálogo/agenda de prueba. Acceso por invitación con permisos mínimos; configurar secretos fuera de Git/chat. Mapear IDs y estados legados, conservar datos/diseño, diseñar migración y rollback y probarlos sobre copia sanitizada.
3. Integrar frontend y RPC con ese esquema; comprobar registro/perfiles, sesión, roles revocados, lecturas de agenda e historial. El bloqueo de reservas no debe levantarse solo porque el SQL local pasó.
4. Seleccionar/confirmar proveedor con sandbox y capacidades reales. Implementar creación de pago por servidor, firma de webhook, consulta autoritativa, comerciante/moneda/importe, idempotencia, conciliación y pagos tardíos. No hay proveedor validado ni cobros habilitados.
5. Definir criterio de comisión S/1 o S/2, cancelaciones/devoluciones y reprogramaciones. No implementar reparto de fondos sin soporte confirmado.
6. Validar en staging el recorrido completo con dos navegadores y sesiones distintas, fallos/reintentos, expiración sin navegador abierto, notificaciones, webhook duplicado/tardío, doble reserva y acceso cruzado. Activar y observar job/notificaciones allí.
7. Solo después: revisión de lanzamiento, monitoreo, copias/recuperación, configuración de producción y autorización explícita para desplegar/habilitar cobros. Este trabajo no autoriza ese paso.
