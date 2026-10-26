import { asLocal } from './local-db.mjs';
const send=(res,status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
export function localApi(pool){
  return async(req,res,next)=>{
    if(!req.url.startsWith('/__local/'))return next();
    if(req.headers.host!=='127.0.0.1:5178'||(req.headers.origin&&req.headers.origin!=='http://127.0.0.1:5178'))return send(res,403,{error:'Origen local requerido'});
    if(req.method!=='GET')return send(res,403,{error:'Falta Supabase Auth de pruebas. No hay acceso por actores sintéticos ni pagos simulados.'});
    const url=new URL(req.url,'http://127.0.0.1:5178');
    try{
      if(url.pathname==='/__local/catalog'){
        const r=await asLocal(pool,'public',`select b.*,coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'nombre',s.nombre,'descripcion',s.descripcion,'precio',s.precio,'duracion_min',s.duracion_min,'activo',s.activo)) from public.servicios s where s.barberia_id=b.id and s.activo),'[]'::jsonb) servicios from public.barberias b where b.id in (900001,900002) and b.verificada order by b.id`);
        return send(res,200,r.rows);
      }
      if(['/__local/public/servicios','/__local/public/horarios'].includes(url.pathname)){
        const table=url.pathname.endsWith('/servicios')?'servicios':'horarios';
        const r=await asLocal(pool,'public',`select * from public.${table} where barberia_id in (900001,900002)`);return send(res,200,r.rows);
      }
      if(url.pathname==='/__local/agenda'){
        const shop=Number(url.searchParams.get('shop')),service=Number(url.searchParams.get('service'));
        if(![900001,900002].includes(shop)||!Number.isSafeInteger(service))return send(res,400,{error:'Barbería o servicio local inválidos'});
        const r=await asLocal(pool,'public','select * from public.horarios_disponibles($1,$2,$3)',[shop,service,url.searchParams.get('day')]);return send(res,200,r.rows);
      }
      return send(res,403,{error:'Datos privados bloqueados: se necesita Supabase Auth real de pruebas'});
    }catch{return send(res,400,{error:'No se pudo consultar el PostgreSQL local'});}
  };
}
