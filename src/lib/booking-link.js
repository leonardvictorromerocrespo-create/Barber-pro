// A navigation hint, never authority to read or change a booking (SQL/RLS decides).
export function bookingIdFromSearch(search='') {
 const id=new URLSearchParams(search).get('cita');
 return /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id||'')?id:null;
}
export function pickupOrderIdFromSearch(search='') {
 const id=new URLSearchParams(search).get('pedido');
 return /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id||'')?id:null;
}
export function bookingDestination(search,fallback='client') {
 const params=new URLSearchParams(search);
 if(bookingIdFromSearch(search))return 'my-bookings';
 if(pickupOrderIdFromSearch(search))return params.get('pedido_origen')==='negocio'?fallback:'my-orders';
 return fallback;
}
export function bookingDeadline(row) {
 return row.estado==='solicitada'?row.expira_respuesta_en:row.estado==='aceptada'?row.expira_pago_en:null;
}
