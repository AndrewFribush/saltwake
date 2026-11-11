import type {ChildProcess} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync,unlinkSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {Sandbox,GenesisAccount} from 'near-sandbox';
import {Account,JsonRpcProvider,type KeyPairString} from 'near-api-js';
import {starterTownCommands} from '../packages/shared/src/starter-town';
const genesis=GenesisAccount.createDefault();const sandbox=await Sandbox.start({});
try{
 const provider=new JsonRpcProvider({url:sandbox.rpcUrl});const account=new Account(genesis.accountId,provider,genesis.privateKey as KeyPairString);
 await account.deployContract(readFileSync('contracts/economy/target/wasm32-unknown-unknown/release/dungeon_economy.wasm'));
 await account.callFunction({contractId:genesis.accountId,methodName:'init_demo_extended',args:{},gas:100_000_000_000_000n,waitUntil:'FINAL'});
 if(!process.argv.includes('--empty')){
  const now=await provider.callFunction<string>({contractId:genesis.accountId,method:'clock_ms',args:{},blockQuery:{finality:'final'}});
  for(const {id,command} of starterTownCommands(Number(now))){
   const receipt=await account.callFunction<any>({contractId:genesis.accountId,methodName:'execute',args:{op_id:id,command},gas:100_000_000_000_000n,waitUntil:'FINAL'});
   if(receipt.status!=='Applied')throw Error('Starter town setup failed: '+receipt.result);
  }
  console.log('Starter town: proprietor-funded expedition (two copies), tonic stalls. Existing seeded assets only.');
 }
 const local={epoch:randomUUID(),profiles:['buyer','maker','p2','p3','p4','p5','worker','worker2'],rpcUrl:sandbox.rpcUrl,accountId:genesis.accountId,privateKey:genesis.privateKey};
 mkdirSync('.state/'+local.epoch,{recursive:true,mode:0o700});
 // Demonstration town (default; --plain or --empty skip it): demo characters build through the ordinary player API.
 if(!process.argv.includes('--empty')&&!process.argv.includes('--plain')){const {runDemoTownSeed}=await import('./demo-town');await runDemoTownSeed(local);}
 writeFileSync('.state/sandbox.json',JSON.stringify(local),{mode:0o600,flag:'wx'});
 console.log('Fresh local sandbox ready. Start npm run server in another terminal. Keep this process running while restarting the server.');
 await new Promise<void>(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});
 unlinkSync('.state/sandbox.json');
}finally{const child=(sandbox as unknown as {childProcess:ChildProcess}).childProcess;const timer=setTimeout(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');},5000);try{await sandbox.tearDown();}finally{clearTimeout(timer);}}
