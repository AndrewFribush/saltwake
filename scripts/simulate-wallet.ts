/** SIMULATION in local wallet mode: bot players are real NEAR sandbox accounts that sign in with NEP-413, register,
 * buy coins with NEAR (labelled issuance), and sign every economic action themselves (execute_player), exactly as a
 * browser wallet would; the server prepares transactions and the operator only acts as the run/craft oracle.
 *
 *   npm run simulate:wallet -- --days 3
 *
 * Isolated local sandbox (public-testnet economy seed + starter town). Bots read their own full run state to choose
 * moves. Writes .state/<epoch>/town-history.json like `npm run simulate` and exits.
 */
import type {ChildProcess} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import type {AddressInfo} from 'node:net';
import {parseArgs} from 'node:util';
import {Sandbox,GenesisAccount} from 'near-sandbox';
import {Account,JsonRpcProvider,KeyPair,KeyPairSigner,actions,type KeyPairString} from 'near-api-js';
import {starterTownCommands} from '../packages/shared/src/starter-town';
import {catalog} from '../packages/shared/src/catalog';
import {Store} from '../apps/server/src/db';import {Outbox} from '../apps/server/src/outbox';import {NearChain} from '../apps/server/src/chain';import {Runs,type SavedRun} from '../apps/server/src/runs';import {httpServer} from '../apps/server/src/http';import {WalletSessions} from '../apps/server/src/wallet-auth';
import {presetPublication} from './demo-town';
import {choose,type Policy} from './depth-sim';
import type {DayReport,TownHistory} from '../packages/shared/src/town-history';

const {values:args}=parseArgs({options:{days:{type:'string',default:'3'}}});
const days=Math.max(1,Math.min(14,Number(args.days)||3));
const ROLES={makers:['w-0'],artisans:['w-1','w-2'],delvers:['w-3','w-4','w-5']};
const ALL=[...ROLES.makers,...ROLES.artisans,...ROLES.delvers];const POLICIES:Policy[]=['cautious','greedy','reckless'];
const origin='http://127.0.0.1:18990';const COIN=10n**22n;
const genesis=GenesisAccount.createDefault();const sandbox=await Sandbox.start({});const started=Date.now();
try{
 const provider=new JsonRpcProvider({url:sandbox.rpcUrl});const root=new Account(genesis.accountId,provider,genesis.privateKey as KeyPairString);const contractId=genesis.accountId;
 await root.deployContract(readFileSync('contracts/economy/target/wasm32-unknown-unknown/release/dungeon_economy.wasm'));
 await root.callFunction({contractId,methodName:'init_public_testnet',args:{},gas:300_000_000_000_000n,waitUntil:'FINAL'});
 const clock=await provider.callFunction<string>({contractId,method:'clock_ms',args:{},blockQuery:{finality:'final'}});
 for(const {id,command} of starterTownCommands(Number(clock))){const r=await root.callFunction<any>({contractId,methodName:'execute',args:{op_id:id,command},gas:100_000_000_000_000n,waitUntil:'FINAL'});if(r.status!=='Applied')throw Error('Starter town failed: '+r.result);}
 const epoch='wallet-sim-'+randomUUID();mkdirSync('.state/'+epoch,{recursive:true,mode:0o700});const db=new Store('.state/'+epoch+'/server.sqlite');
 const snapshot=()=>provider.callFunction<any>({contractId,method:'snapshot',args:{},blockQuery:{finality:'final'}});
 const box=new Outbox(db,new NearChain(provider,KeyPairSigner.fromSecretKey(genesis.privateKey as KeyPairString),contractId,contractId));
 const sessions=new WalletSessions({origin,network:'localnet',contractId,provider,secureCookies:false,sessionMs:3600000});
 const {server}=httpServer(box,new Runs(db,box),snapshot,undefined,{walletSessions:sessions,origin,network:'localnet',contractId},{webOrigin:origin});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+(server.address() as AddressInfo).port;
 const history:TownHistory={label:'SIMULATION',days:[],startedAt:new Date().toISOString(),note:'Wallet-mode bots: sandbox NEAR accounts sign in, buy coins with NEAR (labelled issuance) and sign every action; the operator only settles runs and crafts. Isolated local sandbox. Not organic activity.'};
 const historyPath='.state/'+epoch+'/town-history.json';
 type Bot={id:string;account:Account;signer:KeyPairSigner;cookie:string};const bots=new Map<string,Bot>();
 const req=async(cookie:string,path:string,body?:unknown)=>{const r=await fetch(base+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});const v=await r.json() as any;if(r.status!==200)throw Error(`${path}: ${JSON.stringify(v).slice(0,200)}`);return {v,r};};
 const send=(b:Bot,tx:any)=>b.account.callFunction<any>({contractId:tx.receiverId,methodName:tx.methodName,args:tx.args,gas:BigInt(tx.gas),deposit:BigInt(tx.deposit??'0'),waitUntil:'FINAL'});
 let seq=0;
 /** The wallet path: the server prepares, the player's own key signs, the server then reads the confirmed receipt. */
 const cmd=async(p:string,action:any)=>{const b=bots.get(p)!;const body={id:`w${++seq}`,action};const prep=await req(b.cookie,'command',body);if(prep.v.transaction)await send(b,prep.v.transaction).catch(()=>{});
  for(let i=0;i<20;i++){const c=await req(b.cookie,'command',body);if(c.v.status==='Applied'||c.v.status==='Rejected')return {ok:c.v.status==='Applied',result:c.v.result as string};await new Promise(r=>setTimeout(r,500));}return {ok:false,result:'unconfirmed'};};
 const world=(p:string)=>req(bots.get(p)!.cookie,'world').then(x=>x.v);
 // Accounts: create, sign in, register, buy coins with NEAR.
 for(const id of ALL){
  const key=KeyPair.fromRandom('ed25519'),acct=`${id}.${contractId}`;
  await root.signAndSendTransaction({receiverId:acct,actions:[actions.createAccount(),actions.transfer(30n*10n**24n),actions.addFullAccessKey(key.getPublicKey())],waitUntil:'FINAL'});
  const b:Bot={id,account:new Account(acct,provider,key.toString() as KeyPairString),signer:new KeyPairSigner(key),cookie:''};
  const c=await req('','wallet/challenge',{accountId:acct});const ch=c.v.challenge;const proof=await b.signer.signNep413Message(acct,{message:ch.message,recipient:ch.recipient,nonce:Buffer.from(ch.nonce,'base64')});
  const v=await req(c.r.headers.getSetCookie()[0].split(';')[0],'wallet/verify',{accountId:acct,publicKey:proof.publicKey.toString(),signature:Buffer.from(proof.signature).toString('base64')});
  b.cookie=v.r.headers.getSetCookie().find(x=>x.startsWith('dungeon_wallet_session='))!.split(';')[0];bots.set(id,b);
  const reg=await req(b.cookie,'wallet/register',{});await send(b,reg.v.transaction);
  const coins=id.startsWith('w-0')?40:12;await b.account.callFunction({contractId,methodName:'buy_coins',args:{request_id:'buyin-'+id,expected_coins:String(coins)},gas:100_000_000_000_000n,deposit:BigInt(coins)*COIN,waitUntil:'FINAL'});
 }
 const prof=(id:string)=>'wallet:'+bots.get(id)!.account.accountId;
 const supply=(s:any)=>Object.values(s.credits).reduce((n:bigint,v:any)=>n+BigInt(v),0n)+BigInt(s.bank)+s.runs.filter((r:any)=>r.status==='active').reduce((n:bigint,r:any)=>n+BigInt(r.fee),0n)+BigInt(s.recovery?.budget??0)+s.batches.filter((b:any)=>b.recovery&&b.status==='active').reduce((n:bigint,b:any)=>n+BigInt(b.wage_reserved),0n)+BigInt(s.npc_order?.budget??0)+(s.commissions??[]).reduce((n:bigint,c:any)=>n+BigInt(c.escrow),0n);
 const issued=(s:any)=>BigInt(s.coin_issuance?.coins_issued??0);
 const start=await snapshot();const baseline=supply(start)-issued(start);let prev=start;
 // The maker opens a small generated dungeon (no treasure), signed by its own key.
 {const pub=presetPublication(7,'small','Wallet warren',Date.now());const r=await cmd('w-0',{type:'publish',terms:pub.terms,fee:'1',funding:[]});console.log(r.ok?'w-0 opened Wallet warren':'w-0 could not open: '+r.result);}
 for(let day=1;day<=days;day++){
  const events:string[]=[];const tally={fees:0n,trades:0,tradeCoins:0n,crafted:0,runs:{extracted:0,died:0,abandoned:0}};
  for(const p of ROLES.artisans){
   let w=await world(p);const bank=w.bankItems as any[];const has=(t:string)=>(w.items as any[]).filter(i=>i.item_type===t).map(i=>i.id);
   if((has('herb').length<2||has('flask').length<2)&&Number(w.credits)>=8){const need=[...bank.filter(i=>i.item_type==='herb').slice(0,2),...bank.filter(i=>i.item_type==='flask').slice(0,2)];
    const r=await cmd(p,{type:'bank_buy',item_ids:need.map(i=>i.id),expected_unit_prices:need.map(i=>String(catalog[i.item_type as keyof typeof catalog].value))});if(r.ok)events.push(`${p} bought 4 ingredients from the bank (wallet-signed)`);w=await world(p);}
   if(has('herb').length>=2&&has('flask').length>=2&&await craft(p,[...has('herb').slice(0,2),...has('flask').slice(0,2)])){tally.crafted++;events.push(`${p} brewed a batch (begin signed by its wallet, finished by the oracle)`);}
   w=await world(p);const tonics=(w.items as any[]).filter(i=>i.item_type==='tonic'||i.item_type==='fineTonic');
   if(tonics.length){const r=await cmd(p,{type:'list',item_ids:tonics.map(i=>i.id),unit_price:'5'});if(r.ok)events.push(`${p} listed ${tonics.length} tonics at 5`);}
  }
  for(const [k,p] of ROLES.delvers.entries()){
   const w=await world(p);const tonicOffer=(w.listings as any[]).find(l=>l.status==='active'&&l.seller!==prof(p)&&(w.listedItems as any[]).some(i=>i.location.listing===l.id&&i.item_type==='tonic'));
   if(tonicOffer&&BigInt(tonicOffer.unit_price)+2n<=BigInt(w.credits)){const item=(w.listedItems as any[]).find(i=>i.location.listing===tonicOffer.id&&tonicOffer.remaining_ids.includes(i.id));const r=await cmd(p,{type:'buy',listing_id:tonicOffer.id,item_ids:[item.id],expected_unit_price:tonicOffer.unit_price});if(r.ok){tally.trades++;tally.tradeCoins+=BigInt(tonicOffer.unit_price);events.push(`${p} bought a tonic for ${tonicOffer.unit_price} (wallet-signed)`);}}
   const w2=await world(p);const open=(w2.editions as any[]).filter(e=>e.status==='open'&&e.maker!==prof(p)&&BigInt(e.fee)<=BigInt(w2.credits));if(!open.length){events.push(`${p} could not afford any dungeon (${w2.credits} coins)`);continue;}
   const e=open[(day+k)%open.length];const tonic=(w2.items as any[]).find(i=>i.item_type==='tonic');
   const r=await cmd(p,{type:'admit',edition_id:e.id,expected_version:e.version,expected_fee:e.fee,loadout_ids:tonic?[tonic.id]:[],seed:'0'});
   if(!r.ok){events.push(`${p} refused entry to ${e.terms.title}: ${r.result}`);continue;}
   tally.fees+=BigInt(e.fee);const outcome=await play(p,POLICIES[k%3]);tally.runs[outcome]++;events.push(`${p} paid ${e.fee} into ${e.terms.title} (wallet-signed admission) and ${outcome==='extracted'?'escaped':outcome}`);
  }
  const s=await snapshot();const drift=supply(s)-issued(s)-baseline;const role=(ids:string[])=>ids.reduce((n,id)=>n+Number(s.credits[prof(id)]??0),0);
  const report:DayReport={day,coinsByRole:{makers:role(ROLES.makers),artisans:role(ROLES.artisans),delvers:role(ROLES.delvers)},coinsInPurses:Object.values(s.credits).reduce((n:number,v:any)=>n+Number(v),0),bank:Number(s.bank),issuance:Number(issued(s)),conservationDrift:Number(drift),
   entryFees:Number(tally.fees),wages:0,playerTrades:tally.trades,tradeCoins:Number(tally.tradeCoins),bankSales:0,batchesBrewed:tally.crafted,runs:tally.runs,treasureValue:{extracted:0,consumed:0,banked:0},listings:{},unsoldItems:s.listings.filter((l:any)=>l.status==='active').reduce((n:number,l:any)=>n+l.remaining_ids.length,0),bankStock:s.items.filter((i:any)=>i.location.kind==='bank').length,absentDemand:[],events};
  history.days.push(report);writeFileSync(historyPath,JSON.stringify(history,null,1));
  console.log(`Day ${day}: wallet purses ${JSON.stringify(report.coinsByRole)} · issued ${report.issuance} · fees ${report.entryFees} · trades ${report.playerTrades} · brewed ${report.batchesBrewed} · runs ${JSON.stringify(report.runs)} · drift ${report.conservationDrift}${drift!==0n?' ← CONSERVATION FAILURE':''}`);
  if(drift!==0n)throw Error('Conservation check failed');prev=s;void prev;
 }
 console.log(`SIMULATION (wallet mode) finished: ${days} days in ${Math.round((Date.now()-started)/1000)}s. History: ${historyPath}`);
 await new Promise<void>(r=>server.close(()=>r()));db.close();

 async function craft(p:string,inputs:string[]){
  const b=bots.get(p)!;const begin=await req(b.cookie,'craft/begin',{id:randomUUID(),inputIds:inputs,recovery:false});if(begin.v.transaction)await send(b,begin.v.transaction).catch(()=>{});
  let v:any=begin.v;for(let i=0;i<30&&v?.status!=='active';i++){await new Promise(r=>setTimeout(r,500));v=(await world(p)).craft;if(v?.status==='rejected')return false;}
  if(v?.status!=='active')return false;
  for(let step=0;step<3;step++){v=(await req(b.cookie,'craft/start',{batch:v.id,id:randomUUID(),seq:v.seq,step})).v;await new Promise(r=>setTimeout(r,200));v=(await req(b.cookie,'craft/input',{batch:v.id,id:randomUUID(),seq:v.seq,step})).v;}
  for(let i=0;i<40&&v?.status!=='finished';i++){await new Promise(r=>setTimeout(r,500));v=(await world(p)).craft;}
  return v?.status==='finished';
 }
 async function play(p:string,policy:Policy):Promise<'extracted'|'died'|'abandoned'>{
  const b=bots.get(p)!;let run:any;for(let i=0;i<30&&!run;i++){run=(await world(p)).runs.find((r:any)=>!r.terminal);if(!run)await new Promise(r=>setTimeout(r,500));}
  if(!run)return 'abandoned';let floorTurns=0,room=0;
  for(let i=0;i<400;i++){const saved=db.get<SavedRun>('run',run.id);if(!saved||saved.state.status!=='active')break;if(saved.state.roomIndex!==room){room=saved.state.roomIndex;floorTurns=0;}else floorTurns++;
   const action=choose(saved.state,policy,floorTurns);try{await req(b.cookie,`runs/${run.id}/action`,{id:randomUUID(),seq:saved.seq,action});}catch{try{await req(b.cookie,`runs/${run.id}/action`,{id:randomUUID(),seq:saved.seq,action:{type:'wait'}});}catch{break;}}}
  if(db.get<SavedRun>('run',run.id)?.state.status==='active')await req(b.cookie,`runs/${run.id}/abandon`,{});
  for(let i=0;i<40;i++){const r=(await world(p)).runs.find((x:any)=>x.id===run.id);if(r?.settlement?.status==='Applied')break;await new Promise(r=>setTimeout(r,500));}
  const t=db.get<SavedRun>('run',run.id)?.terminal;return t==='extracted'?'extracted':t==='died'?'died':'abandoned';
 }
}finally{const child=(sandbox as unknown as {childProcess:ChildProcess}).childProcess;const timer=setTimeout(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');},5000);try{await sandbox.tearDown();}finally{clearTimeout(timer);}}
