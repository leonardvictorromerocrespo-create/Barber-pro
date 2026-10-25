import { randomUUID } from 'node:crypto';
import { asLocal,localIds,localShop,localService } from './local-db.mjs';

const send=(res,status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
export function localApi(pool){
  return async(req,res,next)=>{
    if(!req.url.startsWith('/__local/')) return next();
    if(req.headers.host!=='127.0.0.1:5178' || (req.headers.origin && req.headers.origin!=='http://127.0.0.1:5178')) return send(res,403,{error:'Origen local requerido'});
    const url=new URL(req.url,'http://127.0.0.1:5178');
    const actor=req.headers['x-meryo-test-actor']??'client';
    if(!Object.hasOwn(localIds,actor)) return send(res,403,{error:'Actor local invalido'});
    try{
      if(req.method==='GET' && url.pathname==='/__local/catalog'){
        const r=await asLocal(pool,'public',`select id,nombre,distrito,descripcion,rating,total_resenas,precio_desde,verificada,lat,lng from public.barberias where id in (900001,900002) order by id`);
        return send(res,200,r.rows);
      }
      if(req.method==='GET' && url.pathname==='/__local/agenda'){
        const r=await asLocal(pool,'public','select * from public.horarios_disponibles($1,$2,$3)',[localShop,localService,url.searchParams.get('day')]);
        return send(res,200,r.rows);
      }
      if(req.method==='GET' && url.pathname==='/__local/reservations'){
        const r=await asLocal(pool,actor,'select id,barberia_id,cliente_id,inicio,estado,precio_total,monto_adelanto,expira_respuesta_en,expira_pago_en from public.reservas where barberia_id=$1 order by created_at desc',[localShop]);
        return send(res,200,r.rows);
      }
      if(req.method!=='POST' || req.headers['x-meryo-local-only']!=='1') return send(res,403,{error:'Escritura local protegida'});
      let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096)return send(res,413,{error:'Solicitud demasiado grande'});}
      const body=JSON.parse(raw||'{}');
      if(url.pathname==='/__local/request'){
        const r=await asLocal(pool,actor,"select public.crear_reserva($1,$2,$3,'Cliente LOCAL','999999999',null,0) as id",[localShop,localService,body.start]);
        return send(res,200,r.rows[0]);
      }
      if(url.pathname==='/__local/respond'){
        const r=await asLocal(pool,actor,'select public.responder_reserva($1,$2) as estado',[body.id,body.accept]);return send(res,200,r.rows[0]);
      }
      if(url.pathname==='/__local/cancel'){
        const fn=actor==='barber'?'cancelar_reserva_barbero':'cancelar_reserva_cliente';
        const r=await asLocal(pool,actor,`select public.${fn}($1) as estado`,[body.id]);return send(res,200,r.rows[0]);
      }
      if(url.pathname==='/__local/test-receipt'){
        // Exclusive local fixture operation; never a real provider/webhook/charge.
        // No customer ID from input is trusted. Server verifies ownership in SQL.
        const reference=`localhost-${randomUUID()}`;
        const r=await asLocal(pool,'server',"select public.registrar_intento_pago_verificado($1,$2,'localhost-fixture',$3,'local-only',false,'tarjeta') as id",[body.id,localIds[actor],reference]);
        const receipt=await asLocal(pool,'server',"select public.confirmar_pago_verificado($1,'localhost-fixture',$2,'local-only',1500,'PEN',false) as estado",[r.rows[0].id,reference]);
        return send(res,200,{...receipt.rows[0],simulated:true,charged:false});
      }
      return send(res,404,{error:'Ruta local no disponible'});
    }catch(e){return send(res,400,{error:e.code==='42501'?'Permiso denegado en PostgreSQL':e.message});}
  };
}
