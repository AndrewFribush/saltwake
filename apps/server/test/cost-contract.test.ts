import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {KeyPairSigner,type KeyPairString} from 'near-api-js';import {terms} from '../../../tests/contract/helpers';import {extendedFixture} from '../../../tests/contract/extended-fixture';import {Store} from '../src/db';import {Outbox} from '../src/outbox';import {NearChain} from '../src/chain';import {CostJournal,costReport,editionCostReport} from '../src/cost-ledger';import type {Command,EconomySnapshot} from '../../../packages/shared/src/types';
test('real contract purchase → craft → resale → funding retains cost and restart idempotency',{timeout:120000},async()=>{
 const f=await extendedFixture(),dir=mkdtempSync(join(tmpdir(),'cost-contract-'));let db=new Store(join(dir,'db'));const snapshot=()=>f.view('snapshot') as Promise<EconomySnapshot>;const chain=new NearChain(f.provider,KeyPairSigner.fromSecretKey(f.genesis.privateKey as KeyPairString),f.contractId,f.contractId);let box=new Outbox(db,chain,new CostJournal(db,snapshot));
 const apply=async(id:string,action:Command['action'],actor='maker')=>{box.enqueue(id,{actor,action});const r=await box.process(id);assert.equal(r.status,'Applied',JSON.stringify(r.receipt));return r;};
 try{
 let w=await snapshot();const inputs=['herb','flask'].flatMap(type=>w.items.filter(i=>i.item_type===type&&i.location.kind==='bank').slice(0,2).map(i=>i.id));assert.equal(inputs.length,4);
 await apply('procure',{type:'bank_buy',item_ids:inputs,expected_unit_prices:['2','2','2','2']});
 await apply('begin',{type:'begin_craft',batch_id:'cost-batch',input_ids:inputs,challenge_commitment:'0'.repeat(64),deadline_ms:String(await chain.clock()+120000)});
 await apply('finish',{type:'finish_craft',batch_id:'cost-batch',tier:'fine',reason:'completed'});
 await apply('list',{type:'list',item_ids:['crafted-cost-batch-0'],unit_price:'7'});
 await apply('purchase',{type:'buy',listing_id:'listing-0',item_ids:['crafted-cost-batch-0'],expected_unit_price:'7'},'buyer');
 const t={...terms(await chain.clock()),sockets:[{id:'reward',room:0,slot:0,enemy:'none' as const,trap:false,reward:'fineTonic' as const}]};
 await apply('fund',{type:'publish',terms:t,fee:'1',funding:['crafted-cost-batch-1']});
 w=await snapshot();const report=costReport(db,w,'maker');assert.equal(report.matchedSaleCost,'4');assert.equal(report.saleProceeds,'7');assert.equal(report.recordedSaleContribution,'3');assert.equal(report.fundingCost,'4');assert.equal(report.unknownFundedItems,0);assert.equal(report.gaps,0);const editionAccount=editionCostReport(db,w,'edition-0');assert.equal(editionAccount.knownTreasureCost,'4');assert.equal(editionAccount.unknownTreasureItems,0);assert.equal(editionAccount.contribution,String(-4-Number(editionAccount.placementCost)));assert.equal(editionAccount.pendingFees,'0');assert.equal(costReport(db,w,'buyer').knownOwnedCost,'7');
 db.close();db=new Store(join(dir,'db'));box=new Outbox(db,chain,new CostJournal(db,snapshot));await box.process('fund');assert.deepEqual(costReport(db,await snapshot(),'maker'),report);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});await f.close();}
});
