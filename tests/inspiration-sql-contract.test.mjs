import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('incremental 027 keeps publications private, scopes public data and reuses guarded booking',async()=>{
 const sql=await fs.readFile(new URL('../db/incremental/027_inspiration_publications.sql',import.meta.url),'utf8');
 assert.match(sql,/alter table meryo_private\.inspiration_publications enable row level security/i);
 assert.match(sql,/revoke all on meryo_private\.inspiration_publications from public,anon,authenticated/i);
 assert.match(sql,/public\.meryo_es_propietario\(shop_id\)/i);
 assert.match(sql,/foreign key\(asset_id,barberia_id\)/i);assert.match(sql,/foreign key\(member_id,barberia_id\)/i);assert.match(sql,/foreign key\(service_id,barberia_id\)/i);
 assert.match(sql,/p_catalog_category=any\(shop\.tipos_negocio\)/i);assert.match(sql,/public\.meryo_barberia_publicable\(shop\.id\)/i);
 assert.match(sql,/asset\.active and asset\.kind='foto'/i);assert.match(sql,/active_service\.duracion_min between 1 and 240/i);
 assert.match(sql,/return public\.meryo_solicitar_cita\([\s\S]*?p_precio_esperado\)/i);
 assert.match(sql,/update public\.reservas set inspiration_publication_id=publication\.id,inspiration_title_snapshot=publication\.title/i);
 assert.match(sql,/create trigger meryo_inspiration_asset_retirement/i);
 assert.doesNotMatch(sql,/create table public\.reservas/i);assert.doesNotMatch(sql,/grant select .*inspiration_publications/i);
});
