# Destacados y Más gustados en Barberías

La migración `031_barber_catalog_highlights.sql` añade campañas patrocinadas y votos de clientes. Validarla en una base aislada antes de publicarla. El catálogo habitual sigue disponible si la migración aún no está aplicada.

## Operación de campañas

Precio piloto aprobado: **S/ 19 por 7 días** en Destacados. Es un cargo separado de la mensualidad; no modifica los Me gusta.

Tras verificar el pago por un canal autorizado, un operador de base de datos registra una fila en `meryo_private.barber_featured_campaigns` con el ID de la barbería, inicio, fin, fecha de pago y referencia única de conciliación. Usar una referencia interna, no credenciales ni datos de tarjeta. La fila no genera ni procesa un pago. Si se revierte el pago, retirar la campaña correspondiente. El carrusel solo muestra campañas pagadas dentro de su período y de negocios activos y verificados. Los filtros del catálogo también se aplican al carrusel.

## Verificación antes del despliegue

- Comprobar campañas vigentes, futuras, vencidas y negocios inactivos con datos ficticios.
- Confirmar que dos clientes distintos pueden votar, que repetir el voto no lo duplica y que retirar el voto modifica el ranking.
- Confirmar que una sesión anónima puede consultar estadísticas, pero no votar ni leer datos privados; el perfil profesional tampoco puede votar.
- Revisar en móvil que el buscador y los accesos permanezcan visibles al bajar, que el carrusel se pueda arrastrar y que la ayuda de movimiento se omita con movimiento reducido.
- Antes de vender espacios, definir el canal de pago. No hay cobro automático ni autoservicio de compra en este cambio.
