import type {ChildProcess} from 'node:child_process';
import {commandHash} from '../../packages/shared/src/protocol';
import type {Command} from '../../packages/shared/src/types';
import assert from 'node:assert/strict';
import {audit} from './invariants';
import {readFileSync} from 'node:fs';
import {Sandbox,GenesisAccount} from 'near-sandbox';
import {Account,JsonRpcProvider,type KeyPairString} from 'near-api-js';
export async function fixture(wasm='contracts/economy/target/wasm32-unknown-unknown/release/dungeon_economy.wasm'){
 const genesis=GenesisAccount.createDefault();const other=GenesisAccount.createDefault('outsider');
 const sandbox=await Sandbox.start({config:{additionalAccounts:[other]}});
 // near-sandbox0.3.4 can hang in graceful shutdown after fast-forward.
 // This handle is exclusively the ephemeral child created by this fixture.
 const originalTearDown=sandbox.tearDown.bind(sandbox);
 sandbox.tearDown=async()=>{
  const child=(sandbox as unknown as {childProcess:ChildProcess}).childProcess;
  const timer=setTimeout(()=>{if(child.exitCode===null&&child.signalCode===null){console.log('Sandbox cleanup: forced exit after five-second grace.');child.kill('SIGKILL');}},5000);
  try{await originalTearDown();}finally{clearTimeout(timer);}
 };
 try{
 const provider=new JsonRpcProvider({url:sandbox.rpcUrl});
 const account=new Account(genesis.accountId,provider,genesis.privateKey as KeyPairString);
 const outsider=new Account(other.accountId,provider,other.privateKey as KeyPairString);
 await account.deployContract(readFileSync(wasm));
 const call=(methodName:string,args:Record<string,unknown>={})=>account.callFunction<any>({contractId:genesis.accountId,methodName,args,gas:100_000_000_000_000n,waitUntil:methodName==='init_demo'?'FINAL':'INCLUDED_FINAL'});
 const view=(method:string,args:Record<string,unknown>={})=>provider.callFunction<any>({contractId:genesis.accountId,method,args});
 await call('init_demo');
 return {sandbox,provider,account,genesis,call,view,apply:async(op_id:string,command:object)=>{const receipt=await call('execute',{op_id,command});audit(await view('snapshot'));assert.equal(receipt.payload_hash,commandHash(command as Command));return receipt;},outsider,contractId:genesis.accountId};
 }catch(e){await sandbox.tearDown();throw e;}
}
export function terms(now:number){return {title:'First expedition',rules_version:1,modules:['cellar','gauntlet'],sockets:[{id:'sword',room:0,slot:0,enemy:'pursuer',trap:false,reward:'sword'},{id:'tonic-a',room:0,slot:1,enemy:'none',trap:false,reward:'tonic'},{id:'tonic-b',room:1,slot:0,enemy:'charger',trap:true,reward:'tonic'}],opens_at_ms:String(now-1000),closes_at_ms:String(now+120000),no_reward:false,difficulty_tag:'standard',style_tag:'combat',run_duration_ms:'900000',max_runs:4} as const;}
