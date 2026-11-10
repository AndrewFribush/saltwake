import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {KeyPairSigner,type KeyPairString} from 'near-api-js';
import {fixture,terms} from '../../../tests/contract/helpers';
import {Store} from '../src/db';
import {Outbox} from '../src/outbox';
import {Runs} from '../src/runs';
import {NearChain} from '../src/chain';
import type {Command} from '../../../packages/shared/src/types';
test('real WASM admission survives broadcast-response crash and restart without a second fee', {timeout:60000},async()=>{
 const f=await fixture();const dir=mkdtempSync(join(tmpdir(),'outbox-sandbox-'));let db=new Store(join(dir,'db'));
 try{
 const chain=new NearChain(f.provider,KeyPairSigner.fromSecretKey(f.genesis.privateKey as KeyPairString),f.contractId,f.contractId);
 const box=new Outbox(db,chain);const now=Number(await f.view('clock_ms'));
 box.enqueue('publish',{actor:'maker',action:{type:'publish',terms:terms(now),fee:'2',funding:['maker-sword-0','maker-tonic-0','maker-tonic-1']}});
 const published=await box.process('publish');assert.equal(published.status,'Applied',published.reason);
 const command:Command={actor:'buyer',action:{type:'admit',edition_id:'edition-0',expected_version:'1',expected_fee:'2',loadout_ids:['buyer-club'],seed:'42'}};
 const edition=(await f.view('snapshot')).editions[0];if(command.action.type==='admit')(command.action as any).edition_id=edition.id;
 const row=box.enqueue('admit',command);row.signed=await chain.sign('admit',command);db.putOperation(row);
 await chain.broadcast(row.signed); // Process disappears here, before storing the successful response.
 db.close();db=new Store(join(dir,'db'));const recovered=new Outbox(db,chain);
 const result=await recovered.process('admit');assert.equal(result.status,'Applied',result.reason);assert.equal(result.receipt?.status,'Applied');
 await recovered.process('admit');const state=await f.view('snapshot');assert.equal(state.credits.buyer,'8');assert.equal(state.runs.length,1);assert.equal(state.runs[0].seed,'42');
 assert.throws(()=>recovered.enqueue('admit',{actor:'p2',action:command.action}),/conflict/);
 const runs=new Runs(db,recovered);runs.materialize('admit',await f.view('snapshot'));
 for(let i=0;i<5;i++)runs.action('run-0','buyer','wait-'+i,i,{type:'wait'});
 const terminal=db.operation('terminal-run-0')!;assert.ok(terminal);terminal.signed=await chain.sign(terminal.id,terminal.command);db.putOperation(terminal);await chain.broadcast(terminal.signed);
 db.close();db=new Store(join(dir,'db'));const finalBox=new Outbox(db,chain);assert.equal((await finalBox.process(terminal.id)).status,'Applied');await finalBox.process(terminal.id);assert.equal((await f.view('snapshot')).credits.maker,'91');assert.equal((await f.view('snapshot')).runs[0].status,'died');

 }finally{db.close();rmSync(dir,{recursive:true,force:true});await f.sandbox.tearDown();}
});
