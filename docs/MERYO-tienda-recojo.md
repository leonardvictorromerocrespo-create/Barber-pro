# MERYO · tienda de recojo

La tienda usa el bucket privado `meryo-shop-content` para fotos y las notificaciones/outbox ya existentes. Los productos y pedidos se añaden mediante la migración incremental `db/incremental/021_product_pickup_store.sql`; no se reutilizan las reservas de citas ni sus temporizadores.

## Rutas

- Cliente: abrir una barbería y pulsar **Tienda** en su perfil.
- Cuenta del cliente: `/#my-orders`; un aviso específico usa `/?pedido=<UUID>#my-orders`.
- Productos del negocio: `/?shop_view=tienda#shop-manage`.
- Pedidos del negocio: `/?shop_view=tienda&tienda_view=pedidos#shop-manage`.
- Solicitud push de negocio: incluye `pedido=<UUID>` y `pedido_origen=negocio`; si falta sesión, el destino se conserva y solo una cuenta de propietario puede abrir el pedido mediante RPC/RLS.

## Reglas servidor/base

- Solicitar copia nombre, descripción, precio y foto, y calcula el total en SQL. La clave de reintento evita duplicar el mismo envío. Solicitar no reserva stock.
- Aceptar bloquea el pedido y todos sus productos en orden de ID, comprueba publicación, precio y stock para todas las líneas y luego resta unidades en una sola transacción. Un fallo deja el pedido pendiente y el stock intacto.
- Cancelar o expirar acepta solo una transición desde stock reservado; entrega consume las unidades. `pg_cron` procesa vencimientos cada minuto y los listados pasan por la misma función para reflejar el estado actual.
- Los productos con historial no se borran. Los pedidos llevan snapshots y RLS limita lectura a su cliente y al propietario.
- Fotos permanecen privadas: se pueden firmar para el propietario, producto publicado de barbería visible o participante de un pedido.
- El pedido es exclusivamente para recojo y pago en el local. No invoca una pasarela ni toca reservas de citas.

## Validación aislada

El workflow manual `.github/workflows/meryo-storage-isolated.yml` utiliza un runner GitHub efímero con PostgreSQL nativo, Auth, PostgREST y Storage oficiales, sin Docker ni credenciales de producción. El script crea solo cuentas, archivos y pedidos sintéticos; cubre solicitud idempotente, aislamiento, precio congelado, aceptación concurrente, fallo sin aceptación parcial, expiración/liberación una sola vez, cancelación, entrega y notificaciones de pedido. La corrida y su resumen deben pasar antes de aplicar esta migración o desplegar el nuevo worker.
