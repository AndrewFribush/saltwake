import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {ChildProcess} from 'node:child_process';
import {Sandbox,GenesisAccount} from 'near-sandbox';
import {Account,JsonRpcProvider,type KeyPairString} from 'near-api-js';

const wasm='contracts/economy/target/wasm32-unknown-unknown/release/dungeon_economy.wasm';
const price=10n**22n;

test('NEAR buy-in credits exact quoted coins, records issuance, is idempotent and rejects mismatches',{timeout:180000},async()=>{
 const root=GenesisAccount.createDefault(),players=[GenesisAccount.createDefault('buyer-0'),GenesisAccount.createDefault('buyer-1')];
 const sandbox=await Sandbox.start({config:{additionalAccounts:players}});
 const provider=new JsonRpcProvider({url:sandbox.rpcUrl});
 const account=(g:typeof root)=>new Account(g.accountId,provider,g.privateKey as KeyPairString);
 const operator=account(root),[alice,bob]=players.map(account);
 const call=(who:Account,methodName:string,args:Record<string,unknown>={},deposit=0n)=>who.callFunction<any>({contractId:root.accountId,methodName,args,deposit,gas:100_000_000_000_000n,waitUntil:'INCLUDED_FINAL'});
 const view=(method='snapshot',args:Record<string,unknown>={})=>provider.callFunction<any>({contractId:root.accountId,method,args});
 const contractBalance=async()=>BigInt((await provider.viewAccount({accountId:root.accountId} as any) as any).amount);
 const total=(s:any)=>Object.values(s.credits).reduce<bigint>((n,v)=>n+BigInt(v as string),0n)+BigInt(s.bank)+s.runs.filter((r:any)=>r.status==='active').reduce((n:bigint,r:any)=>n+BigInt(r.fee),0n);
 try{
  await operator.deployContract(readFileSync(wasm));await call(operator,'init_demo_extended');
  const before=await view();const seeded=total(before);
  assert.deepEqual(before.coin_issuance,{coins_issued:'0',near_received:'0',purchases:'0'});
  const offer=await view('coin_offer');assert.equal(offer.price_yocto_per_coin,price.toString());assert.equal(offer.max_coins_per_purchase,'1000');
  // Unregistered accounts cannot buy.
  await assert.rejects(call(alice,'buy_coins',{request_id:'buy-1',expected_coins:'10'},10n*price),{name:"ContractExecutionError"});
  await call(alice,'register_player');
  // Quote mismatches fail atomically (deposit refunded by the failed receipt).
  await assert.rejects(call(alice,'buy_coins',{request_id:'buy-1',expected_coins:'10'},9n*price),{name:"ContractExecutionError"});
  await assert.rejects(call(alice,'buy_coins',{request_id:'buy-1',expected_coins:'0'},0n),{name:"ContractExecutionError"});
  await assert.rejects(call(alice,'buy_coins',{request_id:'buy-1',expected_coins:'1001'},1001n*price),{name:"ContractExecutionError"});
  assert.equal((await view()).credits['wallet:'+alice.accountId],'0');
  const held=await contractBalance();
  const bought=await call(alice,'buy_coins',{request_id:'buy-1',expected_coins:'10'},10n*price);
  assert.equal(bought.coins,'10');assert.equal(bought.replay,false);assert.equal(bought.paid_yocto,(10n*price).toString());
  assert.ok(await contractBalance()>=held+10n*price-10n**21n,'attached NEAR stays with the contract');
  let s=await view();assert.equal(s.credits['wallet:'+alice.accountId],'10');
  assert.deepEqual(s.coin_issuance,{coins_issued:'10',near_received:(10n*price).toString(),purchases:'1'});
  assert.equal(total(s),seeded+BigInt(s.coin_issuance.coins_issued),'credits = seeded supply + coins issued by purchase');
  // Replay: same request id credits nothing more and returns the newly attached deposit.
  const replay=await call(alice,'buy_coins',{request_id:'buy-1',expected_coins:'10'},10n*price);
  assert.equal(replay.replay,true);assert.equal(replay.coins,'10');
  s=await view();assert.equal(s.credits['wallet:'+alice.accountId],'10');assert.equal(s.coin_issuance.purchases,'1');
  assert.equal(await view('coin_purchase',{account_id:alice.accountId,request_id:'buy-1'}),'10');
  // Request ids are per account; another player may reuse the string.
  await call(bob,'register_player');await call(bob,'buy_coins',{request_id:'buy-1',expected_coins:'3'},3n*price);
  s=await view();assert.equal(s.credits['wallet:'+bob.accountId],'3');assert.equal(s.coin_issuance.coins_issued,'13');
  assert.equal(total(s),seeded+13n);
  // Bought coins spend like any others: a bank purchase.
  const r=await call(alice,'execute_player',{request_id:'shop-1',action:{type:'bank_buy',item_ids:['bank-herb-0'],expected_unit_prices:['2']}});
  assert.equal(r.status,'Applied');assert.equal((await view()).credits['wallet:'+alice.accountId],'8');
 }finally{const child=(sandbox as unknown as {childProcess:ChildProcess}).childProcess;const timer=setTimeout(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');},5000);try{await sandbox.tearDown();}finally{clearTimeout(timer);}}
});
