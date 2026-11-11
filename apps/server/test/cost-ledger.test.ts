import {Outbox,type Chain} from '../src/outbox';
import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {advanceCosts,unknownCosts,CostJournal,costReport,editionCostReport} from '../src/cost-ledger';import {Store,type StoredOperation} from '../src/db';import {commandHash} from '../../../packages/shared/src/protocol';import type {EconomySnapshot,Command,Item} from '../../../packages/shared/src/types';
const item=(id:string,owner?:string):Item=>({id,item_type:'herb',location:owner?{kind:'owned',profile:owner}:{kind:'bank'}});
const world=(items:Item[]):EconomySnapshot=>({items,listings:[],batches:[],editions:[],runs:[],credits:{},bank:'0',bank_prices:[],npc_order:{} as any,recovery:{} as any});
const operation=(id:string,action:Command['action'],actor='maker'):StoredOperation=>{const command={actor,action},hash=commandHash(command);return {id,command,hash,status:'Applied',receipt:{status:'Applied',op_id:id,payload_hash:hash,result:'unused',run:null}};};
test('purchases establish exact basis and resale transfers basis once',()=>{const a=world([item('x')]),b=world([item('x','maker')]);const bought=advanceCosts(unknownCosts(a),a,b,operation('purchase',{type:'bank_buy',item_ids:['x'],expected_unit_prices:['7']}));assert.equal(bought.state.lots.x.cost,'7');const c=world([item('x','buyer')]);const sold=advanceCosts(bought.state,b,c,operation('sale',{type:'buy',listing_id:'l',item_ids:['x'],expected_unit_price:'11'},'buyer'));assert.deepEqual(sold.disposals,[{itemId:'x',owner:'maker',cost:'7',reason:'sale',proceeds:'11'}]);assert.equal(sold.state.lots.x.cost,'11');});
test('craft preserves integer total and propagates any unknown input',()=>{const a=world(['a','b','c','d'].map(id=>item(id,'maker'))),state=unknownCosts(a);['1','2','3','3'].forEach((n,i)=>state.lots[['a','b','c','d'][i]].cost=n);const b=world(['a','b','c','d'].map<Item>(id=>({...item(id),location:{kind:'consumed',operation:'finish'} as const})).concat([item('output-1','maker'),item('output-0','maker')]));b.batches=[{id:'batch',input_ids:['a','b','c','d'],output_ids:['output-1','output-0'],actor:'maker',recovery:false,status:'finished'} as any];const op=operation('finish',{type:'finish_craft',batch_id:'batch',tier:'fine',reason:'completed'});const r=advanceCosts(state,a,b,op);assert.equal(r.state.lots['output-0'].cost,'5');assert.equal(r.state.lots['output-1'].cost,'4');assert.equal(r.disposals.length,0);state.lots.a.cost=null;const partial=advanceCosts(state,a,b,op);assert.equal(partial.state.lots['output-0'].cost,null);assert.equal(partial.state.lots['output-1'].cost,null);});
test('funding expenses goods once and an ownership gap invalidates basis',()=>{const a=world([item('x','maker')]),state=unknownCosts(a);state.lots.x.cost='9';const b=world([{...item('x'),location:{kind:'edition_fixed',edition:'e',item_type:'herb'}}]);const op=operation('refresh',{type:'refresh',edition_id:'e',fixed_funding:['x'],random_funding:[]});const r=advanceCosts(state,a,b,op);assert.equal(r.disposals[0].cost,'9');assert.equal(r.state.lots.x,undefined);const unexpected=world([item('x','outsider')]);const lost=advanceCosts(state,a,unexpected,op);assert.equal(lost.state.gaps,1);assert.equal(lost.state.lots.x.cost,null);assert.equal(lost.disposals.length,0);});
test('town losses remove basis; extracted goods do not acquire an invented zero basis',()=>{const a=world([item('gear','maker'),item('loot')]),state=unknownCosts(a);state.lots.gear.cost='4';const b=world([item('gear'),item('loot','maker')]);b.runs=[{id:'run',player:'maker'} as any];const r=advanceCosts(state,a,b,operation('settle',{type:'settle',run_id:'run',outcome:'extracted',carried_dungeon_ids:['loot'],disposition:{town_consumed:[],town_returned:[],town_forfeited:['gear'],dungeon_consumed:[],dungeon_extracted:['loot'],dungeon_returned:[]}}));assert.equal(r.disposals[0].cost,'4');assert.equal(r.state.lots.loot.cost,null);});
test('journal survives restart after broadcast and duplicate confirmation without repeating costs',async()=>{const dir=mkdtempSync(join(tmpdir(),'cost-journal-'));let db=new Store(join(dir,'db'));let w=world([item('x')]);const op=operation('purchase',{type:'bank_buy',item_ids:['x'],expected_unit_prices:['7']});try{await new CostJournal(db,async()=>w).before(op);db.close();db=new Store(join(dir,'db'));w=world([item('x','maker')]);const journal=new CostJournal(db,async()=>w);await journal.after(op);await journal.after(op);const report=costReport(db,w,'maker');assert.equal(report.knownOwnedCost,'7');assert.equal(report.trackedOperations,1);db.close();db=new Store(join(dir,'db'));assert.deepEqual(costReport(db,w,'maker'),report);}finally{db.close();rmSync(dir,{recursive:true,force:true});}});
test('old applied receipts without a captured baseline stay unknown',async()=>{const dir=mkdtempSync(join(tmpdir(),'cost-old-')),db=new Store(join(dir,'db')),w=world([item('x','maker')]);try{await new CostJournal(db,async()=>w).after(operation('purchase',{type:'bank_buy',item_ids:['x'],expected_unit_prices:['7']}));assert.equal(costReport(db,w,'maker').unknownOwnedItems,1);assert.equal(costReport(db,w,'maker').gaps,1);}finally{db.close();rmSync(dir,{recursive:true,force:true});}});

test('outbox recovers a confirmed operation whose accounting write was interrupted',async()=>{const dir=mkdtempSync(join(tmpdir(),'cost-recover-'));let db=new Store(join(dir,'db'));let w=world([item('x')]),broadcasts=0;const op=operation('purchase',{type:'bank_buy',item_ids:['x'],expected_unit_prices:['7']});const chain:Chain={async sign(){return {hash:'tx',bytes:'bytes'};},async broadcast(){broadcasts++;w=world([item('x','maker')]);},async receipt(){return broadcasts?op.receipt!:null;}};try{const journal=new CostJournal(db,async()=>w),box=new Outbox(db,chain,{before:r=>journal.before(r),async after(){throw Error('interrupted accounting write');}});box.enqueue(op.id,op.command);assert.equal((await box.process(op.id)).status,'Applied');assert.equal(db.all('cost-journal').length,0);db.close();db=new Store(join(dir,'db'));await new Outbox(db,chain,new CostJournal(db,async()=>w)).recover();assert.equal(costReport(db,w,'maker').knownOwnedCost,'7');assert.equal(broadcasts,1);}finally{db.close();rmSync(dir,{recursive:true,force:true});}});
test('unobserved historic funding is unknown and never silently counted as free',()=>{const dir=mkdtempSync(join(tmpdir(),'cost-funding-')),db=new Store(join(dir,'db'));const w=world([]);w.editions=[{maker:'maker',funded_ids:['a','b'],refresh_ids:['c']} as any];try{assert.equal(costReport(db,w,'maker').unknownFundedItems,3);assert.equal(costReport(db,w,'maker').fundingCost,'0');}finally{db.close();rmSync(dir,{recursive:true,force:true});}});

test('edition contribution excludes pending and void fees and refuses unknown committed costs',()=>{const dir=mkdtempSync(join(tmpdir(),'cost-edition-')),db=new Store(join(dir,'db')),w=world([]);w.editions=[{id:'e',maker:'maker',funded_ids:['x'],refresh_ids:[],placement_paid:'2'} as any];w.runs=['active','void','extracted','died'].map((status,i)=>({id:'r'+i,edition:'e',status,fee:'3'})) as any;try{const missing=editionCostReport(db,w,'e');assert.equal(missing.contribution,null);assert.equal(missing.pendingFees,'3');assert.equal(missing.settledFees,'6');db.put('cost-journal','fund',{operation:'fund',state:unknownCosts(w),disposals:[{editionId:'e',itemId:'x',owner:'maker',reason:'funding',cost:'5',proceeds:null}]});const known=editionCostReport(db,w,'e');assert.equal(known.contribution,'-1');w.editions[0].closed=true;assert.deepEqual(editionCostReport(db,w,'e'),known);}finally{db.close();rmSync(dir,{recursive:true,force:true});}});

for(const savedSaleCapture of [false,true])for(const laterObservation of [false,true]){
 test(`failed sale/repurchase observations cannot revive basis (capture=${savedSaleCapture}, later=${laterObservation})`,async()=>{
  const dir=mkdtempSync(join(tmpdir(),'cost-round-trip-'));let db=new Store(join(dir,'db'));
  let w=world([item('x','maker')]),unavailable=false,failAfter=true,broadcasts=0;
  const confirmed=new Set<string>();
  const snapshot=async()=>{if(unavailable)throw Error('Accounting snapshot unavailable');return w;};
  const chain:Chain={
   async sign(id){return {hash:id,bytes:id};},
   async broadcast(tx){
    broadcasts++;confirmed.add(tx.hash);
    if(tx.hash==='sell')w=world([item('x')]);
    if(tx.hash==='repurchase')w=world([item('x','maker')]);
    if(tx.hash==='fund')w=world([{...item('x'),location:{kind:'edition_fixed',edition:'e',item_type:'herb'}}]);
    unavailable=failAfter;
   },
   async receipt(id){const op=db.operation(id)!;return confirmed.has(id)?{status:'Applied',op_id:id,payload_hash:op.hash,result:id,run:null}:null;}
  };
  try{
   const state=unknownCosts(w);state.lots.x.cost='4';db.put('cost-state','current',state);
   let box=new Outbox(db,chain,new CostJournal(db,snapshot));
   box.enqueue('sell',{actor:'maker',action:{type:'bank_sell',item_ids:['x'],expected_unit_prices:['1']}});
   unavailable=!savedSaleCapture;
   assert.equal((await box.process('sell')).status,'Applied');
   assert.equal(!!db.get('cost-before','sell'),savedSaleCapture);
   box.enqueue('repurchase',{actor:'maker',action:{type:'bank_buy',item_ids:['x'],expected_unit_prices:['2']}});
   assert.equal((await box.process('repurchase')).status,'Applied');
   assert.equal(db.get('cost-before','repurchase'),undefined);
   assert.equal(db.all('cost-journal').length,0);
   const checkUnknown=()=>{
    const report=costReport(db,w,'maker');
    assert.equal(report.knownOwnedCost,'0');assert.equal(report.unknownOwnedItems,1);assert.ok(report.gaps>0);
   };
   checkUnknown();
   db.close();db=new Store(join(dir,'db'));checkUnknown();
   unavailable=false;failAfter=false;box=new Outbox(db,chain,new CostJournal(db,snapshot));
   if(laterObservation){
    box.enqueue('later',{actor:'maker',action:{type:'set_fee',edition_id:'e',new_fee:'1'}});
    assert.equal((await box.process('later')).status,'Applied');
    checkUnknown();
   }
   const sent=broadcasts;
   await box.recover();checkUnknown();
   assert.equal(broadcasts,sent,'accounting recovery must not rebroadcast');
   assert.ok(db.get('cost-journal','sell'));assert.ok(db.get('cost-journal','repurchase'));
   const recovered=costReport(db,w,'maker');await box.recover();
   assert.deepEqual(costReport(db,w,'maker'),recovered);
   box.enqueue('fund',{actor:'maker',action:{type:'refresh',edition_id:'e',fixed_funding:['x'],random_funding:[]}});
   assert.equal((await box.process('fund')).status,'Applied');
   const funded=costReport(db,w,'maker');assert.equal(funded.fundingCost,'0');assert.equal(funded.unknownFundedItems,1);
  }finally{db.close();rmSync(dir,{recursive:true,force:true});}
 });
}
test('timed-out cost observations cannot commit after their snapshot eventually returns',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cost-cancel-')),db=new Store(join(dir,'db'));const op=operation('purchase',{type:'bank_buy',item_ids:['x'],expected_unit_prices:['7']});
 try{for(const phase of ['before','after'] as const){let release!:(w:EconomySnapshot)=>void;const snapshot=new Promise<EconomySnapshot>(r=>release=r),journal=new CostJournal(db,()=>snapshot),controller=new AbortController(),pending=journal[phase](op,controller.signal);controller.abort();release(world([item('x','maker')]));await pending;}
 assert.equal(db.all('cost-before').length,0);assert.equal(db.all('cost-journal').length,0);assert.equal(db.all('cost-state').length,0);
 await new CostJournal(db,async()=>world([item('x','maker')])).after(op);assert.equal(costReport(db,world([item('x','maker')]),'maker').unknownOwnedItems,1);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
