import { savedOperation } from './operations.js';

export async function readResult(operation) {
  const {data,error}=await operation;
  if(error)throw new Error(error.message||'No se pudo consultar el servidor');
  if(data===null || data===undefined)throw new Error('El servidor no devolvió datos');
  return data;
}
export async function verifiedProfile(client) {
  const {data,error}=await client.auth.getUser();
  if(error?.name==='AuthSessionMissingError')return null;
  if(error)throw error;
  if(!data?.user)return null;
  const profile=await readResult(client.from('profiles').select('*').eq('id',data.user.id).single());
  if(profile.id!==data.user.id || profile.activo!==true || !['cliente','barbero','admin'].includes(profile.rol))throw new Error('Perfil inactivo o no autorizado');
  if(profile.rol==='barbero'&&!profile.barberia_id)throw new Error('Falta asignar la barbería');
  return profile;
}
export function mapShop(item) {
  const count=Number(item.total_resenas),score=Number(item.rating);
  const verifiedReviews=item.reviews_verified===true&&Number.isInteger(count)&&count>0&&Number.isFinite(score)&&score>=1&&score<=5;
  return {...item,id:item.id,name:item.nombre,district:item.distrito,about:item.descripcion||'',
    lat:item.lat??null,lng:item.lng??null,distance:'Ubicación por consultar',rating:verifiedReviews?score:null,reviews:verifiedReviews?count:0,
    basePrice:item.precio_desde==null?null:Number(item.precio_desde),originalBasePrice:item.precio_desde==null?null:Number(item.precio_desde),
    discount:'',tags:[],image:item.imagen_url||'',introVideoTitle:'Presentación',introVideoNote:item.video_presentacion_url?'Video de presentación disponible':'Sin video publicado',cutsVideoTitle:'Portafolio',cutsVideoNote:'Consulta el trabajo publicado por la barbería.',
    services:(item.servicios??[]).filter(s=>s.activo).map(s=>({...s,name:s.nombre,price:Number(s.precio),duration:`${s.duracion_min} min`})),calendar:{}};
}
export function createMeryoApi(client) {
  async function requireRole(roles){const p=await verifiedProfile(client);if(!p||!roles.includes(p.rol))throw new Error(client.authUnavailable?'Falta conectar Supabase Auth de pruebas. No se creará una sesión ficticia.':'Inicia sesión con el rol correspondiente');return p;}
  return {
    profile:()=>verifiedProfile(client),
    catalog:async()=> (await readResult(client.rpc('meryo_catalogo_publico'))).map(mapShop),
    slots:async(shop,service,date)=>(await readResult(client.rpc('horarios_disponibles',{p_barberia_id:shop,p_servicio_id:service,p_fecha:date}))).map(s=>({id:s.hora_inicio,time:s.hora_inicio,label:new Date(s.hora_inicio).toLocaleTimeString('es-PE',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit',hour12:false}),occupied:false})),
    request:async({shop,service,start,name,phone,note})=>{
      await requireRole(['cliente']);
      const config=await readResult(client.rpc('meryo_reservas_config'));
      if(config.respuesta_segundos!==900||config.modelo_comercial!=='mensualidad')throw new Error('El servidor todavía no tiene el flujo de solicitudes de MERYO actualizado.');
      return savedOperation(()=>client.rpc('crear_reserva',{p_barberia_id:shop,p_servicio_id:service,p_inicio:start,p_nombre:name.trim(),p_telefono:phone.trim(),p_pedido:note||null,p_extra:0}));
    },
    bookings:async()=>{
      const p=await requireRole(['cliente','barbero']);
      return readResult(client.from('reservas').select('*,barberias(nombre),pagos(proveedor,estado)').eq(p.rol==='barbero'?'barberia_id':'cliente_id',p.rol==='barbero'?p.barberia_id:p.id).order('inicio',{ascending:false}));
    },
    bookingState:async()=>{await requireRole(['cliente','barbero']);return readResult(client.rpc('meryo_reservas_estado'));},
    bookingConfig:()=>readResult(client.rpc('meryo_reservas_config')),
    registerPush:async(subscription)=>{await requireRole(['cliente','barbero']);return savedOperation(()=>client.rpc('meryo_registrar_push',{p_subscription:subscription}));},
    removePush:async(endpoint)=>{const {error}=await client.rpc('meryo_quitar_push',{p_endpoint:endpoint});if(error)throw error;},
    respond:async(id,accept)=>{await requireRole(['barbero']);const result=await savedOperation(()=>client.rpc('responder_reserva',{p_reserva_id:id,p_aceptar:accept}));if(!['aceptada','rechazada','expirada'].includes(result))throw new Error('Respuesta de reserva inesperada');return result;},
    registerShop:async(form)=>{
      await requireRole(['cliente']);
      return savedOperation(()=>client.rpc('registrar_barberia',{p_nombre:form.nombre.trim(),p_distrito:form.distrito.trim(),p_direccion:form.direccion.trim(),p_descripcion:form.descripcion||'',p_lat:form.lat===''||form.lat==null?null:Number(form.lat),p_lng:form.lng===''||form.lng==null?null:Number(form.lng),p_whatsapp:form.whatsapp||null,p_correo:form.correo||null}));
    },
    ownerShop:async()=>{const p=await requireRole(['barbero']);return readResult(client.from('barberias').select('*').eq('id',p.barberia_id).single());},
    activate:async(id)=>{await requireRole(['admin']);const {error}=await client.rpc('activar_barberia',{p_id:id});if(error)throw error;const row=await readResult(client.from('barberias').select('id,estado,verificada').eq('id',id).single());if(!row.verificada||row.estado!=='activa')throw new Error('No se confirmó la activación');return row;},
  };
}

export function bookingLabel(row) {
  if(row.estado==='confirmada' && row.pagos?.some(p=>/prueba|fixture|simulad|sandbox|mock/i.test(p.proveedor)))return 'Registro de pruebas · no acredita un cobro';
  return ({solicitada:'Esperando respuesta',aceptada:'Aceptada · pendiente de pago',confirmada:'Confirmada',rechazada:'Rechazada',expirada:'Vencida',cancelada_cliente:'Cancelada por cliente',cancelada_barbero:'Cancelada por barbero',completada:'Completada',no_asistio:'No asistió'})[row.estado]??row.estado;
}
