import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Sandbox,GenesisAccount} from 'near-sandbox';
import {Account,JsonRpcProvider,type KeyPairString} from 'near-api-js';
test('WASM sandbox: initialize once, debit three once, reject ID/payload conflict', {timeout:120_000},async()=>{
 const wasm=readFileSync('contracts/economy/target/wasm32-unknown-unknown/release/dungeon_economy.wasm');
 const genesis=GenesisAccount.createDefault();
 const sandbox=await Sandbox.start({});
 try{
  assert.match(sandbox.rpcUrl,/^http:\/\/(127\.0\.0\.1|localhost):/);
  const provider=new JsonRpcProvider({url:sandbox.rpcUrl});
  const account=new Account(genesis.accountId,provider,genesis.privateKey as KeyPairString);
  await account.deployContract(wasm);
  const call=(methodName:string,args:object={})=>account.callFunction({contractId:genesis.accountId,methodName,args,gas:100_000_000_000_000n});
  await call('init_demo');
  await assert.rejects(()=>call('init_demo'));
  await call('debit',{op_id:'admit-1',profile:'buyer',amount:'3'});
  await call('debit',{op_id:'admit-1',profile:'buyer',amount:'3'});
  await assert.rejects(()=>call('debit',{op_id:'admit-1',profile:'buyer',amount:'4'}));
  const state=await provider.callFunction({contractId:genesis.accountId,method:'balances',args:{}});
  assert.deepEqual(state,{buyer:'7',bank:'3'});
  console.log('Local sandbox receipt proof: repeated debit once, conflicting payload rejected, buyer7/bank3.');
 }finally{await sandbox.tearDown();}
});
