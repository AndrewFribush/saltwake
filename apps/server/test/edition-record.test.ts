import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../src/db';
import {editionRecord} from '../src/edition-record';
import {createRun} from '../../../packages/game/src/state';
import type {SavedRun} from '../src/runs';
import type {EconomySnapshot,EconomicRun,Partition} from '../../../packages/shared/src/types';
function fixture(t:{after:(f:()=>void)=>void}){
 const dir=mkdtempSync(join(tmpdir(),'edition-record-'));let db=new Store(join(dir,'db'));
 t.after(()=>{db.close();rmSync(dir,{recursive:true,force:true});});
 const world={runs:[],items:[]} as unknown as EconomySnapshot;
 function add(id:string,status:EconomicRun['status'],edition='e'){
  const run:EconomicRun={id,edition,player:'p',fee:'2',deadline_ms:'900000',seed:'0',loadout_ids:[],assignments:[],status,terminal_reason:null};world.runs.push(run);
  const saved:SavedRun={id,profile:'p',economic:run,state:createRun(),seq:0,terminal:status==='active'?undefined:status,startedAtMs:1000,finishedAtMs:61000,settlement:'op-'+id};db.put('run',id,saved);return saved;
 }
 function extracted(id:string,applied=true){
  add(id,'extracted');world.items.push({id:'loot-'+id,item_type:'sword',location:{kind:'owned',profile:'p'}});
  const disposition:Partition={town_consumed:[],town_returned:[],town_forfeited:[],dungeon_consumed:[],dungeon_returned:[],dungeon_extracted:['loot-'+id]};
  db.putOperation({id:'op-'+id,hash:'hash',status:applied?'Applied':'Unknown',command:{actor:'p',action:{type:'settle',run_id:id,outcome:'extracted',disposition,carried_dungeon_ids:['loot-'+id]}},...(applied?{receipt:{status:'Applied' as const,op_id:'op-'+id,payload_hash:'hash',result:id,run:null}}:{})});
 }
 return {get db(){return db;},world,add,extracted,restart(){db.close();db=new Store(join(dir,'db'));}};
}
test('includes losses as zero, excludes void/active, scopes edition and survives restart',t=>{
 const f=fixture(t);f.extracted('win');f.add('loss','died');f.add('quit','abandoned');f.add('timeout','expired');f.add('void','void');f.add('pending','active');f.extracted('other');f.world.runs.at(-1)!.edition='other';
 const r=editionRecord(f.world,f.db,'e');assert.equal(r.completed,4);assert.equal(r.averageLoot,3);assert.equal(r.medianLoot,0);assert.equal(r.averageSeconds,60);assert.equal(r.lootSamples,4);assert.equal(r.active,1);assert.equal(r.voided,1);assert.equal(r.participants,1);
 f.restart();assert.deepEqual(editionRecord(f.world,f.db,'e'),r);
});
test('unconfirmed extraction and legacy or invalid timing are missing, never fabricated zeros',t=>{
 const f=fixture(t);f.extracted('win',false);const loss=f.add('loss','died');delete loss.startedAtMs;f.db.put('run',loss.id,loss);
 const win=f.db.get<SavedRun>('run','win')!;win.finishedAtMs=0;f.db.put('run',win.id,win);
 const r=editionRecord(f.world,f.db,'e');assert.equal(r.completed,2);assert.equal(r.lootSamples,1);assert.equal(r.averageLoot,0);assert.equal(r.durationSamples,0);assert.equal(r.averageSeconds,null);
});
test('receipt mismatches cannot inflate loot; aggregates reveal no assignments or player ids',t=>{
 const f=fixture(t);f.extracted('win');const op=f.db.operation('op-win')!;if(op.receipt?.status==='Applied')op.receipt.payload_hash='wrong';f.db.putOperation(op);
 const r=editionRecord(f.world,f.db,'e');assert.equal(r.lootSamples,0);assert.equal(r.averageLoot,null);assert.ok(!JSON.stringify(r).includes('loot-win'));assert.equal('player' in r,false);
 const empty=editionRecord(f.world,f.db,'empty');assert.equal(empty.completed,0);assert.equal(empty.medianLoot,null);
});
