import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,terms} from './helpers';
import type {Command} from '../../packages/shared/src/types';
test('SetFee invalidates quotes without changing escrow; retries, ownership, limits and cutoff enforced',{timeout:120000},async()=>{
 const f=await fixture();try{
 const base=terms(Number(await f.view('clock_ms')));
 await f.apply('publish',{actor:'maker',action:{type:'publish',terms:{...base,sockets:[],no_reward:true},fee:'3',funding:[]}});
 const admission=(actor:string,version='1',fee='3'):Command=>({actor,action:{type:'admit',edition_id:'edition-0',expected_version:version,expected_fee:fee,loadout_ids:[],seed:'42'}});
 const first=await f.apply('first',admission('buyer'));assert.equal(first.status,'Applied');
 const change:Command={actor:'maker',action:{type:'set_fee',edition_id:'edition-0',new_fee:'4'}};
 assert.deepEqual(await f.view('roundtrip_command',{command:change}),change);
 const r=await f.apply('price',change);assert.equal(r.status,'Applied');assert.deepEqual(await f.apply('price',change),r);
 const before=await f.view('snapshot');assert.equal(before.editions[0].version,'2');assert.deepEqual(before.runs[0],first.run);
 for(const [id,c] of [['stale',admission('p2')],['old-price',admission('p2','2','3')],['wrong-maker',{...change,actor:'p2'}],['too-large',{actor:'maker',action:{type:'set_fee',edition_id:'edition-0',new_fee:'1000001'}}]] as const){assert.equal((await f.apply(id,c)).status,'Rejected');assert.deepEqual(await f.view('snapshot'),before);}
 const next=await f.apply('next',admission('p2','2','4'));assert.equal(next.run.fee,'4');
 const disposition={town_consumed:[],town_returned:[],town_forfeited:[],dungeon_consumed:[],dungeon_extracted:[],dungeon_returned:[]};
 await f.apply('end',{actor:'buyer',action:{type:'settle',run_id:first.result,outcome:'extracted',disposition,carried_dungeon_ids:[]}});
 assert.equal((await f.view('snapshot')).credits.maker,'101');
 await f.apply('refund',{actor:'p2',action:{type:'void',run_id:next.result,reason:'recovery',disposition}});assert.equal((await f.view('snapshot')).credits.p2,'10');
 assert.equal((await f.apply('free',{actor:'maker',action:{type:'set_fee',edition_id:'edition-0',new_fee:'0'}})).status,'Applied');
 assert.equal((await f.apply('free-run',admission('p3','3','0'))).status,'Applied');
 for(let i=0;i<10&&BigInt(await f.view('clock_ms'))<BigInt(base.closes_at_ms);i++) await fetch(f.sandbox.rpcUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'ff',method:'sandbox_fast_forward',params:{delta_height:1000}})});
 assert.ok(BigInt(await f.view('clock_ms'))>=BigInt(base.closes_at_ms));const closed=await f.view('snapshot');assert.equal((await f.apply('late',change)).result,'EditionNotOpen');assert.deepEqual(await f.view('snapshot'),closed);
 }finally{await f.sandbox.tearDown();}
});
