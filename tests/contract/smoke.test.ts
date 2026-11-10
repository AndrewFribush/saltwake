import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Sandbox,GenesisAccount} from 'near-sandbox';
import {Account,JsonRpcProvider,type KeyPairString} from 'near-api-js';
test('WASM initializes once and preserves rejected receipts for retired debit command',{timeout:120000},async()=>{
 const genesis=GenesisAccount.createDefault();const stranger=GenesisAccount.createDefault('stranger');
 const sandbox=await Sandbox.start({config:{additionalAccounts:[stranger]}});
 try{
  const provider=new JsonRpcProvider({url:sandbox.rpcUrl});const account=new Account(genesis.accountId,provider,genesis.privateKey as KeyPairString);const outsider=new Account(stranger.accountId,provider,stranger.privateKey as KeyPairString);
  await account.deployContract(readFileSync('contracts/economy/target/wasm32-unknown-unknown/release/dungeon_economy.wasm'));
  await assert.rejects(()=>outsider.callFunction({contractId:genesis.accountId,methodName:'init_demo',args:{},gas:100_000_000_000_000n}));
  const call=(methodName:string,args:Record<string,unknown>={})=>account.callFunction<any>({contractId:genesis.accountId,methodName,args,gas:100_000_000_000_000n});
  await call('init_demo');await assert.rejects(()=>call('init_demo'));
  const command={actor:'buyer',action:{type:'debit',amount:'3'}};const r=await call('execute',{op_id:'retired',command});assert.equal(r.status,'Rejected');assert.equal(r.result,'DeprecatedSmokeCommand');
  assert.deepEqual(await call('execute',{op_id:'retired',command}),r);
  await assert.rejects(()=>call('execute',{op_id:'retired',command:{actor:'buyer',action:{type:'debit',amount:'4'}}}));
  assert.deepEqual(await provider.callFunction({contractId:genesis.accountId,method:'balances',args:{}}),{buyer:'10',bank:'0'});
 }finally{await sandbox.tearDown();}
});
