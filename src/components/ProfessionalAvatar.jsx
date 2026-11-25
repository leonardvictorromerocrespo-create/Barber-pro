import {useState} from 'react';
import {isTeamPhotoAsset} from '../lib/shop-content';

export function professionalPhoto(shop,member) {
  return shop.assets?.filter(asset=>asset.kind==='foto'&&asset.url&&!asset.error&&isTeamPhotoAsset(asset,shop.id,member.id)).at(-1)?.url||member.foto_url||'';
}

export default function ProfessionalAvatar({shop,member,className}) {
  const photo=professionalPhoto(shop,member);
  const [failed,setFailed]=useState('');
  const initials=String(member.nombre||'?').trim().split(/\s+/).slice(0,2).map(part=>Array.from(part)[0]||'').join('').toLocaleUpperCase('es');
  return <span className={className}>{photo&&failed!==photo?<img src={photo} alt={`Foto de ${member.nombre}`} loading="lazy" onError={()=>setFailed(photo)}/>:initials}</span>;
}
