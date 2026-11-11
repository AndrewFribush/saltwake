import test from 'node:test';
import assert from 'node:assert/strict';
import {extendedFixture,inputs,commitment} from './extended-fixture';
import {terms} from './helpers';
import {catalog} from '../../packages/shared/src/catalog';
import type {Command,Partition} from '../../packages/shared/src/types';

const empty=():Partition=>({town_consumed:[],town_returned:[],town_forfeited:[],dungeon_consumed:[],dungeon_returned:[],dungeon_extracted:[]});
const value=(items:any[])=>items.reduce((n,i)=>n+BigInt(catalog[i.item_type as keyof typeof catalog].value),0n);
const item=(s:any,id:string)=>s.items.find((i:any)=>i.id===id);

// Fixed, explicitly seeded population. Every mutation uses the actual WASM;
// no simulated earnings, injected balances, replenishment, or runtime database.
async function scenario(){
 const f=await extendedFixture(),initial=await f.view();
 const initialTypes=new Map<string,string>(initial.items.map((i:any)=>[i.id,i.item_type]));
 const coinTotal=(s:any)=>Object.values(s.credits).reduce<bigint>((n,v)=>n+BigInt(v as string),BigInt(s.bank)+BigInt(s.npc_order.budget)+BigInt(s.recovery.budget))
  +s.runs.filter((r:any)=>r.status==='active').reduce((n:bigint,r:any)=>n+BigInt(r.fee),0n)
  +s.batches.reduce((n:bigint,b:any)=>n+BigInt(b.wage_reserved),0n);
 const audit=async()=>{
  const s=await f.view(),byId=new Map<string,any>(s.items.map((i:any)=>[i.id,i]));
  assert.deepEqual(Object.keys(s.credits).sort(),Object.keys(initial.credits).sort(),'no new profiles');
  assert.equal(coinTotal(s),coinTotal(initial),'coins include both finite subsidy budgets, reserved wages and run escrow');
  assert.equal(coinTotal(s),176n);
  assert.equal(byId.size,s.items.length,'unique goods instances');
  const outputs=s.batches.flatMap((b:any)=>b.output_ids);
  assert.deepEqual([...byId.keys()].sort(),[...initialTypes.keys(),...outputs].sort(),'only recorded recipe outputs may add instances; consumed goods remain recorded');
  for(const [id,type] of initialTypes)assert.equal(byId.get(id)?.item_type,type);
  const usedInputs=new Set<string>();
  for(const b of s.batches){
   assert.equal(b.input_ids.length,4);
   for(const id of b.input_ids){assert.ok(!usedInputs.has(id),'input used by at most one batch');usedInputs.add(id);assert.equal(byId.get(id)?.location.kind,b.status==='active'?'crafting':'consumed');}
   assert.equal(b.output_ids.length,b.status==='active'?0:2);
   for(const id of b.output_ids)assert.equal(byId.get(id)?.item_type,b.tier==='fine'?'fineTonic':'tonic');
  }
  for(const e of s.editions){
   const active=s.runs.filter((r:any)=>r.edition===e.id&&r.status==='active');
   assert.deepEqual([...e.active_runs].sort(),active.map((r:any)=>r.id).sort());
   const runIds=new Set(active.map((r:any)=>r.id));
   const available=s.items.filter((i:any)=>['edition_fixed','edition_random'].includes(i.location.kind)&&i.location.edition===e.id);
   const reserved=s.items.filter((i:any)=>i.location.kind==='reserved'&&runIds.has(i.location.run));
   assert.equal(BigInt(e.original_value)+BigInt(e.refresh_value),value(available)+value(reserved)+BigInt(e.extracted_value)+BigInt(e.consumed_value)+BigInt(e.banked_value),'edition funding reconciles at every step');
   if(e.closed){assert.equal(active.length,0);assert.equal(available.length,0);}
  }
  for(const r of s.runs.filter((r:any)=>r.status==='active')){
   for(const a of r.assignments)assert.deepEqual(byId.get(a.item_id)?.location,{kind:'reserved',run:r.id,socket:a.socket,source_pool:a.source_pool});
   for(const id of r.loadout_ids)assert.deepEqual(byId.get(id)?.location,{kind:'loadout',run:r.id,profile:r.player});
  }
  return s;
 };
 const apply=async(id:string,c:Command)=>{const r=await f.apply(id,c);assert.equal(r.status,'Applied',`${id}: ${r.result}`);await audit();return r;};
 const reject=async(id:string,c:Command,reason:string)=>{const before=await audit(),r=await f.apply(id,c);assert.equal(r.status,'Rejected',id);assert.equal(r.result,reason,id);assert.deepEqual(await audit(),before,'rejection changes no economic state');};
 const replay=async(id:string,c:Command,r:any)=>{const before=await audit();assert.deepEqual(await f.apply(id,c),r);assert.deepEqual(await audit(),before);};
 return {...f,initial,audit,apply,reject,replay};
}
const admission=(edition_id:string,actor='buyer',fee='2',loadout_ids:string[]=[]):Command=>({actor,action:{type:'admit',edition_id,expected_version:'1',expected_fee:fee,loadout_ids,seed:'17'}});
const close=(edition_id:string):Command=>({actor:'maker',action:{type:'finalize_close',edition_id}});
const fixedTerms=(now:number,rewards:('sword'|'tonic'|'fineTonic')[])=>({...terms(now),closes_at_ms:String(now+600000),sockets:rewards.map((reward,slot)=>({id:'reward-'+slot,room:0,slot,enemy:'none' as const,trap:false,reward})),no_reward:rewards.length===0});

test('S17 absent demand: finite NPC materials become unsold stock; time and closure do not refund the maker',{timeout:180000},async()=>{
 const f=await scenario();try{
  const materials=f.initial.items.filter((i:any)=>i.location.kind==='bank').map((i:any)=>i.id);
  assert.equal(materials.length,16);
  await f.apply('procure',{actor:'maker',action:{type:'bank_buy',item_ids:materials,expected_unit_prices:materials.map(()=>'2')}});
  let s=await f.audit();assert.equal(s.credits.maker,'68');assert.equal(s.bank,'32');
  await f.reject('no-stock',{actor:'buyer',action:{type:'bank_buy',item_ids:[materials[0]],expected_unit_prices:['2']}},'ItemUnavailable');
  const outputIds:string[]=[];
  for(let i=0;i<4;i++){
   const id='absent-'+i,deadline_ms=String(BigInt(await f.view('clock_ms'))+600000n);
   await f.apply('begin-'+i,{actor:'maker',action:{type:'begin_craft',batch_id:id,input_ids:inputs('bank',i*2),challenge_commitment:commitment,deadline_ms}});
   const end:Command={actor:'maker',action:{type:'finish_craft',batch_id:id,tier:'fine',reason:'completed'}};
   const r=await f.apply('finish-'+i,end);await f.replay('finish-'+i,end,r);
   outputIds.push(...(await f.audit()).batches.find((b:any)=>b.id===id).output_ids);
  }
  await f.apply('unsold',{actor:'maker',action:{type:'list',item_ids:outputIds.slice(2),unit_price:'5'}});
  const t=fixedTerms(Number(await f.view('clock_ms')),['fineTonic']);
  const published=await f.apply('unvisited',{actor:'maker',action:{type:'publish',terms:t,fee:'3',funding:outputIds.slice(0,2)}});
  const before=await f.audit();assert.equal(before.credits.maker,'65');assert.equal(before.bank,'35');assert.equal(before.runs.length,0);
  // Keep each time-advance RPC small: a 1,000-block request can exceed the
  // sandbox RPC timeout when other local suites are running concurrently.
  for(let step=0;step<100&&BigInt(await f.view('clock_ms'))<BigInt(t.closes_at_ms);step++){
   const response=await fetch(f.sandbox.rpcUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'absent-demand-clock',method:'sandbox_fast_forward',params:{delta_height:100}}),signal:AbortSignal.timeout(30000)});
   assert.equal((await response.json()).error,undefined);
  }
  assert.ok(BigInt(await f.view('clock_ms'))>=BigInt(t.closes_at_ms),'bounded clock advance reaches closure');
  assert.deepEqual(await f.audit(),before,'elapsed time does not invent buyers or replenish materials');
  await f.apply('close',close(published.result));s=await f.audit();
  assert.equal(s.credits.maker,'65','placement/procurement not refunded');assert.equal(s.editions[0].banked_value,'16');
  for(const id of outputIds.slice(0,2))assert.deepEqual(item(s,id).location,{kind:'bank'});
  for(const id of outputIds.slice(2))assert.deepEqual(item(s,id).location,{kind:'listed',listing:'listing-0'});
  for(const id of materials)assert.equal(item(s,id).location.kind,'consumed');
  assert.equal(s.items.length,59,'four explicit recipes issue eight outputs, not coins');
  assert.equal(s.npc_order.budget,'20');assert.equal(s.recovery.budget,'6','no subsidy counted as demand');
  await f.reject('still-no-materials',{actor:'maker',action:{type:'bank_buy',item_ids:[materials[0]],expected_unit_prices:['2']}},'ItemUnavailable');
  await f.apply('cancel-unsold',{actor:'maker',action:{type:'cancel_listing',listing_id:'listing-0'}});
  s=await f.audit();for(const id of outputIds.slice(2))assert.deepEqual(item(s,id).location,{kind:'owned',profile:'maker'});
  assert.equal(s.credits.maker,'65');console.log('Absent demand: 32 procurement + 3 placement paid; 6 unsold outputs; 2 residual outputs banked; zero admissions.');
 }finally{await f.close();}
});

test('S17 support exhaustion: recovery, seeded NPC orders and bank buybacks have separate finite budgets',{timeout:180000},async()=>{
 const f=await scenario();try{
  for(let i=0;i<3;i++){
   const id='support-'+i,deadline_ms=String(BigInt(await f.view('clock_ms'))+60000n);
   await f.apply('reserve-'+i,{actor:'worker',action:{type:'begin_recovery',batch_id:id,bank_input_ids:inputs('bank',i*2),challenge_commitment:commitment,deadline_ms}});
   const locked=await f.audit();assert.equal(locked.credits.worker,String(i*2));assert.equal(locked.recovery.budget,String(4-i*2));assert.equal(locked.batches.find((b:any)=>b.id===id).wage_reserved,'2');
   if(i===2)await f.advance(deadline_ms);
   const c:Command={actor:'worker',action:{type:'finish_recovery',batch_id:id,tier:'fine',reason:i===2?'expired':'completed'}};
   const r=await f.apply('pay-'+i,c);await f.replay('pay-'+i,c,r);await f.reject('pay-twice-'+i,c,'TerminalBatch');
  }
  const begin=(actor:string):Command=>({actor,action:{type:'begin_recovery',batch_id:'unsupported-'+actor,bank_input_ids:inputs('bank',6),challenge_commitment:commitment,deadline_ms:String(BigInt(Date.now())+1n)}});
  // Use contract time for each new quote, including after sandbox fast-forward.
  const blocked=(actor:string,deadline_ms:string):Command=>{const c=begin(actor);return {...c,action:{...c.action,deadline_ms}} as Command;};
  const deadline=String(BigInt(await f.view('clock_ms'))+600000n);
  await f.reject('epoch-cap',blocked('worker',deadline),'RecoveryJobCap');
  await f.reject('no-budget',blocked('worker2',deadline),'RecoveryBudget');
  const order:Command={actor:'maker',action:{type:'fill_npc_order',order_id:'fine-tonic-demo',item_ids:Array.from({length:4},(_,i)=>'maker-fine-tonic-'+i),expected_unit_price:'5'}};
  const paid=await f.apply('seeded-demand',order);await f.replay('seeded-demand',order,paid);
  await f.reject('order-empty',{actor:'maker',action:{type:'fill_npc_order',order_id:'fine-tonic-demo',item_ids:['maker-fine-tonic-4'],expected_unit_price:'5'}},'OrderExhausted');
  await f.reject('bank-has-no-coins',{actor:'maker',action:{type:'bank_sell',item_ids:['maker-fine-tonic-4'],expected_unit_prices:['4']}},'InsufficientBankCredits');
  let s=await f.audit();assert.equal(s.credits.worker,'6');assert.equal(s.credits.maker,'120');assert.equal(s.recovery.budget,'0');assert.equal(s.npc_order.budget,'0');assert.equal(s.bank,'0');
  for(const b of s.batches)for(const id of b.output_ids)assert.deepEqual(item(s,id).location,{kind:'bank'});
  assert.equal(s.batches[2].tier,'normal','expired recovery pays once but cannot preserve requested fine tier');
  await f.apply('recapitalize-bank',{actor:'maker',action:{type:'bank_buy',item_ids:inputs('bank',6),expected_unit_prices:['2','2','2','2']}});
  await f.apply('limited-buyback',{actor:'maker',action:{type:'bank_sell',item_ids:['maker-fine-tonic-4','maker-tonic-0'],expected_unit_prices:['4','3']}});
  await f.reject('buyback-budget-empty',{actor:'maker',action:{type:'bank_sell',item_ids:['maker-tonic-1'],expected_unit_prices:['3']}},'InsufficientBankCredits');
  s=await f.audit();assert.equal(s.bank,'1');assert.equal(s.credits.maker,'119');assert.equal(s.recovery.budget,'0');assert.equal(s.npc_order.remaining,0);
  await f.advance(String(BigInt(await f.view('clock_ms'))+900000n));assert.deepEqual(await f.audit(),s,'elapsed time resets neither support nor buyback budget');
  await f.reject('still-unfunded',blocked('worker2',String(BigInt(await f.view('clock_ms'))+600000n)),'RecoveryBudget');
  console.log('Finite support: 6 wage credits + 20 seeded-order credits transferred, not minted; bank buybacks stop at 1 remaining credit.');
 }finally{await f.close();}
});

test('S17 low extraction: repeated losses drain a fixed customer; void refunds never restore consumed treasure',{timeout:180000},async()=>{
 const f=await scenario();try{
  const t=fixedTerms(Number(await f.view('clock_ms')),['sword','tonic']);
  const p=await f.apply('publish',{actor:'maker',action:{type:'publish',terms:t,fee:'2',funding:['maker-sword-0','maker-tonic-0','maker-tonic-1']}});
  for(let i=0;i<5;i++){
   const r=await f.apply('entry-'+i,admission(p.result,'buyer','2',i===0?['buyer-club']:[]));
   const c:Command={actor:'buyer',action:{type:'settle',run_id:r.result,outcome:i%2?'abandoned':'died',carried_dungeon_ids:[],disposition:{...empty(),town_forfeited:i===0?['buyer-club']:[],dungeon_returned:r.run.assignments.map((a:any)=>a.item_id)}}};
   const ended=await f.apply('loss-'+i,c);await f.replay('loss-'+i,c,ended);
  }
  await f.reject('customer-broke',admission(p.result),'InsufficientCredits');
  let s=await f.audit();assert.equal(s.credits.buyer,'0');assert.equal(s.credits.maker,'106');assert.deepEqual(item(s,'buyer-club').location,{kind:'bank'});
  assert.equal(s.editions[0].extracted_value,'0');assert.equal(s.editions[0].consumed_value,'0');assert.equal(s.runs.length,5,'concurrency is not a four-customer lifetime cap');
  for(let i=0;i<2;i++){
   const r=await f.apply('incident-entry-'+i,admission(p.result,'p2','2',['p2-club']));
   const tonic=r.run.assignments.find((a:any)=>a.socket==='reward-1').item_id;
   const c:Command={actor:'p2',action:{type:'void',run_id:r.result,reason:'bounded operator-recovery fixture',disposition:{...empty(),town_returned:['p2-club'],dungeon_consumed:[tonic],dungeon_returned:['maker-sword-0']}}};
   const ended=await f.apply('void-'+i,c);await f.replay('void-'+i,c,ended);await f.reject('void-again-'+i,c,'TerminalRun');
   s=await f.audit();assert.equal(s.credits.p2,'10','only escrow refunded');assert.equal(s.credits.maker,'106');assert.equal(item(s,tonic).location.kind,'consumed');
  }
  await f.reject('depleted',admission(p.result,'p3'),'IncompleteBundle');
  await f.advance(t.closes_at_ms);await f.apply('close',close(p.result));s=await f.audit();
  assert.equal(s.editions[0].consumed_value,'12');assert.equal(s.editions[0].banked_value,'12');assert.deepEqual(item(s,'maker-sword-0').location,{kind:'bank'});assert.equal(s.credits.maker,'106');
  console.log('Low extraction: five paid losses transfer 10 credits; two operator voids refund 4 escrow credits but consume both tonic copies; closure banks the residual sword.');
 }finally{await f.close();}
});

test('S17 concentrated extraction and coordinated buyback/refunding transfer wealth but create no goods or coins',{timeout:180000},async()=>{
 const f=await scenario();try{
  const t=fixedTerms(Number(await f.view('clock_ms')),['sword','tonic']),funding=Array.from({length:3},(_,i)=>'maker-sword-'+i).concat(Array.from({length:3},(_,i)=>'maker-tonic-'+i));
  const p=await f.apply('publish',{actor:'maker',action:{type:'publish',terms:t,fee:'1',funding}});
  await f.reject('self-entry',admission(p.result,'maker','1'),'SelfEntry');
  for(let cycle=0;cycle<2;cycle++){
   for(let i=0;i<3;i++){
    const r=await f.apply(`entry-${cycle}-${i}`,admission(p.result,'buyer','1'));
    const ids=r.run.assignments.map((a:any)=>a.item_id);
    const c:Command={actor:'buyer',action:{type:'settle',run_id:r.result,outcome:'extracted',carried_dungeon_ids:ids,disposition:{...empty(),dungeon_extracted:ids}}};
    const ended=await f.apply(`extract-${cycle}-${i}`,c);await f.replay(`extract-${cycle}-${i}`,c,ended);
   }
   await f.reject('empty-'+cycle,admission(p.result,'p2','1'),'IncompleteBundle');
   let s=await f.audit();for(const id of funding)assert.deepEqual(item(s,id).location,{kind:'owned',profile:'buyer'});
   if(cycle===0){
    const l=await f.apply('buyer-list',{actor:'buyer',action:{type:'list',item_ids:funding,unit_price:'1'}});
    const buy:Command={actor:'maker',action:{type:'buy',listing_id:l.result,item_ids:funding,expected_unit_price:'1'}};
    const bought=await f.apply('maker-buyback',buy);await f.replay('maker-buyback',buy,bought);
    const refresh:Command={actor:'maker',action:{type:'refresh',edition_id:p.result,fixed_funding:funding,random_funding:[]}};
    const refreshed=await f.apply('refill',refresh);await f.replay('refill',refresh,refreshed);await f.reject('duplicate-refill',refresh,'UnownedFunding');
    s=await f.audit();assert.equal(s.editions[0].refresh_value,'54');assert.equal(s.editions[0].placement_paid,'4');
   }
  }
  await f.advance(t.closes_at_ms);await f.apply('close',close(p.result));const s=await f.audit();
  assert.equal(s.credits.maker,'96');assert.equal(s.credits.buyer,'10');assert.equal(s.bank,'4');assert.equal(s.editions[0].extracted_value,'108');assert.equal(s.editions[0].banked_value,'0');
  assert.equal(s.items.length,51);assert.equal(s.items.filter((i:any)=>i.location.kind==='consumed').length,0);
  console.log('Closed group: 6 admissions + 6-credit loot buyback recycle the same six goods; maker remains down 4 placement credits; no new population, coins or instances.');
 }finally{await f.close();}
});
