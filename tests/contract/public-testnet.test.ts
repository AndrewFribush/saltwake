import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {ChildProcess} from 'node:child_process';
import {Sandbox,GenesisAccount} from 'near-sandbox';
import {Account,JsonRpcProvider,type KeyPairString} from 'near-api-js';
import {playerProfile,playerOperationId} from '../../packages/shared/src/player-identity';
import {commitment} from './extended-fixture';

test('public testnet seed funds 60 newcomer recovery jobs; a zero-asset wallet earns a wage and buys from the bank',{timeout:120000},async()=>{
 const root=GenesisAccount.createDefault(),player=GenesisAccount.createDefault('newcomer');
 const sandbox=await Sandbox.start({config:{additionalAccounts:[player]}});
 const provider=new JsonRpcProvider({url:sandbox.rpcUrl});
 const operator=new Account(root.accountId,provider,root.privateKey as KeyPairString),wallet=new Account(player.accountId,provider,player.privateKey as KeyPairString);
 const call=(who:Account,methodName:string,args:Record<string,unknown>={})=>who.callFunction<any>({contractId:root.accountId,methodName,args,gas:100_000_000_000_000n,waitUntil:'FINAL'});
 const view=()=>provider.callFunction<any>({contractId:root.accountId,method:'snapshot',args:{}});
 const total=(s:any)=>Object.values(s.credits).reduce<bigint>((n,v)=>n+BigInt(v as string),BigInt(s.bank)+BigInt(s.npc_order.budget)+BigInt(s.recovery.budget)+s.batches.reduce((n:bigint,b:any)=>n+BigInt(b.wage_reserved),0n));
 try{
  await operator.deployContract(readFileSync('contracts/economy/target/wasm32-unknown-unknown/release/dungeon_economy.wasm'));await call(operator,'init_public_testnet');
  let s=await view();assert.equal(s.recovery.budget,'120');assert.equal(s.items.length,275);assert.equal(s.items.filter((i:any)=>i.location.kind==='bank').length,240);assert.equal(total(s),290n);
  const profile=playerProfile(player.accountId);assert.equal(await call(wallet,'register_player'),profile);
  const id=playerOperationId(player.accountId,'work');
  const begin=await call(wallet,'execute_player',{request_id:'work',action:{type:'begin_recovery',batch_id:id,bank_input_ids:['bank-herb-100','bank-herb-101','bank-flask-100','bank-flask-101'],challenge_commitment:commitment,deadline_ms:'0'}});
  assert.equal(begin.status,'Applied');
  const finish=await call(operator,'execute',{op_id:'finish-work',command:{actor:profile,action:{type:'finish_recovery',batch_id:id,tier:'normal',reason:'completed'}}});
  assert.equal(finish.status,'Applied');s=await view();assert.equal(s.credits[profile],'2');
  const buy=await call(wallet,'execute_player',{request_id:'buy',action:{type:'bank_buy',item_ids:['bank-herb-50'],expected_unit_prices:['2']}});
  assert.equal(buy.status,'Applied',JSON.stringify(buy));s=await view();assert.equal(s.credits[profile],'0');
  assert.deepEqual(s.items.find((i:any)=>i.id==='bank-herb-50').location,{kind:'owned',profile});assert.equal(total(s),290n);
 }finally{const child=(sandbox as unknown as {childProcess:ChildProcess}).childProcess;const timer=setTimeout(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');},5000);try{await sandbox.tearDown();}finally{clearTimeout(timer);}}
});
