// Navigation intent only. Authority continues to come from the verified profile and SQL.
const KEY='meryo-access-destination';
export function rememberAccess(storage,destination){
 storage.setItem(KEY,['admin','barber','shop-register','team-invite','notifications','my-bookings'].includes(destination)?destination:'client');
}
export function consumeAccess(storage){
 const value=storage.getItem(KEY);storage.removeItem(KEY);
 return ['admin','barber','shop-register','team-invite','notifications','my-bookings'].includes(value)?value:'client';
}
export function accessView(destination,role){
 return ['notifications','my-bookings'].includes(destination)?destination:destination==='team-invite'?'team-invite':destination==='admin'?'admin':['barber','shop-register'].includes(destination)?(role==='admin'?'admin':role==='barbero'?'shop-manage':'shop-register'):'client';
}
