import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {KeyPairSigner,type KeyPairString} from 'near-api-js';
import {fixture,terms} from '../../../tests/contract/helpers';
import {audit} from '../../../tests/contract/invariants';
import {playerProfile} from '../../../packages/shared/src/player-identity';
import {encodeCustomModule,type CustomFloor} from '../../../packages/shared/src/custom-layout';
import type {Command,EconomySnapshot,Partition} from '../../../packages/shared/src/types';
import {Store} from '../src/db';
import {Outbox} from '../src/outbox';
import {NearChain} from '../src/chain';
import {Runs,type SavedRun} from '../src/runs';

const empty=():Partition=>({town_consumed:[],town_returned:[],town_forfeited:[],dungeon_consumed:[],dungeon_returned:[],dungeon_extracted:[]});
async function setup(){
 const f=await fixture(),dir=mkdtempSync(join(tmpdir(),'player-discovery-')),path=join(dir,'db');let db:Store|undefined;
 try{
  const profile=playerProfile('outsider');
  const direct=(request_id:string,action:Command['action'])=>f.outsider.callFunction<any>({contractId:f.contractId,methodName:'execute_player',args:{request_id,action},gas:100_000_000_000_000n,waitUntil:'FINAL'});
  await f.outsider.callFunction({contractId:f.contractId,methodName:'register_player',args:{},gas:100_000_000_000_000n,waitUntil:'FINAL'});
  const operator=async(id:string,action:Command['action'],actor='maker')=>{const receipt=await f.account.callFunction<any>({contractId:f.contractId,methodName:'execute',args:{op_id:id,command:{actor,action}},gas:100_000_000_000_000n,waitUntil:'FINAL'});assert.equal(receipt.status,'Applied',receipt.result);return receipt;};
  // Earn the admission fee by extracting and selling real funded treasure. No
  // game-credit grants or local admission records are used, even for bootstrap.
  const base={...terms(Number(await f.view('clock_ms'))),closes_at_ms:String(BigInt(await f.view('clock_ms'))+600000n)};
  const warm=await operator('warm-publish',{type:'publish',terms:{...base,sockets:[{id:'gear',room:0,slot:0,enemy:'none',trap:false,reward:'sword'},{id:'cash',room:0,slot:1,enemy:'none',trap:false,reward:'tonic'}]},fee:'0',funding:['maker-sword-0','maker-tonic-0']});
  const acquired=await direct('warm-entry',{type:'admit',edition_id:warm.result,expected_version:'1',expected_fee:'0',loadout_ids:[],seed:'0'});assert.equal(acquired.status,'Applied');
  await operator('warm-extract',{type:'settle',run_id:acquired.result,outcome:'extracted',carried_dungeon_ids:['maker-sword-0','maker-tonic-0'],disposition:{...empty(),dungeon_extracted:['maker-sword-0','maker-tonic-0']}},profile);
  const listing=await direct('sell-found',{type:'list',item_ids:['maker-tonic-0'],unit_price:'3'});assert.equal(listing.status,'Applied');
  await operator('maker-buyback',{type:'buy',listing_id:listing.result,item_ids:['maker-tonic-0'],expected_unit_price:'3'});
  const floor=(sockets:CustomFloor['sockets']):CustomFloor=>({tiles:['#############',...Array(7).fill('#...........#'),'#############'],spawn:{x:1,y:1},exit:{x:11,y:7},sockets,tuning:[],devices:[],exit_rule:{extract:true,require_clear:false}});
  const floors=[floor([{x:2,y:1}]),floor([{x:9,y:6}])];
  const published=await operator('discovery-publish',{type:'publish_random',terms:{...base,rules_version:11,modules:floors.map(room=>encodeCustomModule(room,'missions')),run_duration_ms:'60000',max_runs:1,sockets:[{id:'medicine',room:0,slot:0,enemy:'none',trap:true,reward:'tonic'},{id:'hidden-blade',room:1,slot:0,enemy:'none',trap:false,reward:null}]},fee:'2',fixed_funding:['maker-tonic-0'],random_tables:[{table_id:'blades',socket_ids:['hidden-blade'],item_ids:['maker-sword-1']}]});
  const entered=await direct('outside-server',{type:'admit',edition_id:published.result,expected_version:'1',expected_fee:'2',loadout_ids:['maker-sword-0'],seed:'0'});assert.equal(entered.status,'Applied');
  const snapshot=async()=>{const s=await f.provider.callFunction<EconomySnapshot>({contractId:f.contractId,method:'snapshot',args:{},blockQuery:{finality:'final'}});assert.ok(s,'Final snapshot required');audit(s);return s;};
  const active=await snapshot();assert.deepEqual(active.runs.find(r=>r.id===entered.result),entered.run,'final snapshot must include the direct admission');let now=Number(await f.view('clock_ms'));
  const chain=new NearChain(f.provider,KeyPairSigner.fromSecretKey(f.genesis.privateKey as KeyPairString),f.contractId,f.contractId);
  const open=()=>{db=new Store(path);const box=new Outbox(db,chain);return {db,box,runs:new Runs(db,box,()=>now)};};
  const advance=async()=>{
   for(let i=0;i<100&&BigInt(await f.view('clock_ms'))<BigInt(entered.run.deadline_ms);i++){
    const res=await fetch(f.sandbox.rpcUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'discovery-clock',method:'sandbox_fast_forward',params:{delta_height:100}}),signal:AbortSignal.timeout(30000)});assert.equal((await res.json()).error,undefined);
   }
   now=Number(await f.view('clock_ms'));assert.ok(now>=Number(entered.run.deadline_ms));
  };
  return {profile,floors,entered,active,published,operator,snapshot,open,advance,reopen(){db?.close();return open();},async close(){db?.close();rmSync(dir,{recursive:true,force:true});await f.sandbox.tearDown();}};
 }catch(e){db?.close();rmSync(dir,{recursive:true,force:true});await f.sandbox.tearDown();throw e;}
}

function assertNoAdmission(db:Store){assert.ok(db.operations().every(op=>op.command.action.type!=='admit'),'discovery must not fabricate an admission command or receipt');}
function assertNotPlayable(runs:Runs,db:Store,id:string,profile:string){
 const row=db.get<SavedRun>('run',id);
 if(row){assert.ok(row.terminal,'known chain-terminal run must not become playable');assert.throws(()=>runs.action(id,profile,'revive',row.seq,{type:'wait'}));}
 else assert.throws(()=>runs.get(id,profile));
}

test('wallet snapshot discovery materializes exact reservations without inventing receipts/timing and survives replay/restart',{timeout:120000},async()=>{
 const f=await setup();try{
  let local=f.open();assert.deepEqual(local.db.operations(),[]);
  await local.runs.discoverPlayerRuns(f.active);
  const row=local.runs.get(f.entered.result,f.profile);assert.deepEqual(row.economic,f.entered.run);assert.equal(row.startedAtMs,undefined,'unknown admission timestamp stays unknown');assert.equal(row.admissionSource,'chain-discovery');
  assert.deepEqual(row.economic.assignments,[{socket:'medicine',item_id:'maker-tonic-0',source_pool:'fixed:"tonic"'},{socket:'hidden-blade',item_id:'maker-sword-1',source_pool:'random:blades'}]);
  assert.equal(row.economic.seed,f.active.runs.find(r=>r.id===row.id)!.seed);
  assert.deepEqual(row.state.items['maker-tonic-0'].location,{kind:'floor',room:0,...f.floors[0].sockets[0]});
  assert.deepEqual(row.state.items['maker-sword-1'].location,{kind:'floor',room:1,...f.floors[1].sockets[0]});
  assert.equal(row.state.items['maker-sword-0'].origin,'town');assert.equal(row.state.player.weapon,'sword');
  assert.deepEqual(local.db.operations(),[]);assert.equal(local.db.all<SavedRun>('run').length,1,'terminal bootstrap run is not rematerialized');
  const view=JSON.stringify(local.runs.view(row.id,f.profile));assert.ok(!view.includes('maker-sword-1'));assert.ok(!view.includes('source_pool'));assert.ok(!view.includes('"seed"'));
  local.runs.action(row.id,f.profile,'move',0,{type:'move',x:2,y:1});
  local.runs.action(row.id,f.profile,'take',1,{type:'pickup',itemId:'maker-tonic-0'});
  local.runs.action(row.id,f.profile,'drink',2,{type:'use',itemId:'maker-tonic-0'});
  const progressed=local.runs.get(row.id,f.profile);assert.equal(progressed.seq,3);assert.equal(progressed.state.items['maker-tonic-0'].location.kind,'consumed');
  await local.runs.discoverPlayerRuns(await f.snapshot());assert.deepEqual(local.runs.get(row.id,f.profile),progressed);assertNoAdmission(local.db);
  local=f.reopen();await local.runs.discoverPlayerRuns(f.active);assert.deepEqual(local.runs.get(row.id,f.profile),progressed,'rediscovery cannot reset consumed items, HP, position, turns or sequence');
  local.runs.finish(local.runs.get(row.id,f.profile),'abandoned');const terminal=local.runs.get(row.id,f.profile).settlement!;
  assert.equal((await local.box.process(terminal)).status,'Applied');const settled=await f.snapshot();
  assert.equal(settled.items.find(i=>i.id==='maker-tonic-0')!.location.kind,'consumed');
  assert.deepEqual(settled.items.find(i=>i.id==='maker-sword-1')!.location,{kind:'edition_random',edition:f.published.result,table_id:'blades'});
  await local.runs.discoverPlayerRuns(settled);await local.runs.discoverPlayerRuns(f.active);assertNotPlayable(local.runs,local.db,row.id,f.profile);assertNoAdmission(local.db);
 }finally{await f.close();}
});

test('absent-server late wallet discovery expires through the real oracle without stranded fees or goods',{timeout:120000},async()=>{
 const f=await setup();try{
  await f.advance();const late=await f.snapshot(),makerBefore=BigInt(late.credits.maker);
  const local=f.open();assert.equal(local.db.operations().length,0);
  await local.runs.discoverPlayerRuns(late);local.runs.expire();local.runs.expire();
  const row=local.runs.get(f.entered.result,f.profile);assert.equal(row.terminal,'expired');assert.equal(row.startedAtMs,undefined);assert.equal(row.finishedAtMs,Number(f.entered.run.deadline_ms));assertNoAdmission(local.db);
  assert.equal(local.db.operations().length,1);const settled=await local.box.process(row.settlement!);assert.equal(settled.status,'Applied',settled.reason);
  const final=await f.snapshot();assert.equal(final.runs.find(r=>r.id===row.id)!.status,'expired');assert.equal(final.credits[f.profile],'1');assert.equal(BigInt(final.credits.maker),makerBefore+2n);
  assert.deepEqual(final.items.find(i=>i.id==='maker-sword-0')!.location,{kind:'bank'});
  assert.deepEqual(final.items.find(i=>i.id==='maker-tonic-0')!.location,{kind:'edition_fixed',edition:f.published.result,item_type:'tonic'});
  assert.deepEqual(final.items.find(i=>i.id==='maker-sword-1')!.location,{kind:'edition_random',edition:f.published.result,table_id:'blades'});
  assert.deepEqual(final.editions.find(e=>e.id===f.published.result)!.active_runs,[]);
  const restarted=f.reopen();await restarted.runs.discoverPlayerRuns(final);restarted.runs.expire();await restarted.box.recover();assert.equal(restarted.db.operations().length,1);assert.deepEqual(await f.snapshot(),final);assertNoAdmission(restarted.db);
 }finally{await f.close();}
});

test('externally terminal wallet runs cannot be resurrected by older snapshots after restart',{timeout:120000},async()=>{
 const f=await setup();try{
  const ids=f.entered.run.assignments.map((a:{item_id:string})=>a.item_id);
  await f.operator('outside-terminal',{type:'settle',run_id:f.entered.result,outcome:'extracted',carried_dungeon_ids:ids,disposition:{...empty(),town_returned:['maker-sword-0'],dungeon_extracted:ids}},f.profile);
  const final=await f.snapshot();for(const id of ids)assert.deepEqual(final.items.find(i=>i.id===id)!.location,{kind:'owned',profile:f.profile});
  let local=f.open();await local.runs.discoverPlayerRuns(final);assertNotPlayable(local.runs,local.db,f.entered.result,f.profile);assert.deepEqual(local.db.operations(),[]);
  local=f.reopen();await local.runs.discoverPlayerRuns(f.active);assertNotPlayable(local.runs,local.db,f.entered.result,f.profile);assert.deepEqual(local.db.operations(),[]);
  assert.deepEqual(await f.snapshot(),final,'discovery cannot replay settlement or old reserved ownership');assertNoAdmission(local.db);
 }finally{await f.close();}
});


test('discovery rejects malformed copies of final snapshots with mismatched exact ownership',{timeout:120000},async()=>{
 const f=await setup();try{
  const local=f.open(),runId=f.entered.result;
  const changes:((s:EconomySnapshot)=>void)[]=[
   s=>{s.editions.find(e=>e.id===f.published.result)!.active_runs=[];},
   s=>{s.items.find(i=>i.id==='maker-sword-0')!.location={kind:'owned',profile:f.profile};},
   s=>{s.items.find(i=>i.id==='maker-sword-0')!.location={kind:'loadout',run:runId,profile:'maker'};},
   s=>{s.items.find(i=>i.id==='maker-tonic-0')!.location={kind:'reserved',run:'other-run',socket:'medicine',source_pool:'fixed:"tonic"'};},
   s=>{s.items.find(i=>i.id==='maker-tonic-0')!.location={kind:'reserved',run:runId,socket:'other-socket',source_pool:'fixed:"tonic"'};},
   s=>{s.items.find(i=>i.id==='maker-sword-1')!.location={kind:'reserved',run:runId,socket:'hidden-blade',source_pool:'random:other-pool'};},
   s=>{s.runs.find(r=>r.id===runId)!.assignments.push(structuredClone(s.runs.find(r=>r.id===runId)!.assignments[0]));}
  ];
  for(const change of changes){const bad=structuredClone(f.active);change(bad);assert.throws(()=>local.runs.discoverPlayerRuns(bad),/reserv|ownership/i);assert.equal(local.db.get('run',runId),undefined);assert.deepEqual(local.db.operations(),[]);}
  await local.runs.discoverPlayerRuns(await f.snapshot());assert.equal(local.runs.get(runId,f.profile).admissionSource,'chain-discovery');assertNoAdmission(local.db);
 }finally{await f.close();}
});

test('existing discovered progress imports actual external terminal status without fabricated settlement evidence',{timeout:120000},async()=>{
 const f=await setup();try{
  let local=f.open();await local.runs.discoverPlayerRuns(f.active);
  local.runs.action(f.entered.result,f.profile,'move-before-external',0,{type:'move',x:2,y:1});
  const before=local.runs.get(f.entered.result,f.profile);
  await f.operator('external-void',{type:'void',run_id:f.entered.result,reason:'independent oracle recovery',disposition:{...empty(),town_returned:['maker-sword-0'],dungeon_returned:f.entered.run.assignments.map((a:{item_id:string})=>a.item_id)}},f.profile);
  const final=await f.snapshot();await local.runs.discoverPlayerRuns(final);
  const row=local.runs.get(f.entered.result,f.profile);assert.equal(row.externalSettlement,true);assert.equal(row.terminal,'void');assert.equal(row.finishedAtMs,undefined);assert.equal(row.startedAtMs,undefined);assert.equal(row.settlement,undefined);assert.equal(row.seq,before.seq);assert.deepEqual(row.state.player,before.state.player);
  assert.deepEqual(row.economic,final.runs.find(r=>r.id===row.id));
  const view=local.runs.view(row.id,f.profile);assert.equal(view.canExtract,false);assert.equal(view.canContinue,false);assert.equal(view.settlement?.status,'Applied');assert.equal(view.settlement?.receipt,null);assert.equal(view.settlement?.disposition,null);assert.equal((view.settlement as {source?:string})?.source,'chain');
  assert.deepEqual(local.db.operations(),[]);local=f.reopen();await local.runs.discoverPlayerRuns(f.active);assert.deepEqual(local.runs.get(row.id,f.profile),row);assertNotPlayable(local.runs,local.db,row.id,f.profile);assertNoAdmission(local.db);
 }finally{await f.close();}
});

test('terminal discovery interrupted between durable writes cannot leave playable stale progress after restart',{timeout:120000},async()=>{
 const f=await setup();try{
  let local=f.open();await local.runs.discoverPlayerRuns(f.active);
  await f.operator('crash-terminal',{type:'void',run_id:f.entered.result,reason:'external recovery before local restart',disposition:{...empty(),town_returned:['maker-sword-0'],dungeon_returned:f.entered.run.assignments.map((a:{item_id:string})=>a.item_id)}},f.profile);
  const final=await f.snapshot();
  const put=local.db.put.bind(local.db);
  local.db.put=(kind,id,value)=>{put(kind,id,value);if(kind==='run-terminal-seen'&&id===f.entered.result)throw Error('simulated interruption after terminal marker write');};
  assert.throws(()=>local.runs.discoverPlayerRuns(final),/simulated interruption/);
  local=f.reopen();
  // If the operation was transactional it rolled back; otherwise the durable
  // marker must itself prevent stale local progress from being playable.
  if(local.db.get('run-terminal-seen',f.entered.result)){
   await local.runs.discoverPlayerRuns(f.active);assertNotPlayable(local.runs,local.db,f.entered.result,f.profile);
  }
  await local.runs.discoverPlayerRuns(final);assertNotPlayable(local.runs,local.db,f.entered.result,f.profile);assertNoAdmission(local.db);
 }finally{await f.close();}
});
