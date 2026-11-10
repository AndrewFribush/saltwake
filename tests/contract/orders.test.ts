import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers';
test('unseeded order has no spendable budget',{timeout:120000},async()=>{const f=await fixture();try{const r=await f.call('execute',{op_id:'fill',command:{actor:'maker',action:{type:'fill_npc_order',order_id:'fine-tonic-demo',item_ids:['maker-tonic-0'],expected_unit_price:'5'}}});assert.equal(r.result,'OrderExhausted');}finally{await f.sandbox.tearDown();}});
import {readFileSync} from 'node:fs';
import type {ChildProcess} from 'node:child_process';
import {Sandbox,GenesisAccount} from 'near-sandbox';
import {Account,JsonRpcProvider,type KeyPairString} from 'near-api-js';
import {commandHash} from '../../packages/shared/src/protocol';
import type {Command,EconomySnapshot} from '../../packages/shared/src/types';
// Deliberately separate from the legacy 150-credit/14-item shared fixture.
async function marketFixture(){
 const genesis=GenesisAccount.createDefault();const outsider=GenesisAccount.createDefault('outsider');
 const sandbox=await Sandbox.start({config:{additionalAccounts:[outsider]}});
 const provider=new JsonRpcProvider({url:sandbox.rpcUrl});const account=new Account(genesis.accountId,provider,genesis.privateKey as KeyPairString);
 const other=new Account(outsider.accountId,provider,outsider.privateKey as KeyPairString);
 const call=(methodName:string,args:Record<string,unknown>={})=>account.callFunction<any>({contractId:genesis.accountId,methodName,args,gas:100_000_000_000_000n,waitUntil:'FINAL'});
 const view=()=>provider.callFunction<EconomySnapshot>({contractId:genesis.accountId,method:'snapshot',args:{},blockQuery:{finality:'final'}});
 const close=async()=>{const child=(sandbox as unknown as {childProcess:ChildProcess}).childProcess;const timer=setTimeout(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');},5000);try{await sandbox.tearDown();}finally{clearTimeout(timer);}};
 try{
 await account.deployContract(readFileSync('contracts/economy/target/wasm32-unknown-unknown/release/dungeon_economy.wasm'));
 await assert.rejects(()=>other.callFunction({contractId:genesis.accountId,methodName:'init_market_demo',args:{},gas:100_000_000_000_000n,waitUntil:'FINAL'}));
 await call('init_market_demo');
 const apply=async(id:string,command:Command)=>{const r=await call('execute',{op_id:id,command});assert.equal(r.payload_hash,commandHash(command));const s=(await view())!;assert.equal(s.items.length,19);assert.equal(new Set(s.items.map(i=>i.id)).size,19);assert.equal(Object.values(s.credits).reduce((n,v)=>n+BigInt(v),BigInt(s.bank)+BigInt(s.npc_order.budget))+s.runs.filter(r=>r.status==='active').reduce((n,r)=>n+BigInt(r.fee),0n),170n);return r;};
 return {call,view,apply,close};
 }catch(e){await close();throw e;}
}
const fill=(ids:string[],actor='maker',price='5',order='fine-tonic-demo'):Command=>({actor,action:{type:'fill_npc_order',order_id:order,item_ids:ids,expected_unit_price:price}});
test('seeded NPC demand pays at most 20 credits for four fine tonics, with atomic validation and replay',{timeout:120000},async()=>{
 const f=await marketFixture();try{
 await assert.rejects(()=>f.call('init_market_demo'));await assert.rejects(()=>f.call('init_demo'));
 const initial=(await f.view())!;assert.equal(initial.credits.maker,'100');assert.equal(initial.bank,'0');assert.deepEqual(initial.npc_order,{id:'fine-tonic-demo',item_type:'fineTonic',unit_price:'5',remaining:4,budget:'20',seeded_demo_demand:true});
 for(const [i,c] of [fill([]),fill(['maker-fine-tonic-0','maker-fine-tonic-0']),fill(['maker-fine-tonic-0'],'buyer'),fill(['maker-fine-tonic-0'],'maker','4'),fill(['maker-fine-tonic-0'],'maker','5','missing'),fill(['maker-fine-tonic-0','maker-tonic-0']),fill([0,1,2,3,4].map(i=>`maker-fine-tonic-${i}`))].entries()){
  assert.equal((await f.apply(`bad-${i}`,c)).status,'Rejected');assert.deepEqual(await f.view(),initial);
 }
 // Listed inventory cannot satisfy the order.
 await f.apply('list',{actor:'maker',action:{type:'list',item_ids:['maker-fine-tonic-0'],unit_price:'1'}});
 const locked=await f.view();assert.equal((await f.apply('locked',fill(['maker-fine-tonic-0']))).result,'UnownedItem');assert.deepEqual(await f.view(),locked);
 await f.apply('cancel',{actor:'maker',action:{type:'cancel_listing',listing_id:'listing-0'}});
 const command=fill(['maker-fine-tonic-0','maker-fine-tonic-1','maker-fine-tonic-2']);const first=await f.apply('first',command);assert.equal(first.status,'Applied');assert.deepEqual(await f.apply('first',command),first);
 let s=(await f.view())!;assert.equal(s.credits.maker,'115');assert.equal(s.npc_order.remaining,1);assert.equal(s.npc_order.budget,'5');
 assert.equal((await f.apply('reuse',fill(['maker-fine-tonic-0']))).result,'UnownedItem');assert.deepEqual(await f.view(),s);
 const results=await Promise.all([f.apply('last-a',fill(['maker-fine-tonic-3'])),f.apply('last-b',fill(['maker-fine-tonic-4']))]);assert.deepEqual(results.map(r=>r.status).sort(),['Applied','Rejected']);
 s=(await f.view())!;assert.equal(s.npc_order.remaining,0);assert.equal(s.npc_order.budget,'0');assert.equal(s.credits.maker,'120');assert.equal(s.items.filter(i=>i.item_type==='fineTonic'&&i.location.kind==='consumed').length,4);
 const spare=s.items.find(i=>i.item_type==='fineTonic'&&i.location.kind==='owned')!;
 assert.equal((await f.apply('overfill',fill([spare.id]))).result,'OrderExhausted');assert.deepEqual(await f.view(),s);
 const consumed=s.items.find(i=>i.location.kind==='consumed')!;assert.equal((await f.apply('resell',{actor:'maker',action:{type:'list',item_ids:[consumed.id],unit_price:'1'}})).result,'UnownedItem');assert.deepEqual(await f.view(),s);
 }finally{await f.close();}
});
