import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import vm from 'node:vm';
test('pickup migration is incremental, RLS-only for table access, atomic at acceptance, and scheduled server-side',async()=>{
 const sql=await fs.readFile('db/incremental/021_product_pickup_store.sql','utf8');
 for(const table of ['meryo_products','meryo_pickup_orders','meryo_pickup_order_items'])assert.match(sql,new RegExp(`alter table public\\.${table} enable row level security`));
 for(const marker of ['meryo_request_pickup','meryo_accept_pickup_order','meryo_reject_pickup_order','meryo_cancel_pickup_order','meryo_deliver_pickup_order','meryo_archive_product','meryo_pickup_orders','skip locked','cron.schedule','for update of p','precio_snapshot','pedido_id'])assert.ok(sql.toLowerCase().includes(marker.toLowerCase()),`missing ${marker}`);
 assert.doesNotMatch(sql,/\b(drop\s+table|delete\s+from\s+public\.meryo_products)\b/i);
});
test('pickup push click separates owner and customer destinations',async()=>{
 const source=await fs.readFile('public/meryo-push-sw.js','utf8'),handlers={},shown=[],opened=[],self={location:{origin:'https://meryo.example'},addEventListener:(kind,fn)=>handlers[kind]=fn,registration:{showNotification:async(_title,o)=>shown.push(o)},clients:{matchAll:async()=>[],openWindow:async url=>opened.push(url)}};
 vm.runInNewContext(source,{self,URL,Response,fetch:async()=>{}});const id='20000000-0000-0000-0000-000000000002';
 for(const [event,expected] of [['pedido_solicitado',`https://meryo.example/?pedido=${id}&pedido_origen=negocio&shop_view=tienda&tienda_view=pedidos#shop-manage`],['pedido_aceptado',`https://meryo.example/?pedido=${id}#my-orders`]]){let task;handlers.push({data:{json:()=>({event,orderId:id})},waitUntil:p=>task=p});await task;handlers.notificationclick({notification:{close(){},data:shown.at(-1).data},waitUntil:p=>task=p});await task;assert.equal(opened.at(-1),expected);}
});
