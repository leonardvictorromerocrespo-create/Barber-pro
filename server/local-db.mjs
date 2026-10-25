import pg from 'pg';

// Fixed destination; ignores .env, DATABASE_URL and PG* connection overrides.
export const localConfig = Object.freeze({ host:'127.0.0.1', port:55440, user:'meryo_test_admin', database:'meryo_test', ssl:false });
export const localIds = Object.freeze({
  client:'20000000-0000-0000-0000-000000000001',
  barber:'20000000-0000-0000-0000-000000000002',
  otherClient:'20000000-0000-0000-0000-000000000003',
  otherBarber:'20000000-0000-0000-0000-000000000004',
});
export const localShop = 900001;
export const localService = 900001;
export function createLocalPool(){return new pg.Pool({...localConfig,max:8});}
export async function checkLocalTarget(pool){
  const {rows:[r]}=await pool.query('select current_database() db,host(inet_server_addr()) host,inet_server_port() port');
  if(r.db!==localConfig.database || r.host!==localConfig.host || r.port!==localConfig.port) throw Error('Destino local inesperado');
  const {rows:[schema]}=await pool.query("select to_regclass('meryo_private.launch_settings') is not null as ready, to_regprocedure('public.confirmar_pago_verificado(uuid,text,text,text,bigint,text,boolean)') is not null as payment_ready");
  if(!schema.ready || !schema.payment_ready) throw Error('Falta el contrato local previamente validado; no se aplican migraciones automaticamente');
}
export async function asLocal(pool,actor,sql,args=[]){
  const c=await pool.connect();
  try{
    await c.query('begin');
    if(actor==='server') await c.query('set local role service_role');
    else if(actor==='public') await c.query('set local role anon');
    else {
      if(!Object.hasOwn(localIds,actor)) throw Error('Actor de pruebas desconocido');
      await c.query('set local role authenticated');
      await c.query("select set_config('request.jwt.claim.sub',$1,true)",[localIds[actor]]);
    }
    const result=await c.query(sql,args);await c.query('commit');return result;
  }catch(e){await c.query('rollback');throw e;}finally{c.release();}
}
export async function seedLocal(pool){
  await checkLocalTarget(pool);
  const c=await pool.connect();
  try{
    await c.query('begin');
    // Inserts only this fixture's reserved IDs. Does not reset tables or sequences.
    for(const [actor,id] of Object.entries(localIds)){
      await c.query('insert into auth.users(id,email) values($1,$2) on conflict(id) do nothing',[id,`${actor}@meryo-local.example.invalid`]);
    }
    await c.query("insert into public.barberias(id,nombre,distrito,descripcion,verificada,estado,disponible_ahora) values(900001,'MERYO LOCAL A','Ate','Datos sinteticos de localhost',true,'activa',true),(900002,'MERYO LOCAL B','Lima','Datos sinteticos de localhost',true,'activa',true) on conflict(id) do nothing");
    await c.query("update public.profiles set rol='barbero',barberia_id=case when id=$1 then 900001 else 900002 end,activo=true where id in ($1,$2)",[localIds.barber,localIds.otherBarber]);
    await c.query("insert into public.servicios(id,barberia_id,nombre,precio,duracion_min,activo) values(900001,900001,'Corte local',30,30,true) on conflict(id) do nothing");
    await c.query("insert into public.horarios(barberia_id,dia_semana,hora_apertura,hora_cierre) select 900001,d,'09:00','19:00' from generate_series(0,6)d where not exists(select 1 from public.horarios h where h.barberia_id=900001 and h.dia_semana=d)");
    await c.query("update meryo_private.launch_settings set reservas_habilitadas=true,entorno='staging' where id=1 and entorno in ('disabled','staging')");
    await c.query('commit');
  }catch(e){await c.query('rollback');throw e;}finally{c.release();}
}
