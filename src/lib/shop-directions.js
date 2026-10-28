import {coordinates} from './catalog.js';
export function shopDirections(shop){
 const point=coordinates(shop);if(!point)return null;
 const url=new URL('https://www.google.com/maps/dir/');url.searchParams.set('api','1');url.searchParams.set('destination',`${point.lat},${point.lng}`);return url.href;
}
