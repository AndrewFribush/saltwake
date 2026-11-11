import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import type {ChildProcess} from 'node:child_process';
import {Sandbox,GenesisAccount} from 'near-sandbox';import {Account,JsonRpcProvider,type KeyPairString} from 'near-api-js';
import {fixture} from './helpers';
test('normal worlds keep the 256-receipt cap; the simulation seed adds labelled profiles and a larger cap',{timeout:150000},async()=>{
 const f=await fixture();try{assert.equal(await f.view('receipt_capacity'),256);}finally{await f.sandbox.tearDown();}
 const g=GenesisAccount.createDefault();const sandbox=await Sandbox.start({});
 try{const provider=new JsonRpcProvider({url:sandbox.rpcUrl});const a=new Account(g.accountId,provider,g.privateKey as KeyPairString);
  await a.deployContract(readFileSync('contracts/economy/target/wasm32-unknown-unknown/release/dungeon_economy.wasm'));
  await a.callFunction({contractId:g.accountId,methodName:'init_simulation',args:{makers:2,artisans:1,delvers:3,delver_coins:'0'},gas:300_000_000_000_000n,waitUntil:'FINAL'});
  const view=(method:string)=>provider.callFunction<any>({contractId:g.accountId,method,args:{}});const s=await view('snapshot');
  assert.equal(await view('receipt_capacity'),8192);
  assert.deepEqual(['m-0','m-1','a-0','d-0','d-1','d-2'].map(p=>s.credits[p]),['60','60','10','0','0','0']);
  assert.equal(s.items.filter((i:any)=>i.location.kind==='owned'&&i.location.profile==='m-0').length,6);
  assert.equal(s.items.filter((i:any)=>i.id.startsWith('sim-bank-')).length,12);
  await assert.rejects(a.callFunction({contractId:g.accountId,methodName:'init_simulation',args:{makers:2,artisans:1,delvers:3,delver_coins:'0'},gas:300_000_000_000_000n}));
 }finally{const child=(sandbox as unknown as {childProcess:ChildProcess}).childProcess;const t=setTimeout(()=>{if(child.exitCode===null)child.kill('SIGKILL');},5000);try{await sandbox.tearDown();}finally{clearTimeout(t);}}
});
