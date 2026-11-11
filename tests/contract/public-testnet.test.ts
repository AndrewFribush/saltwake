import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {ChildProcess} from 'node:child_process';
import {Sandbox,GenesisAccount} from 'near-sandbox';
import {Account,JsonRpcProvider,type KeyPairString} from 'near-api-js';
import {playerProfile,playerOperationId} from '../../packages/shared/src/player-identity';
import {terms} from './helpers';
import {commitment} from './extended-fixture';

test('public testnet seed: a zero-asset wallet earns four wages, crafts, sells and opens a first dungeon',{timeout:120000},async()=>{
 const root=GenesisAccount.createDefault(),player=GenesisAccount.createDefault('newcomer');
 const sandbox=await Sandbox.start({config:{additionalAccounts:[player]}});
 const provider=new JsonRpcProvider({url:sandbox.rpcUrl});
 const operator=new Account(root.accountId,provider,root.privateKey as KeyPairString),wallet=new Account(player.accountId,provider,player.privateKey as KeyPairString);
 const call=(who:Account,methodName:string,args:Record<string,unknown>={})=>who.callFunction<any>({contractId:root.accountId,methodName,args,gas:100_000_000_000_000n,waitUntil:'FINAL'});
 const view=()=>provider.callFunction<any>({contractId:root.accountId,method:'snapshot',args:{}});
 const total=(s:any)=>Object.values(s.credits).reduce<bigint>((n,v)=>n+BigInt(v as string),BigInt(s.bank)+BigInt(s.npc_order.budget)+BigInt(s.recovery.budget)+s.batches.reduce((n:bigint,b:any)=>n+BigInt(b.wage_reserved),0n));
 try{
  await operator.deployContract(readFileSync('contracts/economy/target/wasm32-unknown-unknown/release/dungeon_economy.wasm'));await call(operator,'init_public_testnet');
  let s=await view();assert.equal(s.recovery.budget,'160');assert.equal(s.recovery.max_jobs_per_profile,4);assert.equal(s.items.length,275);assert.equal(s.items.filter((i:any)=>i.location.kind==='bank').length,240);assert.equal(total(s),330n);
  const profile=playerProfile(player.accountId);assert.equal(await call(wallet,'register_player'),profile);
  const run=(request_id:string,action:any)=>call(wallet,'execute_player',{request_id,action});
  // Earn: four recovery jobs at 2 coins reach exactly one batch of ingredients.
  for(let k=0;k<4;k++){
   const id=playerOperationId(player.accountId,'work-'+k);
   const begin=await run('work-'+k,{type:'begin_recovery',batch_id:id,bank_input_ids:[`bank-herb-${100+2*k}`,`bank-herb-${101+2*k}`,`bank-flask-${100+2*k}`,`bank-flask-${101+2*k}`],challenge_commitment:commitment,deadline_ms:'0'});
   assert.equal(begin.status,'Applied',JSON.stringify(begin));
   const finish=await call(operator,'execute',{op_id:'finish-work-'+k,command:{actor:profile,action:{type:'finish_recovery',batch_id:id,tier:'normal',reason:'completed'}}});
   assert.equal(finish.status,'Applied');
  }
  s=await view();assert.equal(s.credits[profile],'8');assert.equal(s.recovery.budget,'152');assert.equal(total(s),330n);
  const fifth=await run('work-4',{type:'begin_recovery',batch_id:playerOperationId(player.accountId,'work-4'),bank_input_ids:['bank-herb-110','bank-herb-111','bank-flask-110','bank-flask-111'],challenge_commitment:commitment,deadline_ms:'0'});
  assert.equal(fifth.status,'Rejected','the allowance and the holdings limit both stop a fifth job');
  // Craft: buy 2 herbs + 2 flasks with the wages and brew one batch.
  const ingredients=['bank-herb-50','bank-herb-51','bank-flask-50','bank-flask-51'];
  const buy=await run('buy',{type:'bank_buy',item_ids:ingredients,expected_unit_prices:['2','2','2','2']});
  assert.equal(buy.status,'Applied',JSON.stringify(buy));s=await view();assert.equal(s.credits[profile],'0');
  const craftId=playerOperationId(player.accountId,'brew');
  assert.equal((await run('brew',{type:'begin_craft',batch_id:craftId,input_ids:ingredients,challenge_commitment:commitment,deadline_ms:'0'})).status,'Applied');
  assert.equal((await call(operator,'execute',{op_id:'finish-brew',command:{actor:profile,action:{type:'finish_craft',batch_id:craftId,tier:'normal',reason:'completed'}}})).status,'Applied');
  s=await view();const tonics=s.items.filter((i:any)=>i.location.kind==='owned'&&i.location.profile===profile);assert.equal(tonics.length,2);
  // Sell: the bank buys the two tonics back at half catalog value.
  const sell=await run('sell',{type:'bank_sell',item_ids:tonics.map((i:any)=>i.id),expected_unit_prices:tonics.map((i:any)=>i.item_type==='fineTonic'?'4':'3')});
  assert.equal(sell.status,'Applied',JSON.stringify(sell));s=await view();assert.equal(s.credits[profile],'6');
  // Build: open a no-treasure dungeon for the 2-coin base placement.
  const now=Number(await provider.callFunction<string>({contractId:root.accountId,method:'clock_ms',args:{}}));
  const t={...terms(now),title:'First hollow',sockets:[],no_reward:true};
  const pub=await run('open',{type:'publish',terms:t,fee:'1',funding:[]});
  assert.equal(pub.status,'Applied',JSON.stringify(pub));s=await view();assert.equal(s.credits[profile],'4');assert.ok(s.editions.some((e:any)=>e.maker===profile));
  assert.equal(total(s),330n,'wages come only from the reserved labor pool; nothing else is created');
 }finally{const child=(sandbox as unknown as {childProcess:ChildProcess}).childProcess;const timer=setTimeout(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');},5000);try{await sandbox.tearDown();}finally{clearTimeout(timer);}}
});
