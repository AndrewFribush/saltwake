import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,terms} from './helpers';
test('receipt exhaustion cannot strand paid runs or prevent later closure',{timeout:180000},async()=>{
 const f=await fixture();try{
 await f.apply('pub',{actor:'maker',action:{type:'publish',terms:terms(Date.now()),fee:'3',funding:['maker-sword-0','maker-tonic-0','maker-tonic-1']}});
 await f.apply('enter',{actor:'buyer',action:{type:'admit',edition_id:'edition-0',expected_version:'1',expected_fee:'3',loadout_ids:['buyer-club'],seed:'0'}});
 let rejectedByCapacity=false;let recorded=0;
 for(let i=0;i<255;i++){try{const receipt=await f.call('execute',{op_id:`fill-${i}`,command:{actor:'missing',action:{type:'debit',amount:'0'}}});assert.equal(receipt.status,'Rejected');assert.equal(receipt.result,'UnknownProfile');recorded++;}catch{rejectedByCapacity=true;break;}}
 assert.equal(rejectedByCapacity,true);assert.equal(recorded,252,'capacity must be reached, not an incidental RPC failure');
 const partition={town_consumed:[],town_returned:['buyer-club'],town_forfeited:[],dungeon_consumed:[],dungeon_extracted:[],dungeon_returned:['maker-sword-0','maker-tonic-0','maker-tonic-1']};
 const r=await f.apply('void-after-cap',{actor:'buyer',action:{type:'void',run_id:'run-0',reason:'capacity test recovery',disposition:partition}});assert.equal(r.status,'Applied');
 const res=await fetch(f.sandbox.rpcUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'advance',method:'sandbox_fast_forward',params:{delta_height:2000}})});assert.equal((await res.json()).error,undefined);
 assert.equal((await f.apply('close-after-cap',{actor:'maker',action:{type:'finalize_close',edition_id:'edition-0'}})).status,'Applied');
 assert.deepEqual(await f.view('operation',{op_id:'void-after-cap'}),r);
 }finally{await f.sandbox.tearDown();}
});
