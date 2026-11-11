import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {ChildProcess} from 'node:child_process';
import {Sandbox,GenesisAccount} from 'near-sandbox';
import {Account,JsonRpcProvider,type KeyPairString} from 'near-api-js';
import {commandHash} from '../../packages/shared/src/protocol';
import type {Command} from '../../packages/shared/src/types';
export async function extendedFixture(){
 const genesis=GenesisAccount.createDefault();const sandbox=await Sandbox.start({});
 const provider=new JsonRpcProvider({url:sandbox.rpcUrl});const account=new Account(genesis.accountId,provider,genesis.privateKey as KeyPairString);
 const call=(methodName:string,args:Record<string,unknown>={})=>account.callFunction<any>({contractId:genesis.accountId,methodName,args,gas:100_000_000_000_000n,waitUntil:'FINAL'});
 const view=(method='snapshot',args:Record<string,unknown>={})=>provider.callFunction<any>({contractId:genesis.accountId,method,args,blockQuery:{finality:'final'}});
 const close=async()=>{const child=(sandbox as unknown as {childProcess:ChildProcess}).childProcess;const timer=setTimeout(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');},5000);try{await sandbox.tearDown();}finally{clearTimeout(timer);}};
 try{
 await account.deployContract(readFileSync('contracts/economy/target/wasm32-unknown-unknown/release/dungeon_economy.wasm'));
 await call('init_demo_extended');
 const apply=async(op_id:string,command:Command)=>{const r=await call('execute',{op_id,command});assert.equal(r.payload_hash,commandHash(command));const s=await view();
  assert.equal(s.items.length,51+s.batches.filter((b:any)=>b.status!=='active').reduce((n:number,b:any)=>n+b.input_ids.length/2,0));
  assert.equal(new Set(s.items.map((i:any)=>i.id)).size,s.items.length);
  const escrow=s.runs.filter((r:any)=>r.status==='active').reduce((n:bigint,r:any)=>n+BigInt(r.fee),0n);
  const wages=s.batches.reduce((n:bigint,b:any)=>n+BigInt(b.wage_reserved),0n)+(s.commissions??[]).reduce((n:bigint,c:any)=>n+BigInt(c.escrow),0n);
  assert.equal(Object.values(s.credits).reduce<bigint>((n,v)=>n+BigInt(v as string),BigInt(s.bank)+BigInt(s.npc_order.budget)+BigInt(s.recovery.budget)+escrow+wages),176n);
  return r;
 };
 const advance=async(deadline:string)=>{for(let i=0;i<10&&BigInt(await view('clock_ms'))<BigInt(deadline);i++){const r=await fetch(sandbox.rpcUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'ff',method:'sandbox_fast_forward',params:{delta_height:1000}}),signal:AbortSignal.timeout(30000)});assert.equal((await r.json()).error,undefined);}assert.ok(BigInt(await view('clock_ms'))>=BigInt(deadline));};
 return {call,view,apply,close,advance,provider,genesis,sandbox,contractId:genesis.accountId};
 }catch(e){await close();throw e;}
}
export const inputs=(owner:string,n=0)=>[`${owner}-herb-${n}`,`${owner}-herb-${n+1}`,`${owner}-flask-${n}`,`${owner}-flask-${n+1}`];
export const commitment='ab'.repeat(32);
