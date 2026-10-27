// A navigation hint, never authority to read or change a booking (SQL/RLS decides).
export function bookingIdFromSearch(search='') {
 const id=new URLSearchParams(search).get('cita');
 return /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id||'')?id:null;
}
export function bookingDestination(search,fallback='client') {
 return bookingIdFromSearch(search)?'my-bookings':fallback;
}
export function bookingDeadline(row) {
 return row.estado==='solicitada'?row.expira_respuesta_en:row.estado==='aceptada'?row.expira_pago_en:null;
}
