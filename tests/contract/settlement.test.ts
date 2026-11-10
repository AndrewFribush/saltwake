import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,terms} from './helpers';
async function admitted(){const f=await fixture();await f.apply('publish',{actor:'maker',action:{type:'publish',terms:terms(Date.now()),fee:'3',funding:['maker-sword-0','maker-tonic-0','maker-tonic-1']}});await f.apply('admit',{actor:'buyer',action:{type:'admit',edition_id:'edition-0',expected_version:'1',expected_fee:'3',loadout_ids:['buyer-club'],seed:'1'}});return f;}
import type {Partition} from '../../packages/shared/src/types';
const d=():Partition=>({town_consumed:[],town_returned:['buyer-club'],town_forfeited:[],dungeon_consumed:['maker-tonic-0'],dungeon_extracted:['maker-sword-0'],dungeon_returned:['maker-tonic-1']});
const settle=(partition=d())=>({actor:'buyer',action:{type:'settle',run_id:'run-0',outcome:'extracted',disposition:partition,carried_dungeon_ids:['maker-sword-0']}});
test('extraction partitions exact items; fees settle once; malformed claims cannot mutate economics',{timeout:120000},async()=>{const f=await admitted();try{
 const before=await f.view('snapshot');
 for(const [id,command] of [
 ['missing',settle({...d(),dungeon_returned:[]})],['duplicate',settle({...d(),dungeon_returned:['maker-tonic-1','maker-tonic-1']})],
 ['origin',settle({...d(),town_returned:['maker-sword-0']})],['equipment-consumed',settle({...d(),town_returned:[],town_consumed:['buyer-club']})],
 ['unacquired',{...settle(),action:{...settle().action,carried_dungeon_ids:[]}}],
 ['early-expired',{...settle(),action:{...settle().action,outcome:'expired',disposition:{...d(),town_returned:[],town_forfeited:['buyer-club'],dungeon_extracted:[],dungeon_returned:['maker-sword-0','maker-tonic-1']}}}]
 ] as const){const rejected=await f.apply(id,command);assert.equal(rejected.status,'Rejected',id);if(id==='early-expired')assert.equal(rejected.result,'PrematureExpiry');assert.deepEqual(await f.view('snapshot'),before);}
 const r=await f.apply('settle',settle());assert.equal(r.status,'Applied');const after=await f.view('snapshot');assert.equal(after.credits.maker,'92');assert.equal(after.credits.buyer,'7');assert.equal(after.runs[0].status,'extracted');assert.deepEqual(after.editions[0].active_runs,[]);
 const item=(id:string)=>after.items.find((i:any)=>i.id===id).location;
 assert.deepEqual(item('maker-sword-0'),{kind:'owned',profile:'buyer'});assert.deepEqual(item('maker-tonic-0'),{kind:'consumed',operation:'settle'});assert.equal(item('maker-tonic-1').kind,'edition_fixed');assert.equal(item('buyer-club').kind,'owned');
 assert.deepEqual(await f.apply('settle',settle()),r);assert.equal((await f.apply('again',settle())).status,'Rejected');assert.deepEqual(await f.view('snapshot'),after);
 }finally{await f.sandbox.tearDown();}});
test('death forfeits town equipment and returns surviving finds; void refunds fee but never restores consumed rewards',{timeout:120000},async()=>{
 for(const outcome of ['died','void']){const f=await admitted();try{
 const partition={...d(),town_returned:outcome==='void'?['buyer-club']:[],town_forfeited:outcome==='died'?['buyer-club']:[],dungeon_extracted:[],dungeon_returned:['maker-sword-0','maker-tonic-1']};
 const action=outcome==='void'?{type:'void',run_id:'run-0',reason:'operator lost combat state',disposition:partition}:{type:'settle',run_id:'run-0',outcome,disposition:partition,carried_dungeon_ids:['maker-sword-0']};
 const r=await f.apply('end',{actor:'buyer',action});assert.equal(r.status,'Applied');const s=await f.view('snapshot');assert.equal(s.credits.buyer,outcome==='void'?'10':'7');assert.equal(s.credits.maker,outcome==='void'?'89':'92');assert.equal(s.items.find((i:any)=>i.id==='buyer-club').location.kind,outcome==='void'?'owned':'bank');assert.equal(s.items.find((i:any)=>i.id==='maker-tonic-0').location.kind,'consumed');assert.equal(s.items.filter((i:any)=>i.location.kind==='edition_fixed').length,2);
 assert.deepEqual(await f.apply('end',{actor:'buyer',action}),r);
 }finally{await f.sandbox.tearDown();}}
});
test('extracted finds brought into a later run become town risk; expiry forfeits that loadout',{timeout:180000},async()=>{
 const f=await admitted();try{
 assert.equal((await f.apply('first-end',settle())).status,'Applied');
 const t={...terms(Date.now()),sockets:[],no_reward:true};
 await f.apply('zero-pub',{actor:'maker',action:{type:'publish',terms:t,fee:'1',funding:[]}});
 const r=await f.apply('second',{actor:'buyer',action:{type:'admit',edition_id:'edition-1',expected_version:'1',expected_fee:'1',loadout_ids:['maker-sword-0'],seed:'8'}});assert.equal(r.status,'Applied');
 // Sandbox blocks advance simulated time by a different interval than RPC wall time.
 // Use bounded chunks and observe the actual contract clock after each chunk.
 for(let batch=0;batch<10&&BigInt(await f.view('clock_ms'))<BigInt(r.run.deadline_ms);batch++){
  const res=await fetch(f.sandbox.rpcUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'advance',method:'sandbox_fast_forward',params:{delta_height:1000}}),signal:AbortSignal.timeout(30000)});assert.equal((await res.json()).error,undefined);
 }
 assert.ok(BigInt(await f.view('clock_ms'))>=BigInt(r.run.deadline_ms),'contract clock must reach run deadline');
 const disposition={town_consumed:[],town_returned:[],town_forfeited:['maker-sword-0'],dungeon_consumed:[],dungeon_extracted:[],dungeon_returned:[]};
 const expired=await f.apply('expired',{actor:'buyer',action:{type:'settle',run_id:r.result,outcome:'expired',disposition,carried_dungeon_ids:[]}});assert.equal(expired.status,'Applied',expired.result);assert.equal((await f.view('snapshot')).items.find((i:any)=>i.id==='maker-sword-0').location.kind,'bank');
 }finally{await f.sandbox.tearDown();}
});
