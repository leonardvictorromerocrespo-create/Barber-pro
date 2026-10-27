import {test} from 'node:test';import assert from 'node:assert/strict';
import {validateContent,uploadContent} from '../src/lib/shop-content.js';
test('uploads enforce kind, format and size, and cannot report success before metadata persists',async()=>{
 for(const [file,kind] of [[{type:'image/svg+xml',size:100},'foto'],[{type:'image/jpeg',size:6*1024*1024},'portada'],[{type:'video/mp4',size:100},'foto'],[{type:'image/png',size:0},'foto']])assert.throws(()=>validateContent(file,kind));
 assert.equal(validateContent({type:'image/webp',size:100},'foto'),'webp');
 let saved=0;const client={storage:{from:()=>({upload:async()=>({error:{message:'No permission'}})})},rpc:()=>{saved++;}};
 await assert.rejects(uploadContent(client,1,{type:'image/jpeg',size:100},'portada'),/Storage no guardó/);assert.equal(saved,0);
 client.storage.from=()=>({upload:async()=>({error:null})});client.rpc=async()=>({error:{message:'Invalid object'}});
 await assert.rejects(uploadContent(client,1,{type:'image/jpeg',size:100},'portada'),/no se publicó/);
});
