# Selector de ubicación: zoom y confirmación

Alcance exclusivo: selector Leaflet ya publicado, sin cambios de Auth, MFA, SQL, datos, reservas ni cobros. No se inició PostgreSQL, Docker ni otro proveedor. Componente aislado servido por Vite en localhost usando las dependencias existentes.

## Hallazgo y cambio

- Con los botones + se observaron teselas distintas `/12/`, `/13/` y `/18/` cargadas, con calles y edificios. No se reprodujo un bloqueo del proveedor con esos botones. La rueda estaba desactivada. Ahora rueda y gesto táctil están habilitados explícitamente; nivel máximo nativo 19, sin ampliación ficticia de niveles superiores. Se retiró la animación que estiraba las teselas previas durante el cambio y se actualiza el tamaño al cambiar el contenedor, conservando el nivel y el punto. Las fallas de teselas muestran aviso y Reintentar mapa.
- Lima solo centra la vista inicial. Ni el centro ni coordenadas entrantes no guardadas crean una selección válida.
- Clic y arrastre confirman expresamente el punto elegido. Geolocalizar primero invalida la confirmación anterior. Fallo/denegación no deja punto confirmado; un resultado correcto es candidato hasta Confirmar esta ubicación o ajuste manual. Una respuesta tardía de geolocalización no reemplaza una selección manual posterior.
- Las ubicaciones previamente guardadas se conservan y se identifican como guardadas, sin afirmar una geolocalización nueva. Intentar geolocalizar y fallar exige volver a seleccionar antes de guardar. No se reescriben registros existentes automáticamente.
- Registro y edición de perfil bloquean guardar si el selector no está listo, incluso con coordenadas numéricas presentes. La API de registro sigue recibiendo únicamente sus campos existentes; la bandera de confirmación es estado de interfaz.

## Comprobación específica

- Cuatro pruebas de estado: Lima inicial, fallo tras selección, posición candidata/confirmación, ajuste manual y rangos válidos. Una prueba de pantalla comprueba el botón de registro bloqueado con Lima sin confirmación. Lint del selector y su modelo de estado aprobado; build aprobado.
- Navegador aislado, con las mismas hojas de estilo y Leaflet: en nivel 19 se observaron seis imágenes `https://tile.openstreetmap.org/19/...png` completas y con ancho natural positivo. Botones y rueda solicitan niveles nuevos. Calles/edificios distinguibles y clic preciso conserva ese nivel.
- Escenarios de geolocalización controlados solo en la página temporal del componente, sin Auth ni API: permiso denegado no muestra seleccionada y deja Guardar deshabilitado; posición correcta mantiene Guardar deshabilitado hasta Confirmar esta ubicación. No equivalen a una prueba de permiso/GPS en un teléfono real y no se incluyeron esos dobles de prueba en producción.
- Evidencia privada: `location-failed-not-confirmed.png`, `location-street-zoom19.png`. Las coordenadas de esa página eran puntos públicos de prueba, no una ubicación privada del usuario. No hubo escrituras en producción.
