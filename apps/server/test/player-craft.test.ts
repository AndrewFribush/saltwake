import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Craft} from '../src/craft';
import {Store} from '../src/db';
import {Outbox,type Chain} from '../src/outbox';
import {playerOperationId} from '../../../packages/shared/src/player-identity';
import type {CraftBatch,EconomySnapshot} from '../../../packages/shared/src/types';
const account='alice.local',profile='wallet:'+account,ids=['h1','h2','f1','f2'];
function fixture(){const dir=mkdtempSync(join(tmpdir(),'wallet-craft-'));let db=new Store(join(dir,'db')),now=1000;const chain={} as Chain;let box=new Outbox(db,chain),craft=new Craft(db,box,()=>now);return {get db(){return db},get box(){return box},get craft(){return craft},time(n:number){now=n},restart(){db.close();db=new Store(join(dir,'db'));box=new Outbox(db,chain);craft=new Craft(db,box,()=>now)},close(){db.close();rmSync(dir,{recursive:true,force:true})}};}
function snapshot(batch:CraftBatch):EconomySnapshot{return {batches:[batch],items:ids.map((id,i)=>({id,item_type:i<2?'herb':'flask',location:{kind:'crafting',batch:batch.id,source_owner:batch.recovery?'bank':profile}}))} as EconomySnapshot;}
function external():CraftBatch{return {id:playerOperationId(account,'external'),actor:profile,input_ids:ids,challenge_commitment:'ab'.repeat(32),deadline_ms:'121000',recovery:true,wage_reserved:'2',status:'active',tier:null,reason:null,output_ids:[]};}

test('prepared player batch persists exact challenge, adopts chain deadline and finishes with bounded operation IDs',()=>{
 const f=fixture();try{
  const view=f.craft.beginPlayer(account,'prepare',ids,true),op=f.db.operation(view.beginOp)!;
  assert.equal(view.deadlineMs,0);assert.equal(op.authority,'player');assert.equal(op.command.action.type,'begin_recovery');
  if(op.command.action.type!=='begin_recovery')throw Error('type');
  assert.equal(op.command.action.deadline_ms,'0');
  const batch={...external(),id:view.id,challenge_commitment:op.command.action.challenge_commitment,deadline_ms:'151000'};
  f.craft.materialize(snapshot(batch));assert.equal(f.craft.view(profile)?.status,'pending');
  op.status='Applied';f.db.putOperation(op);f.craft.materialize(snapshot(batch));assert.equal(f.craft.view(profile)?.deadlineMs,151000);
  f.restart();assert.deepEqual(f.craft.beginPlayer(account,'prepare',ids,true),f.craft.view(profile));
  assert.throws(()=>f.craft.beginPlayer(account,'prepare',[...ids].reverse(),true),/conflict/);
  for(let step=0;step<3;step++){const v=f.craft.view(profile)!;f.time(2000+step*2000);f.craft.startStep(profile,v.id,'s'+step,v.seq,step);f.time(2000+step*2000+v.target.startMs);f.craft.input(profile,v.id,'i'+step,v.seq+1,step);}
  const finished=f.craft.view(profile)!;assert.equal(finished.status,'finishing');assert.equal(finished.tier,'fine');assert.equal(finished.finishOp?.length,64);
  const terminal=f.db.operation(finished.finishOp!)!;assert.equal(terminal.command.action.type,'finish_recovery');assert.equal(terminal.authority,undefined);
 }finally{f.close();}
});

test('unknown direct batch recovers only through normal expiry and survives restart without fabricated challenge or admission',()=>{
 const f=fixture();try{
  const b=external(),world=snapshot(b);f.craft.discoverPlayerBatches(world);assert.equal(f.db.operations().length,0);
  assert.equal(f.craft.view(profile)?.challengeAvailable,false);assert.throws(()=>f.craft.startStep(profile,b.id,'fake',0,0),/unavailable/);
  f.restart();f.craft.discoverPlayerBatches(world);f.time(120999);f.craft.expire();assert.equal(f.db.operations().length,0);
  f.time(121000);f.craft.expire();const v=f.craft.view(profile)!;assert.equal(v.tier,'normal');assert.equal(v.reason,'expired');assert.equal(v.finishOp?.length,64);
  f.craft.expire();assert.equal(f.db.operations().length,1);
  const op=f.db.operation(v.finishOp!)!;op.status='Rejected';op.receipt={status:'Rejected',op_id:op.id,payload_hash:op.hash,result:'PrematureExpiry',run:null};f.db.putOperation(op);
  f.craft.retryExpiry(121000);assert.equal(f.db.operations().length,2);assert.equal(f.craft.view(profile)?.finishOp?.length,64);f.craft.retryExpiry(121000);assert.equal(f.db.operations().length,2);
 }finally{f.close();}
});

test('discovery validates ownership and terminal observations prevent stale resurrection',()=>{
 const f=fixture();try{
  const b=external(),world=snapshot(b),bad=structuredClone(world);bad.items[0].location={kind:'owned',profile:'someone'};
  assert.throws(()=>f.craft.discoverPlayerBatches(bad),/ownership/);assert.equal(f.craft.view(profile),null);
  f.craft.discoverPlayerBatches(world);const final={...b,status:'finished' as const,tier:'normal' as const,reason:'expired' as const,output_ids:['o1','o2']};
  f.craft.discoverPlayerBatches(snapshot(final));f.restart();f.craft.discoverPlayerBatches(world);f.time(200000);f.craft.expire();assert.equal(f.craft.view(profile)?.status,'finished');assert.equal(f.db.operations().length,0);
 }finally{f.close();}
 const g=fixture();try{const b=external();g.craft.discoverPlayerBatches(snapshot({...b,status:'finished',tier:'normal',reason:'expired'}));g.craft.discoverPlayerBatches(snapshot(b));assert.equal(g.craft.view(profile),null);}finally{g.close();}
});

test('discovered crafting reserves terminal capacity and interrupted terminal import rolls back atomically',()=>{
 const f=fixture();try{
  const b=external();f.craft.discoverPlayerBatches(snapshot(b));
  for(let i=0;i<255;i++){const op=f.box.enqueue('fill'+i,{actor:'maker',action:{type:'debit',amount:'0'}});op.status='Rejected';f.db.putOperation(op);}
  assert.throws(()=>f.box.enqueue('overflow',{actor:'maker',action:{type:'debit',amount:'0'}}),/capacity/);
  const original=f.db.put.bind(f.db);f.db.put=(kind,id,value)=>{if(kind==='craft'&&(value as any).finished)throw Error('interrupted');original(kind,id,value);};
  assert.throws(()=>f.craft.discoverPlayerBatches(snapshot({...b,status:'finished',tier:'normal',reason:'expired'})),/interrupted/);
  f.db.put=original;assert.equal(f.db.get('craft-terminal-seen',b.id),undefined);assert.equal(f.craft.view(profile)?.status,'active');
  f.craft.expire(121000);assert.equal(f.db.operations().length,256);assert.equal(f.craft.view(profile)?.status,'finishing');
 }finally{f.close();}
});

test('direct changed submission supersedes local preparation without inventing minigame evidence',()=>{
 const f=fixture();try{
  const v=f.craft.beginPlayer(account,'external',ids,true),op=f.db.operation(v.beginOp)!;
  assert.notEqual((op.command.action as any).challenge_commitment,external().challenge_commitment);
  f.craft.discoverPlayerBatches(snapshot(external()));assert.ok(f.db.get('craft-conflicting-preparation',v.id));
  assert.equal(f.craft.view(profile)?.challengeAvailable,false);assert.equal(f.craft.view(profile)?.status,'active');
  f.craft.materialize(snapshot(external()));f.craft.expire(121000);assert.equal(f.craft.view(profile)?.tier,'normal');
  f.craft.discoverPlayerBatches(snapshot({...external(),status:'finished',tier:'normal',reason:'expired'}));assert.equal(f.craft.view(profile)?.status,'finished');
 }finally{f.close();}
});

test('already full ordinary queue still admits a confirmed discovered batch terminal',()=>{
 const f=fixture();try{
  for(let i=0;i<256;i++){const op=f.box.enqueue('old'+i,{actor:'maker',action:{type:'debit',amount:'0'}});op.status='Rejected';f.db.putOperation(op);}
  f.craft.discoverPlayerBatches(snapshot(external()));f.craft.expire(121000);
  assert.equal(f.db.operations().length,257);assert.equal(f.craft.view(profile)?.status,'finishing');
  assert.throws(()=>f.box.enqueue('ordinary',{actor:'maker',action:{type:'debit',amount:'0'}}),/capacity/);
 }finally{f.close();}
});

test('discovery emergency settlement cannot consume a prepared batch terminal reservation',()=>{
 const f=fixture();try{
  const v=f.craft.beginPlayer(account,'prepare',ids,true),op=f.db.operation(v.beginOp)!;
  const b={...external(),id:v.id,challenge_commitment:(op.command.action as any).challenge_commitment};
  f.craft.discoverPlayerBatches(snapshot(b));
  for(let i=0;i<254;i++){const row=f.box.enqueue('fill'+i,{actor:'maker',action:{type:'debit',amount:'0'}});row.status='Rejected';f.db.putOperation(row);}
  const direct={...external(),id:playerOperationId('bob.local','external'),actor:'wallet:bob.local'};
  f.craft.discoverPlayerBatches(snapshot(direct));
  f.box.enqueue('external-finish',{actor:direct.actor,action:{type:'finish_recovery',batch_id:direct.id,tier:'normal',reason:'expired'}});
  f.craft.expire(121000);assert.equal(f.craft.view(profile)?.status,'finishing');
  assert.throws(()=>f.box.enqueue('wrong-kind',{actor:profile,action:{type:'finish_craft',batch_id:b.id,tier:'normal',reason:'expired'}}),/capacity/);
 }finally{f.close();}
});
