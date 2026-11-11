import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,terms} from './helpers';
import {audit} from './invariants';
import {commandHash} from '../../packages/shared/src/protocol';
import type {Command,OperationStatus} from '../../packages/shared/src/types';

type Fixture=Awaited<ReturnType<typeof fixture>>;
const floor=()=>({tiles:['#############',...Array(7).fill('#...........#'),'#############'],spawn:{x:1,y:1},exit:{x:11,y:7},sockets:[{x:2,y:1},{x:3,y:1},{x:4,y:1},{x:5,y:1}]});
const module7=()=> 'custom7:'+JSON.stringify({...floor(),tuning:[]});
const operating=(now:number)=>({...terms(now),rules_version:8,modules:[module7(),module7()],sockets:[],no_reward:true,run_duration_ms:'60000',max_runs:1});
const partition=(ids:string[]=[])=>({town_consumed:[],town_returned:[],town_forfeited:[],dungeon_consumed:[],dungeon_extracted:[],dungeon_returned:ids});
const admission=(edition:string,actor:string):Command=>({actor,action:{type:'admit',edition_id:edition,expected_version:'1',expected_fee:'1',loadout_ids:[],seed:'42'}});

/** Compare the deadline with the actual execute receipt's block timestamp,
 * not a host clock or an approximate before/after RPC observation. */
async function admitExact(f:Fixture,id:string,edition:string,actor:string,duration:string){
 const command=admission(edition,actor);
 const result=await f.account.callFunctionRaw({contractId:f.contractId,methodName:'execute',args:{op_id:id,command},gas:100_000_000_000_000n,waitUntil:'FINAL'});
 const execution=result.receipts_outcome.find(o=>{
  const status=o.outcome.status;
  if(typeof status!=='object'||!('SuccessValue' in status)||!status.SuccessValue)return false;
  const value=JSON.parse(Buffer.from(status.SuccessValue,'base64').toString());return value?.op_id===id;
 });
 assert.ok(execution,'execute receipt with returned operation must be retained');
 const receipt=await f.view('operation',{op_id:id}) as OperationStatus;
 assert.equal(receipt.status,'Applied');assert.ok(receipt.status==='Applied'&&receipt.run);
 assert.equal(receipt.payload_hash,commandHash(command));
 const block=await f.provider.viewBlock({blockId:execution.block_hash});
 const executionMs=BigInt(block.header.timestamp_nanosec)/1_000_000n;
 assert.equal(BigInt(receipt.run.deadline_ms),executionMs+BigInt(duration));
 audit(await f.view('snapshot'));return receipt;
}

test('WASM v8 operating boundaries and custom7 validation preserve legacy restrictions',{timeout:120000},async()=>{
 const f=await fixture();try{
  const base=operating(Number(await f.view('clock_ms'))),before=await f.view('snapshot');
  const patches=[{run_duration_ms:'0'},{run_duration_ms:'59999'},{run_duration_ms:'3600001'},{max_runs:0},{max_runs:5},
   {closes_at_ms:String(BigInt(base.opens_at_ms)+86_400_001n)},
   {modules:[module7().replace('custom7:','custom8:'),module7()]},
   {modules:['custom7:'+JSON.stringify(floor()),module7()]},
   {modules:['custom7:'+JSON.stringify({...floor(),tuning:[{slot:0,hp:4}]}),module7()]},
   {modules:['custom7:'+JSON.stringify({...floor(),tuning:[{slot:0,hp:null}]}),module7()]},
   {modules:['custom7:'+JSON.stringify({...floor(),tuning:[],links:[{id:'next',x:2,y:3,to:1,require_clear:false}]}),module7()]},
   {modules:Array(2).fill('custom7:'+JSON.stringify({...floor(),tuning:[],links:[]}))}
  ];
  for(const [i,patch] of patches.entries()){
   const r=await f.apply('op-invalid-'+i,{actor:'maker',action:{type:'publish',terms:{...base,...patch},fee:'1',funding:[]}});
   assert.equal(r.status,'Rejected',String(i));assert.equal(r.result,i<5?'InvalidRules':'InvalidTerms');assert.deepEqual(await f.view('snapshot'),before);
  }
  for(let version=1;version<=7;version++){
   const modules=version<3?['cellar','gauntlet']:[0,1].map(room=>(version===3?'custom:':`custom${version}:`)+JSON.stringify({...floor(),...(version>=7?{tuning:[]} :{}),...(version===6?{links:[{id:'next',x:2,y:3,to:1-room,require_clear:true}]}:{})}));
   const legacy={...base,rules_version:version,modules,run_duration_ms:'900000',max_runs:4};
   for(const [i,patch] of [{run_duration_ms:'60000'},{run_duration_ms:'3600000'},{max_runs:1}].entries()){
    const saved=await f.view('snapshot');const r=await f.apply(`legacy-${version}-bad-${i}`,{actor:'maker',action:{type:'publish',terms:{...legacy,...patch},fee:'1',funding:[]}});
    assert.equal(r.result,'InvalidRules');assert.deepEqual(await f.view('snapshot'),saved);
   }
   const valid=await f.apply('legacy-'+version,{actor:'maker',action:{type:'publish',terms:legacy,fee:'1',funding:[]}});assert.equal(valid.status,'Applied');
   if(version===7)await admitExact(f,'legacy-exact',valid.result,'p5','900000');
  }
  for(const [i,patch] of [{run_duration_ms:'60000',max_runs:1},{run_duration_ms:'3600000',max_runs:4}].entries()){
   const r=await f.apply('op-boundary-'+i,{actor:'maker',action:{type:'publish',terms:{...base,...patch,closes_at_ms:String(BigInt(base.opens_at_ms)+86_400_000n)},fee:'1',funding:[]}});assert.equal(r.status,'Applied');
   const edition=(await f.view('snapshot')).editions.find((e:any)=>e.id===r.result);assert.equal(edition.terms.run_duration_ms,patch.run_duration_ms);assert.equal(edition.terms.max_runs,patch.max_runs);
   if(i===1)await admitExact(f,'maximum-exact',r.result,'p4','3600000');
  }
  const graph=[0,1].map(room=>'custom7:'+JSON.stringify({...floor(),tuning:[{slot:0,hp:3}],links:[{id:'next',x:2,y:3,to:1-room,require_clear:false}]}));
  assert.equal((await f.apply('op-tuned-graph',{actor:'maker',action:{type:'publish',terms:{...base,modules:graph,sockets:[0,1].map(room=>({id:'e'+room,room,slot:0,enemy:'pursuer',trap:false,reward:null}))},fee:'1',funding:[]}})).status,'Applied');
 }finally{await f.sandbox.tearDown();}
});

test('WASM v8 concurrency one blocks a second run until settlement and exact deadlines use admission time',{timeout:120000},async()=>{
 const f=await fixture();try{
  const t={...operating(Number(await f.view('clock_ms'))),no_reward:false,sockets:[{id:'reward',room:0,slot:0,enemy:'none',trap:false,reward:'tonic'}]};
  const published=await f.apply('single-publish',{actor:'maker',action:{type:'publish',terms:t,fee:'1',funding:['maker-tonic-0','maker-tonic-1']}});assert.equal(published.status,'Applied');
  const first=await admitExact(f,'single-first',published.result,'buyer','60000');
  const active=await f.view('snapshot');assert.equal(active.items.filter((i:any)=>i.location.kind==='edition_fixed').length,1,'a spare reward excludes stock depletion as the blocker');
  const blocked=await f.apply('single-blocked',admission(published.result,'p2'));assert.equal(blocked.result,'RunCapacity');assert.deepEqual(await f.view('snapshot'),active);
  const settled=await f.apply('single-settle',{actor:'buyer',action:{type:'settle',run_id:first.run!.id,outcome:'abandoned',disposition:partition(first.run!.assignments.map(a=>a.item_id)),carried_dungeon_ids:[]}});assert.equal(settled.status,'Applied');
  const second=await admitExact(f,'single-second',published.result,'p2','60000');assert.notEqual(second.run!.id,first.run!.id);
  const state=await f.view('snapshot');assert.deepEqual(state.editions[0].active_runs,[second.run!.id]);assert.equal(state.runs.find((r:any)=>r.id===first.run!.id).status,'abandoned');
  assert.deepEqual(await f.apply('single-second',admission(published.result,'p2')),second);assert.deepEqual(await f.view('snapshot'),state);
 }finally{await f.sandbox.tearDown();}
});

test('WASM v8 closes admissions at cutoff but active runs finish after close before their own deadline',{timeout:120000},async()=>{
 const f=await fixture();try{
  const now=Number(await f.view('clock_ms'));
  const t={...operating(now),closes_at_ms:String(now+20000),run_duration_ms:'3600000',sockets:[{id:'reward',room:0,slot:0,enemy:'none',trap:false,reward:'tonic'}],no_reward:false};
  const published=await f.apply('closing-publish',{actor:'maker',action:{type:'publish',terms:t,fee:'1',funding:['maker-tonic-0']}});assert.equal(published.status,'Applied');
  const admitted=await admitExact(f,'closing-admit',published.result,'buyer',t.run_duration_ms);assert.ok(BigInt(admitted.run!.deadline_ms)>BigInt(t.closes_at_ms));
  const close={actor:'maker',action:{type:'finalize_close',edition_id:published.result}};
  assert.equal((await f.apply('closing-early',close)).result,'BeforeCutoff');
  // Advance only this test's disposable sandbox, never the persistent runtime.
  for(let i=0;i<5&&BigInt(await f.view('clock_ms'))<BigInt(t.closes_at_ms);i++){
   const response=await fetch(f.sandbox.rpcUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'advance',method:'sandbox_fast_forward',params:{delta_height:100}}),signal:AbortSignal.timeout(30000)});assert.equal((await response.json()).error,undefined);
  }
  const clock=BigInt(await f.view('clock_ms'));assert.ok(clock>=BigInt(t.closes_at_ms));assert.ok(clock<BigInt(admitted.run!.deadline_ms));
  const active=await f.view('snapshot');
  assert.equal((await f.apply('closing-active',close)).result,'ActiveReservations');
  assert.equal((await f.apply('closing-late-admit',admission(published.result,'p2'))).result,'EditionNotOpen');assert.deepEqual(await f.view('snapshot'),active);
  assert.equal((await f.apply('closing-finish',{actor:'buyer',action:{type:'settle',run_id:admitted.run!.id,outcome:'abandoned',disposition:partition(admitted.run!.assignments.map(a=>a.item_id)),carried_dungeon_ids:[]}})).status,'Applied');
  assert.equal((await f.apply('closing-final',close)).status,'Applied');
  const state=await f.view('snapshot');assert.equal(state.editions[0].closed,true);assert.deepEqual(state.editions[0].active_runs,[]);assert.equal(state.items.find((i:any)=>i.id==='maker-tonic-0').location.kind,'bank');
  assert.equal(state.credits.buyer,'9');assert.equal(state.credits.maker,'98');
 }finally{await f.sandbox.tearDown();}
});

test('WASM v8 rejects premature expiry and frees configured capacity after the exact deadline',{timeout:120000},async()=>{
 const f=await fixture();try{
  const now=Number(await f.view('clock_ms')),t={...operating(now),closes_at_ms:String(now+3600000)};
  const published=await f.apply('expiry-publish',{actor:'maker',action:{type:'publish',terms:t,fee:'1',funding:[]}});assert.equal(published.status,'Applied');
  const first=await admitExact(f,'expiry-first',published.result,'buyer','60000');
  const expire:Command={actor:'buyer',action:{type:'settle',run_id:first.run!.id,outcome:'expired',disposition:partition(),carried_dungeon_ids:[]}};
  const active=await f.view('snapshot');
  assert.equal((await f.apply('expiry-premature',expire)).result,'PrematureExpiry');assert.deepEqual(await f.view('snapshot'),active);
  for(let i=0;i<5&&BigInt(await f.view('clock_ms'))<BigInt(first.run!.deadline_ms);i++){
   const response=await fetch(f.sandbox.rpcUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'expiry-advance',method:'sandbox_fast_forward',params:{delta_height:100}}),signal:AbortSignal.timeout(30000)});assert.equal((await response.json()).error,undefined);
  }
  assert.ok(BigInt(await f.view('clock_ms'))>=BigInt(first.run!.deadline_ms));
  // Passing the clock deadline alone does not silently remove an active run.
  assert.equal((await f.apply('expiry-before-settle',admission(published.result,'p2'))).result,'RunCapacity');
  const expired=await f.apply('expiry-settle',expire);assert.equal(expired.status,'Applied');
  const ended=await f.view('snapshot');assert.equal(ended.runs[0].status,'expired');assert.deepEqual(ended.editions[0].active_runs,[]);
  assert.deepEqual(await f.apply('expiry-settle',expire),expired);assert.deepEqual(await f.view('snapshot'),ended);
  const next=await admitExact(f,'expiry-next',published.result,'p2','60000');assert.notEqual(next.run!.id,first.run!.id);
 }finally{await f.sandbox.tearDown();}
});
