import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,terms} from './helpers';
test('cutoff refuses new entry; active run blocks banking; late void returns stock then close banks it once',{timeout:120000},async()=>{
 const f=await fixture();try{
 const t={...terms(Date.now()),closes_at_ms:String(Date.now()+12000)};
 await f.apply('pub',{actor:'maker',action:{type:'publish',terms:t,fee:'3',funding:['maker-sword-0','maker-tonic-0','maker-tonic-1']}});
 const admit={actor:'buyer',action:{type:'admit',edition_id:'edition-0',expected_version:'1',expected_fee:'3',loadout_ids:['buyer-club'],seed:'5'}};
 await f.apply('enter',admit);
 const close={actor:'maker',action:{type:'finalize_close',edition_id:'edition-0'}};
 assert.equal((await f.apply('early',close)).status,'Rejected');
 // Advance only this ephemeral sandbox. Check contract time, not host guesses.
 const res=await fetch(f.sandbox.rpcUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'fast-forward',method:'sandbox_fast_forward',params:{delta_height:100}})});const body=await res.json();assert.equal(body.error,undefined);
 assert.ok(BigInt(await f.view('clock_ms'))>=BigInt(t.closes_at_ms));
 const before=await f.view('snapshot');assert.equal((await f.apply('active',close)).status,'Rejected');assert.equal((await f.apply('late-entry',{actor:'p2',action:{...admit.action,loadout_ids:['p2-club']}})).status,'Rejected');assert.deepEqual(await f.view('snapshot'),before);
 const partition={town_consumed:[],town_returned:['buyer-club'],town_forfeited:[],dungeon_consumed:['maker-tonic-0'],dungeon_extracted:[],dungeon_returned:['maker-sword-0','maker-tonic-1']};
 assert.equal((await f.apply('late-void',{actor:'buyer',action:{type:'void',run_id:'run-0',reason:'operator recovery',disposition:partition}})).status,'Applied');
 const r=await f.apply('close',close);assert.equal(r.status,'Applied');const after=await f.view('snapshot');assert.equal(after.editions[0].closed,true);assert.equal(after.items.filter((i:any)=>i.location.kind==='bank').length,2);assert.equal(after.credits.maker,'89');assert.equal(after.credits.buyer,'10');
 assert.deepEqual(await f.apply('close',close),r);assert.equal((await f.apply('close-again',close)).status,'Rejected');assert.deepEqual(await f.view('snapshot'),after);
 }finally{await f.sandbox.tearDown();}
});
test('seeded mixed outcomes conserve all credits and funded items through closure',{timeout:120000},async()=>{
 const f=await fixture();try{
 const funding=['maker-sword-0','maker-sword-1','maker-sword-2',...Array.from({length:6},(_,i)=>`maker-tonic-${i}`)];
 await f.apply('seed-pub',{actor:'maker',action:{type:'publish',terms:terms(Date.now()),fee:'3',funding}});
 const entrants=['buyer','p2','p3'];const receipts=[];
 for(const actor of entrants)receipts.push(await f.apply(`enter-${actor}`,{actor,action:{type:'admit',edition_id:'edition-0',expected_version:'1',expected_fee:'3',loadout_ids:[`${actor}-club`],seed:'17'}}));
 let seed=17;const outcomes=['extracted','died','void'];
 for(const receipt of receipts){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const outcome=outcomes.splice(seed%outcomes.length,1)[0];const run=receipt.run;const sword=run.assignments.find((a:any)=>a.socket==='sword').item_id;const tonics=run.assignments.filter((a:any)=>a.socket!=='sword').map((a:any)=>a.item_id);
 const disposition={town_consumed:[],town_returned:outcome==='died'?[]:run.loadout_ids,town_forfeited:outcome==='died'?run.loadout_ids:[],dungeon_consumed:[tonics[0]],dungeon_extracted:outcome==='extracted'?[sword]:[],dungeon_returned:outcome==='extracted'?[tonics[1]]:[sword,tonics[1]]};
 const action=outcome==='void'?{type:'void',run_id:run.id,reason:'seeded operator incident',disposition}:{type:'settle',run_id:run.id,outcome,disposition,carried_dungeon_ids:[sword]};
 const command={actor:run.player,action};const ended=await f.apply(`end-${run.id}`,command);assert.equal(ended.status,'Applied');assert.deepEqual(await f.apply(`end-${run.id}`,command),ended);
 }
 const res=await fetch(f.sandbox.rpcUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'advance',method:'sandbox_fast_forward',params:{delta_height:2000}})});assert.equal((await res.json()).error,undefined);
 assert.equal((await f.apply('close-mixed',{actor:'maker',action:{type:'finalize_close',edition_id:'edition-0'}})).status,'Applied');
 const state=await f.view('snapshot');assert.equal(state.credits.maker,'95');assert.equal(state.items.filter((i:any)=>i.location.kind==='consumed').length,3);assert.equal(state.items.filter((i:any)=>i.location.kind==='bank').length,6);assert.ok(state.runs.every((r:any)=>r.status!=='active'));
 }finally{await f.sandbox.tearDown();}
});
