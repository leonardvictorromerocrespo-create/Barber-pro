# Corrección de navegación de acceso

Acceso público existente: `https://barber-pro-phi-taupe.vercel.app/#client-login`.
Administración existente: `https://barber-pro-phi-taupe.vercel.app/#admin`.

El enlace de administración sin sesión enviaba al formulario de barbero sin Google. Ahora ofrece el mismo `handleGoogle`/Supabase Auth ya configurado y correo como alternativa. La intención de volver a Administración se conserva en sessionStorage únicamente como nombre de pantalla permitido, nunca como rol ni URL externa. El retorno OAuth y el acceso por correo reutilizan los controles actuales de perfil activo, rol real y MFA. El panel de barbero también permite Google; una cuenta administradora que llega por ese enlace se dirige a Administración.

No se cambió Supabase, el proveedor Google, las sesiones, los factores ni las políticas SQL. Las cuatro pruebas específicas de navegación/render pasaron; build correcto. La prueba de render parte sin sesión y distingue el estado de comprobación, sin inventar cuentas administrativas. Se conservan las verificaciones previas de autenticación y MFA.
