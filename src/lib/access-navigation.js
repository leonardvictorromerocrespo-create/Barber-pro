// Navigation intent only. Authority continues to come from the verified profile and SQL.
const KEY='meryo-access-destination';
export function rememberAccess(storage,destination){
 storage.setItem(KEY,['admin','barber'].includes(destination)?destination:'client');
}
export function consumeAccess(storage){
 const value=storage.getItem(KEY);storage.removeItem(KEY);
 return ['admin','barber'].includes(value)?value:'client';
}
export function accessView(destination,role){
 return destination==='admin'?'admin':destination==='barber'?(role==='admin'?'admin':'barber'):'client';
}
