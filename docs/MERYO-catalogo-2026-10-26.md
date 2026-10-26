# Corrección del catálogo público

Los cinco perfiles publicados venían de `public.barberias` en Supabase. Elite Fade Studio coincide además con el seed `INITIAL_SHOPS` de `aa7e1f9`. El propietario confirmó expresamente los cinco como pruebas: IDs 1, 5, 6, 7 y 8. El ID 9 pendiente se conserva sin clasificar.

La migración incremental 011 agrega una clasificación privada reversible por ID. No borra ni cambia las filas de barberías, perfiles, servicios, reservas, pagos o reseñas. Las políticas restrictivas excluyen esos IDs de la lectura pública antigua; dueño asignado y administrador real con MFA conservan su acceso privado bajo las políticas existentes. El RPC del catálogo siempre excluye demos, incluso cuando lo llama un administrador.

Se retiraron el ranking semanal sin métricas, posiciones numeradas y cifra ficticia de 120 afiliadas. Las puntuaciones solo se calculan desde filas reales de `resenas`, sin usar los contadores heredados. Sin reseñas se muestra esa ausencia. El orden inicial es por nombre. Sin barberías reales activas y aprobadas aparece «Próximamente encontrarás barberías aquí». Carga y error tienen estados distintos.

Verificación específica: ensayo transaccional sobre la copia nativa previamente restaurada del respaldo de producción; lectura anónima y autenticada sin exposición de demos; nueva barbería de igual nombre y diferente ID visible; contador heredado sin reseñas ignorado. Las filas originales se compararon antes y después y quedaron idénticas. Todo dato de ensayo se revirtió. Las 16 pruebas afectadas de catálogo/API/render pasaron y el build terminó correctamente. No se repitió la auditoría general ni se usó Docker.

Antes de aplicar se verificó cifrado/descifrado e igualdad de un snapshot de los datos afectados, guardado fuera de Git, además del respaldo completo externo ya restaurado. La ejecución y los hashes se conservan en `%LOCALAPPDATA%/MERYO-deployment/catalog-{rehearsal,applied}.json`. Los datos y credenciales no se versionan.

Recuperación: con acceso SQL autorizado, cambiar `active=false` exclusivamente para el ID que el propietario vuelva a autorizar como real; no requiere borrar ni reconstruir la barbería. No publicar estos perfiles automáticamente por cambiarles el nombre. Para revertir el código completo se conserva el historial Git. Los clientes nuevos requieren la migración 011; no existe fallback a los contadores antiguos.

Se conservan los ajustes pendientes de la publicación anterior: registro público con Google, aviso honesto de correo sin SMTP y etiqueta de entorno para Authenticator. No se habilitan cobros.
