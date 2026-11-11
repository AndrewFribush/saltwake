/** Upgrade only the existing isolated local sandbox; never initialize or reset it. */
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {Account,JsonRpcProvider,type KeyPairString} from 'near-api-js';
import {Store} from '../apps/server/src/db';
import type {EconomySnapshot} from '../packages/shared/src/types';
const config=JSON.parse(readFileSync('.state/sandbox.json','utf8'));
const url=new URL(config.rpcUrl);
if(url.protocol!=='http:'||!['127.0.0.1','localhost'].includes(url.hostname)||url.username||url.password)throw Error('Only the existing loopback sandbox may be upgraded.');
// Acquiring the same writer lock requires stopping the API first and prevents
// its signer from racing deployment. Pending transactions must settle first.
const db=new Store('.state/'+config.epoch+'/server.sqlite');
try{
 if(db.operations().some(op=>op.status==='Pending'||op.status==='Unknown'))throw Error('Reconcile pending operations before upgrading. Restart API to reconcile.');
 const provider=new JsonRpcProvider({url:config.rpcUrl});
 const snapshot=()=>provider.callFunction<EconomySnapshot>({contractId:config.accountId,method:'snapshot',args:{},blockQuery:{finality:'final'}});
 const before=await snapshot();if(!before)throw Error('Existing economy state is required.');
 const account=new Account(config.accountId,provider,config.privateKey as KeyPairString);
 await account.deployContract(readFileSync('contracts/economy/target/wasm32-unknown-unknown/release/dungeon_economy.wasm'));
 // The buy-in issuance line is a new snapshot field (stored outside contract state); a code upgrade adds it at zero.
 const strip=(v:any)=>{const {coin_issuance,retired_editions,...rest}=v??{};return rest;};
 const after=await snapshot();assert.deepEqual(strip(after),strip(before),'Local upgrade changed economy snapshot');
 assert.equal((after as any)?.coin_issuance?.coins_issued??'0',(before as any)?.coin_issuance?.coins_issued??'0','Local upgrade changed coin issuance');
 console.log(`Local contract upgraded; unchanged snapshot: ${before.items.length} items, ${before.editions.length} editions, ${before.runs.length} runs. No initialization performed.`);
}finally{db.close();}
