import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,terms} from './helpers';
const admit=(actor:string,edition_id='edition-0')=>({actor,action:{type:'admit',edition_id,expected_version:'1',expected_fee:'3',loadout_ids:[`${actor}-club`],seed:'42'}});
async function publish(f:Awaited<ReturnType<typeof fixture>>,copies:number){const funding=[];for(let i=0;i<copies;i++)funding.push(`maker-sword-${i}`,`maker-tonic-${i*2}`,`maker-tonic-${i*2+1}`);return f.apply('pub',{actor:'maker',action:{type:'publish',terms:terms(Date.now()),fee:'3',funding}});}
test('one complete bundle: racing admissions yield one charged run, exact loadout and deadline',{timeout:120000},async()=>{
 const f=await fixture();try{
 assert.equal((await publish(f,1)).status,'Applied');
 const results=await Promise.all([f.apply('enter-a',admit('buyer')),f.apply('enter-b',admit('p2'))]);
 assert.deepEqual(results.map(r=>r.status).sort(),['Applied','Rejected']);
 const state=await f.view('snapshot');assert.equal(state.runs.length,1);const run=state.runs[0];
 assert.equal(run.assignments.length,3);assert.equal(new Set(run.assignments.map((a:any)=>a.item_id)).size,3);
 assert.equal(state.credits[run.player],'7');assert.equal(state.credits[run.player==='buyer'?'p2':'buyer'],'10');assert.equal(state.credits.maker,'89');assert.equal(run.fee,'3');
 assert.ok(BigInt(run.deadline_ms)>BigInt(Date.now()+880000));assert.ok(BigInt(run.deadline_ms)<BigInt(Date.now()+920000));
 assert.equal(state.items.filter((i:any)=>i.location.kind==='reserved').length,3);assert.equal(state.items.filter((i:any)=>i.location.kind==='loadout').length,1);
 const winner=results.find(r=>r.status==='Applied');assert.deepEqual(winner.run,run);assert.deepEqual(await f.apply(winner.op_id,admit(run.player)),winner);assert.deepEqual(await f.view('snapshot'),state);
 }finally{await f.sandbox.tearDown();}
});
test('three funded copies support three runs; stale quotes, reused loadouts, self-entry and repeat profile reject',{timeout:120000},async()=>{
 const f=await fixture();try{
 await publish(f,3);const before=await f.view('snapshot');
 for(const [id,c] of [
 ['stale',{actor:'buyer',action:{...admit('buyer').action,expected_version:'0'}}],
 ['price',{actor:'buyer',action:{...admit('buyer').action,expected_fee:'4'}}],
 ['unowned',{actor:'buyer',action:{...admit('buyer').action,loadout_ids:['p2-club']}}],
 ['duplicate',{actor:'buyer',action:{...admit('buyer').action,loadout_ids:['buyer-club','buyer-club']}}],
 ['self',{actor:'maker',action:{...admit('maker').action,loadout_ids:[]}}]
 ] as const){assert.equal((await f.apply(id,c)).status,'Rejected',id);assert.deepEqual(await f.view('snapshot'),before);}
 for(const actor of ['buyer','p2','p3'])assert.equal((await f.apply(actor,admit(actor))).status,'Applied');
 const full=await f.view('snapshot');assert.equal(full.runs.length,3);assert.equal(full.items.filter((i:any)=>i.location.kind==='reserved').length,9);
 assert.equal((await f.apply('repeat',admit('buyer'))).status,'Rejected');assert.equal((await f.apply('fourth',admit('p4'))).status,'Rejected');assert.deepEqual(await f.view('snapshot'),full);
 }finally{await f.sandbox.tearDown();}
});
test('zero-reward edition still caps at four and honors opening window',{timeout:120000},async()=>{
 const f=await fixture();try{
 const t={...terms(Date.now()),sockets:[],no_reward:true};
 await f.apply('future',{actor:'maker',action:{type:'publish',terms:{...t,opens_at_ms:String(Date.now()+60000)},fee:'3',funding:[]}});
 const before=await f.view('snapshot');assert.equal((await f.apply('early',admit('buyer'))).status,'Rejected');assert.deepEqual(await f.view('snapshot'),before);
 await f.apply('open',{actor:'maker',action:{type:'publish',terms:t,fee:'3',funding:[]}});
 for(const actor of ['buyer','p2','p3','p4'])assert.equal((await f.apply(actor,admit(actor,'edition-1'))).status,'Applied');
 const full=await f.view('snapshot');assert.equal((await f.apply('fifth',admit('p5','edition-1'))).status,'Rejected');assert.deepEqual(await f.view('snapshot'),full);
 }finally{await f.sandbox.tearDown();}
});
