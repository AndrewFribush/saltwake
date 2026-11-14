import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,rmSync} from 'node:fs';import {randomUUID} from 'node:crypto';import type {ChildProcess} from 'node:child_process';
import {Sandbox,GenesisAccount} from 'near-sandbox';import {Account,JsonRpcProvider,type KeyPairString} from 'near-api-js';
import {starterTownCommands} from '../../../packages/shared/src/starter-town';import {runDemoTownSeed} from '../../../scripts/demo-town';import {landRules} from '../../../packages/shared/src/land';
import {boardEntries} from '../../../packages/game/src/town-board';
test('demonstration town seed builds through the player API within plot limits and seeded assets',{timeout:300000},async()=>{
 const genesis=GenesisAccount.createDefault();const sandbox=await Sandbox.start({});const epoch='test-demo-town-'+randomUUID();
 try{
  const provider=new JsonRpcProvider({url:sandbox.rpcUrl});const account=new Account(genesis.accountId,provider,genesis.privateKey as KeyPairString);
  await account.deployContract(readFileSync('contracts/economy/target/wasm32-unknown-unknown/release/dungeon_economy.wasm'));
  const call=(methodName:string,args:object)=>account.callFunction<any>({contractId:genesis.accountId,methodName,args,gas:100_000_000_000_000n,waitUntil:'FINAL'});
  await call('init_demo_extended',{});const now=await provider.callFunction<string>({contractId:genesis.accountId,method:'clock_ms',args:{}});
  for(const {id,command} of starterTownCommands(Number(now)))assert.equal((await call('execute',{op_id:id,command})).status,'Applied');
  const view=()=>provider.callFunction<any>({contractId:genesis.accountId,method:'snapshot',args:{}});const before=await view();
  await runDemoTownSeed({rpcUrl:sandbox.rpcUrl,accountId:genesis.accountId,privateKey:genesis.privateKey,epoch},()=>{});
  const after=await view();
  // No issuance: total credits (including coins escrowed in open commissions) and the item set are unchanged.
  const total=(s:any)=>Object.values(s.credits).reduce((n:bigint,v:any)=>n+BigInt(v),0n)+BigInt(s.bank)+((s.commissions??[]) as any[]).reduce((n:bigint,c:any)=>n+BigInt(c.escrow),0n);
  assert.equal(total(after),total(before));assert.deepEqual(after.items.map((i:any)=>i.id).sort(),before.items.map((i:any)=>i.id).sort());
  // Seeding never throws on the showcase, so check here that the current generator still produces it.
  const show=after.editions.find((e:any)=>e.terms.title==='The tide vaults');assert.ok(show,'showcase published against the current generator');assert.equal(show.terms.no_reward,false);
  assert.equal(after.items.filter((i:any)=>i.location.kind==='edition_fixed'&&i.location.edition===show.id).length,6,'three funded copies of herb + fine tonic');
  assert.equal(after.shops.length,10,'3 shops, the showcase, the 2 preset halls and the 4 sample halls');for(const o of new Set<string>(after.shops.map((s:any)=>s.owner)))assert.ok(after.shops.filter((s:any)=>s.owner===o).length<=landRules.maxPlotsPerOwner);
  const editions=after.editions.map((e:any)=>({...e,status:e.closed?'closed':'open',bundles:0,record:{attempts:0,completed:after.runs.filter((r:any)=>r.edition===e.id&&r.status!=='active').length,extracted:0,died:0}}));
  const board=boardEntries(after.shops,editions,after.listings);
  assert.equal(board.filter(e=>e.kind==='dungeon').length,7);assert.equal(board.filter(e=>e.kind==='shop').length,3);
  assert.ok(board.filter(e=>e.kind==='shop').every(e=>e.goods!.count>0));
  assert.equal(after.runs.filter((r:any)=>r.status==='abandoned').length,2);
  assert.equal((after.commissions??[]).filter((c:any)=>c.status==='open').length,1,'one demo commission shows artisans player demand');
  assert.ok(after.shops.every((s:any)=>JSON.parse(s.interior).fixtures.some((f:any)=>f.text)),'each building has an authored notice');
 }finally{rmSync('.state/'+epoch,{recursive:true,force:true});const child=(sandbox as unknown as {childProcess:ChildProcess}).childProcess;const t=setTimeout(()=>{if(child.exitCode===null)child.kill('SIGKILL');},5000);try{await sandbox.tearDown();}finally{clearTimeout(t);}}
});
