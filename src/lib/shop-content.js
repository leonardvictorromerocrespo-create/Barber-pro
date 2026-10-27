export const CONTENT_BUCKET='meryo-shop-content';
const formats={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/webm':'webm'};
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
