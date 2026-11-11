import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,terms} from './helpers';
// A 256-slot receipt window (128 recent receipts + 128 tombstones, nothing old enough to forget) behaves like the
// old 256-receipt cap: ordinary work stops while terminal headroom remains. tests/contract/long-lived.test.ts covers expiry.
test('a full receipt window cannot strand paid runs or prevent later closure',{timeout:600000},async()=>{
 const f=await fixture(undefined,{method:'init_demo_capacity_test',args:{recent:128,replay_slots:128,min_age_ms:'3600000',materials:0,maker_coins:'0'}});try{
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
 assert.equal((await f.view('operation',{op_id:'fill-0'})).result,'UnknownProfile','receipts pushed out of the recent tier are still remembered');
 }finally{await f.sandbox.tearDown();}
});
