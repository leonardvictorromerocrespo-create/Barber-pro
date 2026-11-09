import {normalizeBookingOrigin} from './booking-origin.js';
import { savedOperation } from './operations.js';
import {PROFILE_PHOTO_TITLE,signContent,uploadContent,uploadProductPhoto} from './shop-content.js';

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
  const services=(item.servicios??[]).filter(s=>s.activo).map(s=>{
    const price=s.precio==null?null:Number(s.precio),minutes=s.duracion_min==null?null:Number(s.duracion_min);
    const requiresEvaluation=s.requiere_evaluacion===true;
    const salonOffer=s.promocion_belleza&&typeof s.promocion_belleza==='object'?s.promocion_belleza:null;
    const beautyPromotion=salonOffer?.id&&Number.isFinite(Number(salonOffer.precio))&&Number(salonOffer.precio)>0&&price!==null&&Number(salonOffer.precio)<price?{
      id:salonOffer.id,promoPrice:Number(salonOffer.precio),regularPrice:price,startsOn:salonOffer.desde,endsOn:salonOffer.hasta,
    }:null;
    return {...s,name:s.nombre,price,duration:Number.isInteger(minutes)&&minutes>0?`${minutes} min`:null,
      durationMinutes:minutes,requiresEvaluation,category:s.categoria||'general',
      beautyPromotion,bookable:!requiresEvaluation&&price!==null&&price>0&&Number.isInteger(minutes)&&minutes>0};
  });
  return {...item,id:item.id,name:item.nombre,district:item.distrito,about:item.descripcion||'',
    businessTypes:Array.isArray(item.tipos_negocio)&&item.tipos_negocio.length?item.tipos_negocio:['barberia'],
    lat:item.lat??null,lng:item.lng??null,distance:'Ubicación por consultar',rating:verifiedReviews?score:null,reviews:verifiedReviews?count:0,
    basePrice:item.precio_desde==null?null:Number(item.precio_desde),originalBasePrice:item.precio_desde==null?null:Number(item.precio_desde),
    discount:'',tags:[],image:item.imagen_url||'',introVideoTitle:'Presentación',introVideoNote:item.video_presentacion_url?'Video de presentación disponible':'Sin video publicado',cutsVideoTitle:'Portafolio',cutsVideoNote:'Consulta el trabajo publicado por la barbería.',
    services,calendar:{}};
}
export function createMeryoApi(client) {
  async function requireRole(roles){const p=await verifiedProfile(client);if(!p||!roles.includes(p.rol))throw new Error(client.authUnavailable?'Falta conectar Supabase Auth de pruebas. No se creará una sesión ficticia.':'Inicia sesión con el rol correspondiente');return p;}
  async function markAttendance(id,attended){await requireRole(['barbero']);const {error}=await client.rpc('marcar_asistencia',{p_reserva_id:id,p_asistio:attended});if(error)throw new Error(error.message||(attended?'No se pudo finalizar la cita':'No se pudo registrar la inasistencia'));return true;}
  return {
    profile:()=>verifiedProfile(client),
    catalog:async(category='barberia',{signal}={})=>{
      const request=client.rpc('meryo_catalogo_categoria',{p_categoria:category});
      if(signal)request.abortSignal(signal);
      return Promise.all((await readResult(request)).map(async row=>{
        const shop=mapShop(row);
        try{shop.assets=await signContent(client,row.assets??[]);const cover=shop.assets.find(a=>a.kind==='portada'&&a.url);const profile=shop.assets.filter(a=>a.kind==='foto'&&a.title===PROFILE_PHOTO_TITLE&&a.url).at(-1);shop.coverImage=cover?.url||shop.image;shop.profileImage=profile?.url||null;shop.assets=shop.assets.filter(a=>a.title!==PROFILE_PHOTO_TITLE);if(cover)shop.image=cover.url;}
        catch(error){shop.assets=[];shop.contentError=error.message;}
        return shop;
      }));
    },
    inspirations:async(category='barberia',{workCategory=null,limit=24,offset=0}={})=>{
      const rows=await readResult(client.rpc('meryo_inspiracion',{p_catalog_category:category,p_work_category:workCategory,p_limit:limit,p_offset:offset}));
      const signed=await signContent(client,rows.map(row=>({...row,object_path:row.object_path})));
      const urls=new Map(signed.map(row=>[row.id,row.url]));
      return rows.map(row=>({...row,url:urls.get(row.id)||null}));
    },
    inspirationById:async(id)=>{
      const {data:row,error}=await client.rpc('meryo_inspiracion_publicacion',{p_id:id});
      if(error)throw new Error(error.message||'No se pudo consultar la publicación');
      if(!row)return null;
      const [signed]=await signContent(client,[{...row,object_path:row.object_path}]);
      return {...row,url:signed?.url||null};
    },
    ownerInspirations:async()=>{await requireRole(['barbero']);return readResult(client.rpc('meryo_inspiracion_propietario'));},
    saveInspiration:async({id=null,assetId,catalogCategory,workCategory,title,description,memberId=null,serviceId=null,published})=>{
      await requireRole(['barbero']);
      return savedOperation(()=>client.rpc('meryo_guardar_inspiracion',{p_id:id,p_asset_id:assetId,p_catalog_category:catalogCategory,p_work_category:workCategory,p_title:title,p_description:description,p_member_id:memberId||null,p_service_id:serviceId?Number(serviceId):null,p_published:published}));
    },
    slots:async(shop,service,date,barber)=>(await readResult(barber?client.rpc('meryo_horarios_barbero',{p_shop:shop,p_service:service,p_date:date,p_member:barber}):client.rpc('horarios_disponibles',{p_barberia_id:shop,p_servicio_id:service,p_fecha:date}))).map(s=>({id:s.hora_inicio,time:s.hora_inicio,label:new Date(s.hora_inicio).toLocaleTimeString('es-PE',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit',hour12:false}),occupied:false})),
    cutPromotions:async()=>readResult(client.rpc('meryo_cortes_50_disponibles')),
    cutPromotionSlots:async(shop,service,date,barber,campaign)=>readResult(client.rpc('meryo_cortes_50_horarios',{p_shop:shop,p_service:service,p_date:date,p_member:barber,p_campaign:campaign})).then(rows=>rows.map(s=>({id:s.hora_inicio,time:s.hora_inicio,label:new Date(s.hora_inicio).toLocaleTimeString('es-PE',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit',hour12:false}),occupied:false}))),
    beautyPromotionsToday:async()=>readResult(client.rpc('meryo_belleza_promociones_hoy')),
    beautyPromotionSlots:async(shop,service,date,barber,promotion)=>readResult(client.rpc('meryo_belleza_promocion_horarios',{p_promotion:promotion,p_shop:shop,p_service:service,p_date:date,p_member:barber})).then(rows=>rows.map(s=>({id:s.hora_inicio,time:s.hora_inicio,label:new Date(s.hora_inicio).toLocaleTimeString('es-PE',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit',hour12:false}),occupied:false}))),
    ownerCutCampaign:async()=>{await requireRole(['barbero']);return readResult(client.rpc('meryo_campania_cortes_propietario'));},
    saveCutCampaign:async({startsOn,endsOn,windows,active})=>{await requireRole(['barbero']);return savedOperation(()=>client.rpc('meryo_guardar_campania_cortes',{p_inicio:startsOn,p_fin:endsOn,p_horarios:windows,p_activa:active}));},
    ownerBeautyPromotions:async()=>{await requireRole(['barbero']);return readResult(client.rpc('meryo_promociones_belleza_propietario'));},
    saveBeautyPromotion:async({serviceId,promoPrice,startsOn,endsOn,active})=>{await requireRole(['barbero']);return savedOperation(()=>client.rpc('meryo_guardar_promocion_belleza',{p_service_id:Number(serviceId),p_promo_price:Number(promoPrice),p_starts_on:startsOn,p_ends_on:endsOn,p_active:active}));},
    request:async({shop,service,barber,start,name,phone,note,campaignId=null,regularPrice=null,salonPromotionId=null,salonRegularPrice=null,salonPromoPrice=null,finderExpectedPrice=null,inspirationPublicationId=null,inspirationExpectedPrice=null,origin=null})=>{
      await requireRole(['cliente']);
      const config=await readResult(client.rpc('meryo_reservas_config'));
      if(config.respuesta_segundos!==900||config.modelo_comercial!=='mensualidad')throw new Error('El servidor todavía no tiene el flujo de solicitudes de MERYO actualizado.');
      if((campaignId||salonPromotionId)&&!barber)throw new Error('La promoción requiere elegir un profesional con agenda habilitada.');
      const args={p_barberia_id:shop,p_servicio_id:service,p_inicio:start,p_nombre:name.trim(),p_telefono:phone.trim(),p_pedido:note||null,p_extra:0,...(barber?{p_barbero_id:barber}:{})};
      const source=barber?normalizeBookingOrigin(origin):null;
      const save=rpc=>savedOperation(()=>source?client.rpc('meryo_solicitar_cita_con_origen',{...args,p_origen:source}):client.rpc(rpc,args));
      if(inspirationPublicationId){
        if(campaignId||salonPromotionId)throw new Error('Las promociones se reservan desde su propio recorrido.');
        if(!Number.isFinite(Number(inspirationExpectedPrice))||Number(inspirationExpectedPrice)<=0)throw new Error('El precio de referencia falta; revisa el servicio antes de continuar.');
        Object.assign(args,{p_campaign_id:null,p_precio_habitual:null,p_beauty_campaign_id:null,p_beauty_regular_price:null,p_beauty_expected_price:null,p_precio_esperado:Number(inspirationExpectedPrice),p_inspiration_publication_id:inspirationPublicationId});
        return save('meryo_solicitar_cita');
      }
      if(finderExpectedPrice!==null&&finderExpectedPrice!==undefined){
        if(campaignId||salonPromotionId)throw new Error('La búsqueda de turnos no combina precios promocionales.');
        Object.assign(args,{p_campaign_id:null,p_precio_habitual:null,p_beauty_campaign_id:null,p_beauty_regular_price:null,p_beauty_expected_price:null,p_precio_esperado:finderExpectedPrice});
      }else if(campaignId){args.p_campaign_id=campaignId;args.p_precio_habitual=regularPrice;}
      if(finderExpectedPrice===null&& (salonPromotionId||salonRegularPrice!==null&&salonRegularPrice!==undefined)){
        Object.assign(args,{p_campaign_id:null,p_precio_habitual:null,p_beauty_campaign_id:salonPromotionId||null,p_beauty_regular_price:salonRegularPrice??null,p_beauty_expected_price:salonPromotionId?salonPromoPrice??null:null});
      }
      return save(barber?'meryo_solicitar_cita':'crear_reserva');
    },
    bookings:async()=>{
      const p=await requireRole(['cliente','barbero']);
      return readResult(client.from('reservas').select('*,barberias(nombre),pagos(proveedor,estado)').eq(p.rol==='barbero'?'barberia_id':'cliente_id',p.rol==='barbero'?p.barberia_id:p.id).order('inicio',{ascending:false}));
    },
    bookingState:async()=>{await requireRole(['cliente','barbero']);return readResult(client.rpc('meryo_reservas_estado'));},
    bookingConfig:()=>readResult(client.rpc('meryo_reservas_config')),
    pushState:()=>readResult(client.rpc('meryo_push_estado')),
    pushDevice:endpoint=>readResult(client.rpc('meryo_push_dispositivo',{p_endpoint:endpoint})),
    pushAdminState:()=>readResult(client.rpc('meryo_push_admin_estado')),
    testPush:()=>readResult(client.rpc('meryo_probar_push')),
    notifications:async(userId)=>{if(!userId)return [];return readResult(client.from('notificaciones').select('id,titulo,mensaje,tipo,reserva_id,pedido_id,created_at,leida').eq('user_id',userId).order('created_at',{ascending:false}).limit(50));},
    registerPush:async(subscription)=>{await requireRole(['cliente','barbero','admin']);return savedOperation(()=>client.rpc('meryo_registrar_push',{p_subscription:subscription}));},
    removePush:async(endpoint)=>{const {error}=await client.rpc('meryo_quitar_push',{p_endpoint:endpoint});if(error)throw error;},
    respond:async(id,accept)=>{await requireRole(['barbero']);const result=await savedOperation(()=>client.rpc('responder_reserva',{p_reserva_id:id,p_aceptar:accept}));if(!['aceptada','rechazada','expirada'].includes(result))throw new Error('Respuesta de reserva inesperada');return result;},
    markNoShow:async(id)=>markAttendance(id,false),
    finishBooking:async(id)=>markAttendance(id,true),
    markArrival:async(id)=>{await requireRole(['barbero']);const {data,error}=await client.rpc('marcar_llegada',{p_reserva_id:id});if(error)throw new Error(error.message||'No se pudo registrar la llegada');return data??true;},
    registerShop:async(form)=>{
      await requireRole(['cliente']);
      const type=['barberia','belleza','ambos'].includes(form.tipo_negocio)?form.tipo_negocio:'barberia';
      return savedOperation(()=>client.rpc('registrar_negocio',{p_nombre:form.nombre.trim(),p_distrito:form.distrito.trim(),p_direccion:form.direccion.trim(),p_descripcion:form.descripcion||'',p_lat:form.lat===''||form.lat==null?null:Number(form.lat),p_lng:form.lng===''||form.lng==null?null:Number(form.lng),p_whatsapp:form.whatsapp||null,p_correo:form.correo||null,p_tipo_negocio:type}));
    },
    ownerShop:async()=>{const p=await requireRole(['barbero']);return readResult(client.from('barberias').select('*').eq('id',p.barberia_id).single());},
    ownerServices:async()=>{const p=await requireRole(['barbero']);return readResult(client.from('servicios').select('*').eq('barberia_id',p.barberia_id).order('nombre'));},
    team:async()=>{await requireRole(['barbero']);return readResult(client.rpc('meryo_equipo'));},
    inviteMember:async(email,name)=>{await requireRole(['barbero']);return savedOperation(()=>client.rpc('meryo_invitar_integrante',{p_email:email,p_name:name}));},
    revokeInvite:async(id)=>{await requireRole(['barbero']);return savedOperation(()=>client.rpc('meryo_revocar_invitacion',{p_id:id}));},
    acceptInvite:async(token)=>{await requireRole(['cliente','barbero']);return savedOperation(()=>client.rpc('meryo_aceptar_invitacion',{p_token:token}));},
    saveMember:async(m,services)=>{await requireRole(['barbero']);return savedOperation(()=>client.rpc('meryo_actualizar_integrante',{p_member:m.id,p_name:m.display_name,p_active:m.active,p_services:services.map(Number)}));},
    addWorkWindow:async(member,day,kind,start,end)=>{await requireRole(['barbero']);return savedOperation(()=>client.rpc('meryo_agregar_tramo',{p_member:member,p_day:Number(day),p_kind:kind,p_start:start,p_end:end}));},
    removeWorkWindow:async(id)=>{await requireRole(['barbero']);return savedOperation(()=>client.rpc('meryo_retirar_tramo',{p_id:id}));},
    editWorkWindow:async(id,start,end)=>{await requireRole(['barbero']);return savedOperation(()=>client.rpc('meryo_editar_tramo',{p_id:id,p_start:start,p_end:end}));},
    addMemberBlock:async(member,start,end,reason)=>{await requireRole(['barbero']);return savedOperation(()=>client.rpc('meryo_agregar_bloqueo',{p_member:member,p_start:start,p_end:end,p_reason:reason}));},
    removeMemberBlock:async(id)=>{await requireRole(['barbero']);return savedOperation(()=>client.rpc('meryo_retirar_bloqueo',{p_id:id}));},
    saveShop:async(data)=>{await requireRole(['barbero']);return savedOperation(()=>client.rpc('meryo_guardar_perfil',{p_data:data}));},
    bookingResults:async(shop,month)=>{await requireRole(['barbero']);return readResult(client.rpc('meryo_resultados_reservas',{p_shop:shop,p_month:month}));},
    shopHistory:async(id)=>readResult(client.rpc('meryo_historial_barberia',{p_id:id})),
    shopAssets:async(id)=>{const rows=await readResult(client.from('meryo_shop_assets').select('*').eq('barberia_id',id).eq('active',true).order('created_at'));return signContent(client,rows);},
    contentConfig:()=>readResult(client.rpc('meryo_contenido_config')),
    uploadAsset:async(shop,file,kind,title)=>{const p=await requireRole(['barbero']);if(String(p.barberia_id)!==String(shop))throw new Error('Solo puedes subir contenido para tu propio negocio');return uploadContent(client,shop,file,kind,title);},
    shopProducts:async(shop)=>{
      const rows=await readResult(client.from('meryo_products').select('id,barberia_id,nombre,descripcion,precio,stock_disponible,foto_path,publicado,archivado_en,created_at,updated_at').eq('barberia_id',shop).eq('publicado',true).is('archivado_en',null).order('nombre'));
      return signContent(client,rows.filter(row=>row.foto_path).map(row=>({...row,object_path:row.foto_path}))).then(signed=>{
        const urls=new Map(signed.map(row=>[row.id,row.url]));return rows.map(row=>({...row,foto_url:urls.get(row.id)||null}));
      });
    },
    ownerProducts:async()=>{const p=await requireRole(['barbero']);const rows=await readResult(client.from('meryo_products').select('id,barberia_id,nombre,descripcion,precio,stock_disponible,foto_path,publicado,archivado_en,created_at,updated_at').eq('barberia_id',p.barberia_id).order('created_at',{ascending:false}));const signed=await signContent(client,rows.filter(row=>row.foto_path).map(row=>({...row,object_path:row.foto_path})));const urls=new Map(signed.map(row=>[row.id,row.url]));return rows.map(row=>({...row,foto_url:urls.get(row.id)||null}));},
    uploadProductPhoto:async(shop,file)=>{const p=await requireRole(['barbero']);if(String(p.barberia_id)!==String(shop))throw new Error('Solo puedes subir fotos para tu barbería');return uploadProductPhoto(client,shop,file);},
    saveProduct:async(id,data)=>{await requireRole(['barbero']);return savedOperation(()=>client.rpc('meryo_save_product',{p_id:id??null,p_data:data}));},
    archiveProduct:async(id)=>{await requireRole(['barbero']);return savedOperation(()=>client.rpc('meryo_archive_product',{p_id:id}));},
    requestPickup:async({shop,items,requestKey})=>{await requireRole(['cliente']);return savedOperation(()=>client.rpc('meryo_request_pickup',{p_shop:shop,p_items:items.map(item=>({product_id:String(item.productId),quantity:item.quantity})),p_request_key:requestKey}));},
    pickupOrders:async(id=null)=>{await requireRole(['cliente','barbero']);const rows=await readResult(client.rpc('meryo_pickup_orders',{p_id:id}));return Promise.all(rows.map(async row=>{const images=await signContent(client,(row.items??[]).filter(item=>item.foto_path).map(item=>({...item,object_path:item.foto_path})));const urls=new Map(images.map(item=>[item.object_path,item.url]));return {...row,items:(row.items??[]).map(item=>({...item,foto_url:urls.get(item.foto_path)||null}))};}));},
    acceptPickup:async(id,deadline)=>{await requireRole(['barbero']);return savedOperation(()=>client.rpc('meryo_accept_pickup_order',{p_id:id,p_deadline:deadline}));},
    rejectPickup:async(id)=>{await requireRole(['barbero']);return savedOperation(()=>client.rpc('meryo_reject_pickup_order',{p_id:id}));},
    cancelPickup:async(id)=>{await requireRole(['barbero']);return savedOperation(()=>client.rpc('meryo_cancel_pickup_order',{p_id:id}));},
    deliverPickup:async(id)=>{await requireRole(['barbero']);return savedOperation(()=>client.rpc('meryo_deliver_pickup_order',{p_id:id}));},
    retireAsset:async(id)=>{await requireRole(['barbero']);return savedOperation(()=>client.rpc('meryo_retirar_archivo',{p_id:id}));},
    adminShops:async()=>{await requireRole(['admin']);return readResult(client.rpc('meryo_admin_barberias'));},
    adminUsers:async(f,offset=0)=>{await requireRole(['admin']);return readResult(client.rpc('meryo_admin_usuarios',{p_search:f.search,p_role:f.role,p_active:f.active,p_offset:offset}));},
    adminBookings:async(f,offset=0)=>{await requireRole(['admin']);return readResult(client.rpc('meryo_admin_reservas',{p_from:f.from,p_to:f.to,p_shop:f.shop?Number(f.shop):null,p_status:f.status,p_search:f.search,p_offset:offset}));},
    adminBooking:async(id)=>{await requireRole(['admin']);return readResult(client.rpc('meryo_admin_reserva_detalle',{p_id:id}));},
    adminSummary:async(from,to)=>{await requireRole(['admin']);return readResult(client.rpc('meryo_admin_resumen',{p_from:from,p_to:to}));},
    moderateShop:async(id,action,reason,expected)=>{await requireRole(['admin']);return savedOperation(()=>client.rpc('meryo_moderar_barberia',{p_id:id,p_action:action,p_reason:reason,p_expected:expected}));},
    activate:async(id)=>{await requireRole(['admin']);const {error}=await client.rpc('activar_barberia',{p_id:id});if(error)throw error;const row=await readResult(client.from('barberias').select('id,estado,verificada').eq('id',id).single());if(!row.verificada||row.estado!=='activa')throw new Error('No se confirmó la activación');return row;},
  };
}

export function bookingLabel(row) {
  if(row.estado==='confirmada' && row.pagos?.some(p=>/prueba|fixture|simulad|sandbox|mock/i.test(p.proveedor)))return 'Registro de pruebas · no acredita un cobro';
  return ({solicitada:'Esperando respuesta',aceptada:'Aceptada · pendiente de pago',confirmada:'Confirmada',rechazada:'Rechazada',expirada:'Vencida',cancelada_cliente:'Cancelada por cliente',cancelada_barbero:'Cancelada por barbero',completada:'Completada',no_asistio:'No asistió'})[row.estado]??row.estado;
}
