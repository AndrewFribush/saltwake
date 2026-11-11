/** Local stand-in for the public testnet deployment, for wallet-mode play without testnet transactions.
 * Starts an isolated near-sandbox, deploys the contract with init_public_testnet (the same economy testnet uses,
 * plus the starter town), and creates player accounts whose keys the dev test signer can use.
 * Writes git-ignored .state/wallet-sandbox.json (server config) and .state/dev-test-signer.json (Vite dev signer).
 *
 *   npx tsx scripts/wallet-sandbox.ts [players=3]
 *   npx tsx apps/server/src/main.ts --wallet-local --config .state/wallet-sandbox.json --port 18973 --web-origin http://127.0.0.1:18972
 *   SALTWAKE_API_PORT=18973 npx vite apps/web --host 127.0.0.1 --port 18972 --strictPort
 *   open http://127.0.0.1:18972/?devSigner=player1.<contract>  (another browser context: ?devSigner=player2.<contract>)
 */
import type {ChildProcess} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync,unlinkSync,existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {Sandbox,GenesisAccount} from 'near-sandbox';
import {Account,JsonRpcProvider,KeyPair,type KeyPairString} from 'near-api-js';
import {starterTownCommands} from '../packages/shared/src/starter-town';
const players=Math.max(1,Math.min(8,Number(process.argv[2]??3)||3));
if(existsSync('.state/wallet-sandbox.json'))throw Error('.state/wallet-sandbox.json exists: another wallet sandbox is running (or stopped uncleanly; remove the file).');
const genesis=GenesisAccount.createDefault();const sandbox=await Sandbox.start({});
try{
 const provider=new JsonRpcProvider({url:sandbox.rpcUrl});const account=new Account(genesis.accountId,provider,genesis.privateKey as KeyPairString);
 await account.deployContract(readFileSync('contracts/economy/target/wasm32-unknown-unknown/release/dungeon_economy.wasm'));
 await account.callFunction({contractId:genesis.accountId,methodName:'init_public_testnet',args:{},gas:100_000_000_000_000n,waitUntil:'FINAL'});
 const now=await provider.callFunction<string>({contractId:genesis.accountId,method:'clock_ms',args:{},blockQuery:{finality:'final'}});
 for(const {id,command} of starterTownCommands(Number(now))){
  const receipt=await account.callFunction<any>({contractId:genesis.accountId,methodName:'execute',args:{op_id:id,command},gas:100_000_000_000_000n,waitUntil:'FINAL'});
  if(receipt.status!=='Applied')throw Error('Starter town setup failed: '+receipt.result);
 }
 mkdirSync('.state/wallet-sandbox-keys',{recursive:true,mode:0o700});
 const keyPaths:string[]=[];
 for(let n=1;n<=players;n++){
  const accountId=`player${n}.${genesis.accountId}`,key=KeyPair.fromRandom('ed25519');
  await account.createAccount({newAccountId:accountId,publicKey:key.getPublicKey().toString(),nearToTransfer:10n**25n});
  const path=`.state/wallet-sandbox-keys/${accountId}.json`;writeFileSync(path,JSON.stringify({accountId,privateKey:key.toString()}),{mode:0o600});keyPaths.push(path);
  console.log('Player account', accountId);
 }
 writeFileSync('.state/wallet-sandbox.json',JSON.stringify({epoch:'wallet-'+randomUUID(),rpcUrl:sandbox.rpcUrl,accountId:genesis.accountId,privateKey:genesis.privateKey}),{mode:0o600,flag:'wx'});
 writeFileSync('.state/dev-test-signer.json',JSON.stringify({keyPaths,contractId:genesis.accountId,rpcUrl:sandbox.rpcUrl,local:true}),{mode:0o600});
 console.log(`Wallet sandbox ready. Contract ${genesis.accountId}. Start the API with --wallet-local --config .state/wallet-sandbox.json, then restart Vite so it picks up the dev signer.`);
 await new Promise<void>(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});
 unlinkSync('.state/wallet-sandbox.json');unlinkSync('.state/dev-test-signer.json');
}finally{const child=(sandbox as unknown as {childProcess:ChildProcess}).childProcess;const timer=setTimeout(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');},5000);try{await sandbox.tearDown();}finally{clearTimeout(timer);}}
