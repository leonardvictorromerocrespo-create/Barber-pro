# Revisión puntual de Disk IO Budget

Proyecto: `prdmcjykjpxpcomonwuy`. Hora de alerta indicada por el usuario: 27 de octubre, 16:45 Lima (21:45 UTC). Solo métricas existentes, contadores de PostgreSQL con transacciones de lectura y timeout de cinco segundos, historial de cron y ejecuciones existentes de GitHub. Sin pruebas de carga, nuevos dumps/exportaciones, restauraciones ni contratación.

## Evidencia y límites

- El panel mantiene «about to deplete its Disk IO Budget» y explica una base de 5 MB/s. Para 16:30–17:00 Lima muestra Disk throughput **28,8 KB/s**, IOPS **2** y 17 conexiones. El valor de la ventana no demuestra la ausencia de un pico breve ni permite reconstruir el saldo histórico de créditos. No se identificó una causa única demostrada del aviso.
- Otras ventanas mostraron 565,8 KB/s (tres horas) y 280,6 KB/s (24 horas). Son ventanas distintas: no constituyen un antes/después causal. Algunas series inicialmente no cargaban; no se interpretaron como consumo cero.
- Los contadores acumulados mostraron 1.856 consultas de estado de citas (116.984,9 ms acumulados), 2.934 de estado push personal y 3.074 relacionadas con notificaciones. Son contadores acumulados, sin atribución minuto a minuto. Las lecturas de esas categorías se resolvían predominantemente desde buffers; no prueban por sí solas I/O físico excesivo a las 16:45.
- El código leía citas cada tres segundos y disponibilidad cada cinco, incluso con la pestaña oculta, sin exclusión de lecturas lentas. La API conservaba validación de cuenta y RLS.
- Ambos cron estaban activos cada minuto y sin fallos. El despertar de push se ejecutaba aun sin destinatario alcanzable. Un aviso de vencimiento seguía pendiente porque su destinatario no tenía dispositivo registrado; el emisor devolvía HTTP 200 sin poder enviarlo. Antes del ajuste hubo 20 respuestas de invocación en 20 minutos.
- GitHub registra cinco respaldos el día 27: inicios alrededor de 09:30, 09:45, 09:52, 10:30 y 11:04 Lima. El último terminó sobre las 11:05. Se relacionan con liberaciones anteriores; no hay respaldo de ese workflow a las 16:45. No se puede descartar consumo acumulado anterior. La programación diaria, cifrado, destino externo, conservación y verificación existentes permanecen intactos.
- Los cambios recientes del selector fueron código estático y pruebas locales de componente sin Auth/BD. Las teselas pertenecen al proveedor de mapas existente. No se ejecutaron exportaciones o restauraciones adicionales para esta revisión.

## Cambios mínimos

1. Lecturas periódicas de citas, disponibilidad y avisos del panel: 15 segundos, sin consultas mientras la pestaña está oculta, sin superposición; actualización al regresar y tras una operación guardada. Citas pasa de 20 a 4 sondeos/minuto visible; disponibilidad de 12 a 4. Son tasas configuradas por pantalla, no mediciones globales de reducción de disco. Los temporizadores visibles siguen usando el vencimiento del servidor y los relojes locales de un segundo no consultan la BD.
2. Migraciones incrementales 019/020: conservar cron de reintentos y trigger, pero no actualizar señal ni invocar pg_net si no existe trabajo vencido para un destinatario activo con dispositivo. La limpieza de trabajos de más de un día sigue pudiendo ejecutarse aun sin dispositivo. No se eliminó el aviso pendiente ni se cambió destinatario, reserva, rol o permiso.
3. El cuerpo anterior de `wake_push` se conservó íntegro salvo la guarda inicial; ACL y definición de `es_admin()` verificadas antes/después. La función nueva es privada y no ejecutable por anon/authenticated/service_role. Ninguna escritura en datos comerciales ni cambio de respaldos.

## Verificación

- Tres pruebas unitarias del sondeo: pestaña oculta/regreso, exclusión y actualización posterior a guardado, desmontaje. Sin tráfico de carga.
- Una comprobación sobre el PostgreSQL nativo existente, con rollback: cola vacía, futuro diagnóstico de 30 segundos, sin dispositivos, dispositivo disponible, lease activo/vencido, terminal y limpieza antigua. Preserva ACL y el cuerpo original del despachador. No se restauró ni creó otra base.
- Build aprobado. Los cambios SQL se aplicaron transaccionalmente tras esa comprobación, usando la evidencia de recuperación existente y sin generar otra exportación.
- **Resultado observado:** tras el ajuste final a las 21:17 Lima, cinco ejecuciones naturales del cron (21:18–21:22) tuvieron éxito, la señal quedó sin cambios y hubo **cero** respuestas HTTP nuevas del despachador. No se invocó manualmente el emisor ni se crearon reservas/notificaciones de prueba en producción. La reducción del trabajo vacío está demostrada. La recuperación del presupuesto de disco y una caída atribuible del throughput global aún no están demostradas.

Evidencia agregada privada, sin credenciales ni contenido de clientes: `io-budget-before.json`, `io-budget-correlations.json`, `io-idle-push-release.json`, `io-idle-push-after.json`. `scripts/inspect-io-budget.mjs` es de lectura y no reinicia contadores ni exporta filas comerciales. No confundir estas estadísticas con el respaldo de datos.
