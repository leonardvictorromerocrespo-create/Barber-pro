export function pushPermissionHelp(userAgent=''){
 const ua=String(userAgent);
 if(/EdgA|EdgiOS|Edg\//i.test(ua))return {browser:'Microsoft Edge',steps:'En Edge, abre el icono de controles junto a la dirección → Permisos para este sitio → Notificaciones → Permitir.'};
 if(/SamsungBrowser/i.test(ua))return {browser:'Samsung Internet',steps:'En Samsung Internet, abre el menú del sitio → Permisos → Notificaciones → Permitir.'};
 if(/FxiOS|Firefox/i.test(ua))return {browser:'Firefox',steps:'En Firefox, abre el candado junto a la dirección → Permisos → Notificaciones → Permitir.'};
 if(/CriOS|Chrome/i.test(ua))return {browser:'Chrome',steps:'En Chrome, abre la información del sitio junto a la dirección → Configuración del sitio → Notificaciones → Permitir.'};
 if(/Safari/i.test(ua))return {browser:'Safari',steps:'En Safari, abre los ajustes del sitio web → Notificaciones → Permitir.'};
 return {browser:'este navegador',steps:'Abre los permisos del sitio desde el icono junto a la dirección y permite las notificaciones.'};
}
