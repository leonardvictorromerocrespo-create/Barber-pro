export const CONTENT_BUCKET='meryo-shop-content';
export const PROFILE_PHOTO_TITLE='[meryo-profile-photo]';
export const TEAM_PHOTO_TITLE_PREFIX='[meryo-team-photo:';
export function teamPhotoTitle(memberId){return `${TEAM_PHOTO_TITLE_PREFIX}${String(memberId)}]`;}
export function teamPhotoMemberId(title){
 const match=String(title??'').match(/^\[meryo-team-photo:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]$/i);
 return match?.[1]?.toLowerCase()??null;
}
export function isTeamPhotoTitle(title){return teamPhotoMemberId(title)!==null;}
export function isTeamPhotoAsset(asset,shopId,memberId){
 const member=teamPhotoMemberId(teamPhotoTitle(memberId)),shop=String(shopId??'');
 if(!asset||!member||!/^\d+$/.test(shop)||asset.title!==teamPhotoTitle(member))return false;
 return new RegExp(`^${shop}/team/${member}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|jpeg|png|webp)$`,'i').test(String(asset.object_path??''));
}
export function contentKindForForm(kind){return kind==='perfil'?'foto':kind;}
const formats={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/webm':'webm'};
const productFormats={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
export function validateContent(file,kind){
 const image=['portada','foto'].includes(kind),limit=image?5*1024*1024:20*1024*1024;
 if(!['portada','foto','video'].includes(kind)||!formats[file.type]||image!==file.type.startsWith('image/'))throw Error('Usa JPG, PNG o WebP para imágenes; MP4 o WebM para video.');
 if(!file.size||file.size>limit)throw Error(`El archivo debe ocupar como máximo ${image?5:20} MB.`);
 return formats[file.type];
}
export async function signContent(client,assets){
 if(!assets.length)return [];
 const {data,error}=await client.storage.from(CONTENT_BUCKET).createSignedUrls(assets.map(a=>a.object_path),300);
 if(error)throw Error('No se pudo cargar el contenido de Storage: '+error.message);
 return assets.map((a,i)=>({...a,url:data[i]?.signedUrl??null,error:data[i]?.error??null}));
}
export async function uploadContent(client,shop,file,kind,title=''){
 const ext=validateContent(file,kind),path=`${shop}/${crypto.randomUUID()}.${ext}`;
 const {error}=await client.storage.from(CONTENT_BUCKET).upload(path,file,{contentType:file.type,upsert:false});
 if(error)throw Error('Storage no guardó el archivo: '+error.message);
 const saved=await client.rpc('meryo_publicar_archivo',{p_path:path,p_kind:kind,p_title:title.trim()});
 if(saved.error)throw Error('El archivo se subió, pero no se publicó: '+saved.error.message+'. No repitas la subida sin revisar el espacio.');
 if(!saved.data)throw Error('El servidor no confirmó el contenido');
 return saved.data;
}
export async function uploadTeamPhoto(client,shop,memberId,file){
 const ext=validateContent(file,'foto');
 const normalizedMember=String(memberId??'').toLowerCase();
 if(!/^\d+$/.test(String(shop))||!teamPhotoMemberId(teamPhotoTitle(normalizedMember)))throw Error('Negocio o profesional inválido');
 const path=`${shop}/team/${normalizedMember}/${crypto.randomUUID()}.${ext}`;
 const {error}=await client.storage.from(CONTENT_BUCKET).upload(path,file,{contentType:file.type,upsert:false});
 if(error)throw Error('Storage no guardó la foto: '+error.message);
 const saved=await client.rpc('meryo_guardar_foto_integrante',{p_member:normalizedMember,p_path:path});
 if(saved.error)throw Error('La foto se subió, pero el servidor no la registró. Revisa la conexión antes de volver a subirla. '+saved.error.message);
 if(!saved.data)throw Error('El servidor no confirmó la foto del profesional');
 return saved.data;
}
export async function uploadProductPhoto(client,shop,file){
 if(!productFormats[file?.type]||!file.size||file.size>5*1024*1024)throw Error('La foto del producto debe ser JPG, PNG o WebP y ocupar como máximo 5 MB.');
 if(!/^\d+$/.test(String(shop)))throw Error('Barbería inválida');
 const path=`${shop}/${crypto.randomUUID()}.${productFormats[file.type]}`;
 const {error}=await client.storage.from(CONTENT_BUCKET).upload(path,file,{contentType:file.type,upsert:false});
 if(error)throw Error('Storage no guardó la fotografía: '+error.message);
 return path;
}
