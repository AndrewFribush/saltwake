import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {KeyPairSigner,type KeyPairString} from 'near-api-js';
import {fixture,terms} from '../../../tests/contract/helpers';import {Store} from '../src/db';import {Outbox} from '../src/outbox';import {NearChain} from '../src/chain';import {Runs} from '../src/runs';import {encodeCustomModule} from '../../../packages/shared/src/custom-layout';import {playerProfile} from '../../../packages/shared/src/player-identity';

for(const discoverLate of [false,true])test(`player-signed admission ${discoverLate?'discovered after chain confirmation':'prepared before wallet handoff'} recovers and settles through limited oracle`,{timeout:120000},async()=>{
 const f=await fixture(),dir=mkdtempSync(join(tmpdir(),'player-recovery-'));let db=new Store(join(dir,'db'));const chain=new NearChain(f.provider,KeyPairSigner.fromSecretKey(f.genesis.privateKey as KeyPairString),f.contractId,f.contractId);
 let operatorSigns=0;const originalSign=chain.sign.bind(chain);chain.sign=async(...args)=>{operatorSigns++;return originalSign(...args);};
 const account=f.outsider.accountId,profile=playerProfile(account),requestId='admit-through-wallet',module=encodeCustomModule({tiles:['#####','#...#','#...#','#...#','#####'],spawn:{x:1,y:1},exit:{x:2,y:1},sockets:[],tuning:[],devices:[],exit_rule:{extract:true,require_clear:false}},'missions');
 try{
  await f.outsider.callFunction({contractId:f.contractId,methodName:'register_player',args:{},gas:30000000000000n,waitUntil:'FINAL'});
  const t={...terms(Number(await f.view('clock_ms'))),rules_version:11,modules:[module],sockets:[],no_reward:true};
  const pub=await f.apply('maker-publish',{actor:'maker',action:{type:'publish',terms:t,fee:'0',funding:[]}});assert.equal(pub.status,'Applied');
  const action={type:'admit' as const,edition_id:pub.result,expected_version:'1',expected_fee:'0',loadout_ids:[],seed:'0'};
  let box=new Outbox(db,chain);if(!discoverLate){const prepared=box.enqueuePlayer(account,requestId,action);await box.process(prepared.id);assert.equal(operatorSigns,0);assert.equal(db.operation(prepared.id)?.status,'Unknown');}
  const receipt=await f.outsider.callFunction<any>({contractId:f.contractId,methodName:'execute_player',args:{request_id:requestId,action},gas:100000000000000n,waitUntil:'FINAL'});assert.equal(receipt.status,'Applied');
  // Simulate closing the browser before it confirms, and a server process restart.
  db.close();db=new Store(join(dir,'db'));box=new Outbox(db,chain);const pending=box.enqueuePlayer(account,requestId,action);await box.recover();assert.equal(operatorSigns,0);assert.equal(db.operation(pending.id)?.status,'Applied');
  const runs=new Runs(db,box),world=await f.view('snapshot'),run=runs.materialize(pending.id,world);
  assert.equal(run.profile,profile);assert.equal(run.economic.seed,receipt.run.seed);assert.throws(()=>runs.get(run.id,'buyer'),/owner mismatch/);
  assert.equal(runs.materialize(pending.id,world).id,run.id);assert.equal(db.all('run').length,1);
  runs.action(run.id,profile,'step',0,{type:'move',x:2,y:1});runs.action(run.id,profile,'exit',1,{type:'extract'});await box.recover();
  assert.equal(operatorSigns,1,'only the final oracle settlement is operator-signed');
  const after=await f.view('snapshot');assert.equal(after.runs[0].status,'extracted');assert.equal(after.runs[0].player,profile);
  await box.recover();assert.equal(operatorSigns,1);assert.equal(after.credits[profile],'0','login and admission do not create money');
 }finally{db.close();rmSync(dir,{recursive:true,force:true});await f.sandbox.tearDown();}
});
