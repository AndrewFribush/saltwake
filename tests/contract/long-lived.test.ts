import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {ChildProcess} from 'node:child_process';
import {Sandbox,GenesisAccount} from 'near-sandbox';
import {Account,JsonRpcProvider,type KeyPairString} from 'near-api-js';
import {commandHash} from '../../packages/shared/src/protocol';
import type {Command,Partition} from '../../packages/shared/src/types';

// A long-lived world far past the old lifetime caps (64 runs, 64 listings, 64 batches, 32 editions, 256 receipts).
// Contract panics surface as a WebAssembly trap in this build, so refusals are confirmed through state and views.
const trap=(reason:string)=>new RegExp(reason+'|unreachable');
// Live record counts stay bounded by ACTIVE records plus a fixed history; conservation holds after every audit;
// and op ids whose full receipts were pruned still cannot execute twice.
const RUNS=210,LISTINGS=90,BATCHES=80,EDITIONS=20,COMMISSIONS=40,MATERIALS=BATCHES,MAKER_COINS=200n;
const empty=():Partition=>({town_consumed:[],town_returned:[],town_forfeited:[],dungeon_consumed:[],dungeon_extracted:[],dungeon_returned:[]});

async function capacityFixture(recent:number,slots:number,minAgeMs:number){
 const genesis=GenesisAccount.createDefault();const sandbox=await Sandbox.start({});
 const close=async()=>{const child=(sandbox as unknown as {childProcess:ChildProcess}).childProcess;const timer=setTimeout(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');},5000);try{await sandbox.tearDown();}finally{clearTimeout(timer);}};
 try{
  const provider=new JsonRpcProvider({url:sandbox.rpcUrl});const account=new Account(genesis.accountId,provider,genesis.privateKey as KeyPairString);
  const call=(methodName:string,args:Record<string,unknown>={})=>account.callFunction<any>({contractId:genesis.accountId,methodName,args,gas:300_000_000_000_000n,waitUntil:'INCLUDED_FINAL'});
  const view=(method='snapshot',args:Record<string,unknown>={})=>provider.callFunction<any>({contractId:genesis.accountId,method,args,blockQuery:{finality:'final'}});
  await account.deployContract(readFileSync('contracts/economy/target/wasm32-unknown-unknown/release/dungeon_economy.wasm'));
  await account.callFunction({contractId:genesis.accountId,methodName:'init_demo_capacity_test',args:{recent,replay_slots:slots,min_age_ms:String(minAgeMs),materials:MATERIALS,maker_coins:String(MAKER_COINS)},gas:300_000_000_000_000n,waitUntil:'FINAL'});
  const advance=async(blocks:number)=>{const r=await fetch(sandbox.rpcUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'ff',method:'sandbox_fast_forward',params:{delta_height:blocks}}),signal:AbortSignal.timeout(600000)});assert.equal((await r.json()).error,undefined);};
  return {call,view,close,advance,provider};
 }catch(e){await close();throw e;}
}

/** Conservation and referential integrity for the capacity seed (init_demo + issued materials and coins). */
function audit(s:any,initialIds:Set<string>){
 const items=new Map<string,any>(s.items.map((i:any)=>[i.id,i]));assert.equal(items.size,s.items.length,'unique goods');
 for(const id of initialIds)assert.ok(items.has(id),`seeded good ${id} is never pruned`);
 const crafted=s.items.filter((i:any)=>!initialIds.has(i.id));
 assert.ok(crafted.every((i:any)=>/^crafted-/.test(i.id)),'only recipe outputs add goods');
 const consumedHerbs=s.items.filter((i:any)=>i.item_type==='herb'&&i.location.kind==='consumed').length;
 assert.equal(crafted.length,consumedHerbs,'each small batch turns one herb and one flask into exactly one tonic');
 const coins=Object.values(s.credits).reduce<bigint>((n,v)=>n+BigInt(v as string),0n)+BigInt(s.bank)
  +s.runs.filter((r:any)=>r.status==='active').reduce((n:bigint,r:any)=>n+BigInt(r.fee),0n)
  +(s.commissions??[]).reduce((n:bigint,c:any)=>n+BigInt(c.escrow),0n);
 assert.equal(coins,150n+MAKER_COINS,'coins conserved across purses, bank, run escrow and commission escrow');
 for(const e of s.editions)assert.deepEqual([...e.active_runs].sort(),s.runs.filter((r:any)=>r.edition===e.id&&r.status==='active').map((r:any)=>r.id).sort());
 for(const i of s.items){const l=i.location;
  if(l.kind==='loadout'||l.kind==='reserved')assert.equal(s.runs.find((r:any)=>r.id===l.run)?.status,'active','goods only point at kept, active runs');
  if(l.kind==='listed')assert.equal(s.listings.find((x:any)=>x.id===l.listing)?.status,'active','goods only point at kept, active listings');
  if(l.kind==='crafting')assert.equal(s.batches.find((b:any)=>b.id===l.batch)?.status,'active','goods only point at kept, active batches');
  if(l.kind==='edition_fixed'||l.kind==='edition_random')assert.equal(s.editions.find((e:any)=>e.id===l.edition)?.closed,false);
 }
 for(const shop of s.shops??[])for(const id of shop.listing_ids)assert.ok(s.listings.some((l:any)=>l.id===id),'shops never point at pruned listings');
 // Bounded by ACTIVE records plus fixed history, never by lifetime totals.
 assert.ok(s.runs.filter((r:any)=>r.status!=='active').length<=64);
 assert.ok(s.listings.filter((l:any)=>l.status!=='active').length<=64);
 assert.ok(s.batches.filter((b:any)=>b.status!=='active').length<=64);
 assert.ok(s.editions.filter((e:any)=>e.closed).length<=16);
 assert.ok((s.commissions??[]).filter((c:any)=>c.status!=='open').length<=32);
}

test('a long-lived world runs far past the old lifetime caps with bounded records and no replay of pruned operations',{timeout:3_600_000},async()=>{
 const f=await capacityFixture(32,4096,3_600_000);try{
  const initial=await f.view();const initialIds=new Set<string>(initial.items.map((i:any)=>i.id));
  const sent=new Map<string,Command>();let n=0;
  const exec=async(op_id:string,command:Command,expect:'Applied'|'Rejected'='Applied')=>{
   const r=await f.call('execute',{op_id,command});assert.equal(r.payload_hash,commandHash(command));
   assert.equal(r.status,expect,`${op_id}: ${r.result}`);sent.set(op_id,command);
   if(++n%40===0)audit(await f.view(),initialIds);return r;
  };
  const now=Number(await f.view('clock_ms'));
  const openTerms=(title:string)=>({title,rules_version:1,modules:['cellar','gauntlet'],sockets:[],opens_at_ms:String(now-1000),closes_at_ms:String(now+86_000_000),no_reward:true,difficulty_tag:'standard',style_tag:'combat',run_duration_ms:'900000',max_runs:4});
  const hall=(await exec('hall',{actor:'maker',action:{type:'publish',terms:openTerms('Long hall'),fee:'0',funding:[]}})).result;
  // Runs: five players take turns; each run settles (abandoned, fee to maker) or is voided (refund).
  const players=['buyer','p2','p3','p4','p5'];const runIds=new Set<string>();
  for(let i=0;i<RUNS;i++){
   const actor=players[i%players.length];
   const admit=await exec(`run-${i}-in`,{actor,action:{type:'admit',edition_id:hall,expected_version:'1',expected_fee:'0',loadout_ids:[],seed:String(i)}});
   assert.ok(!runIds.has(admit.result),'run ids are never reused');runIds.add(admit.result);
   await exec(`run-${i}-out`,i%2?{actor,action:{type:'void',run_id:admit.result,reason:'capacity test',disposition:empty()}}:{actor,action:{type:'settle',run_id:admit.result,outcome:'abandoned',disposition:empty(),carried_dungeon_ids:[]}});
  }
  // Listings: listed and cancelled, or sold and resold back, never reusing a listing id.
  const listingIds=new Set<string>();
  const list=async(op:string,actor:string)=>{const r=await exec(op,{actor,action:{type:'list',item_ids:['maker-tonic-0'],unit_price:'1'}});assert.ok(!listingIds.has(r.result),'listing ids are never reused');listingIds.add(r.result);return r.result as string;};
  for(let i=0;i<LISTINGS;i++){
   const id=await list(`list-${i}`,'maker');
   if(i%3)await exec(`cancel-${i}`,{actor:'maker',action:{type:'cancel_listing',listing_id:id}});
   else{
    await exec(`buy-${i}`,{actor:'buyer',action:{type:'buy',listing_id:id,item_ids:['maker-tonic-0'],expected_unit_price:'1'}});
    const back=await list(`relist-${i}`,'buyer');
    await exec(`buyback-${i}`,{actor:'maker',action:{type:'buy',listing_id:back,item_ids:['maker-tonic-0'],expected_unit_price:'1'}});
   }
  }
  // Crafting: small batches, each begun and finished.
  for(let i=0;i<BATCHES;i++){
   const clock=Number(await f.view('clock_ms'));
   await exec(`craft-${i}`,{actor:'maker',action:{type:'begin_craft',batch_id:`b-${i}`,input_ids:[`cap-herb-${i}`,`cap-flask-${i}`],challenge_commitment:'ab'.repeat(32),deadline_ms:String(clock+600_000)}});
   await exec(`finish-${i}`,{actor:'maker',action:{type:'finish_craft',batch_id:`b-${i}`,tier:'normal',reason:'completed'}});
  }
  // Editions: opened, retired and closed, far past the old 32-edition lifetime cap.
  for(let i=0;i<EDITIONS;i++){
   const id=(await exec(`ed-${i}`,{actor:'maker',action:{type:'publish',terms:openTerms(`Short hall ${i}`),fee:'0',funding:[]}})).result;
   await exec(`ed-${i}-retire`,{actor:'maker',action:{type:'retire',edition_id:id}});
   await exec(`ed-${i}-close`,{actor:'maker',action:{type:'finalize_close',edition_id:id}});
  }
  // Commissions: a club passes back and forth through filled orders; every fifth order is cancelled instead.
  const commissionIds=new Set<string>();let holder='p2';
  for(let i=0;i<COMMISSIONS;i++){
   const buyer=holder==='p2'?'maker':'p2';
   const id=(await exec(`order-${i}`,{actor:buyer,action:{type:'post_commission',item_type:'club',unit_price:'1',quantity:1}})).result;
   assert.ok(!commissionIds.has(id),'commission ids are never reused');commissionIds.add(id);
   if(i%5===4)await exec(`order-${i}-cancel`,{actor:buyer,action:{type:'cancel_commission',commission_id:id}});
   else{await exec(`order-${i}-fill`,{actor:holder,action:{type:'fill_commission',commission_id:id,item_ids:['p2-club'],expected_unit_price:'1'}});holder=buyer;}
  }
  const s=await f.view();audit(s,initialIds);
  assert.equal(s.runs.length,64,'210 runs leave only the newest 64 settled runs');
  assert.equal(s.listings.length,64);assert.equal(s.batches.length,64);
  assert.equal(s.editions.length,17,'the open hall plus the 16 newest closed editions');
  assert.equal(s.commissions.length,32);
  assert.ok(n>3*256,`ran ${n} operations, past three times the old receipt capacity`);
  const cap=await f.view('capacity');
  assert.equal(cap.receipts.recent_receipts,32);assert.equal(Number(cap.receipts.tombstones),n-32,'every pruned receipt is remembered as a tombstone');
  assert.equal(cap.active_runs,0);assert.equal(cap.open_editions,1);
  // Replays of pruned operations return their recorded outcome and change nothing.
  const before=JSON.stringify(s);
  for(const op of ['run-0-in','run-0-out','list-1','buy-0','craft-0','finish-0','ed-0','order-0']){
   const command=sent.get(op)!;const replay=await f.call('execute',{op_id:op,command});
   assert.equal(replay.op_id,op);assert.equal(replay.payload_hash,commandHash(command));assert.equal(replay.status,'Applied');assert.equal(replay.run,null,'tombstone receipts omit the run copy');
   assert.deepEqual(await f.view('operation',{op_id:op}),replay);
  }
  assert.equal((await f.call('execute',{op_id:'run-0-in',command:sent.get('run-0-in')})).result,'run-0');
  assert.equal(JSON.stringify(await f.view()),before,'replaying pruned operations changed nothing');
  await assert.rejects(f.call('execute',{op_id:'run-0-in',command:{actor:'buyer',action:{type:'admit',edition_id:hall,expected_version:'1',expected_fee:'0',loadout_ids:[],seed:'999'}}}),trap('Operation payload conflict'));
  // Replaying a pruned batch id under a NEW op id is refused while its outputs live.
  const clock=Number(await f.view('clock_ms'));
  assert.equal((await exec('craft-again',{actor:'maker',action:{type:'begin_craft',batch_id:'b-0',input_ids:[`cap-herb-${BATCHES-1}`,`cap-flask-${BATCHES-1}`],challenge_commitment:'ab'.repeat(32),deadline_ms:String(clock+600_000)}},'Rejected')).result,'BatchExists');
 }finally{await f.close();}
});

test('the receipt window refuses work instead of forgetting early, keeps terminal headroom, and frees slots only after the minimum age',{timeout:900_000},async()=>{
 const f=await capacityFixture(4,4,3_600_000);try{
  const debit=(i:number):Command=>({actor:'missing',action:{type:'debit',amount:String(i)}});
  // Sandbox blocks advance chain time by roughly 0.3 s each; small steps keep each RPC under the HTTP header timeout.
  const advanceTo=async(t:number)=>{for(let i=0;i<40;i++){const left=t-Number(await f.view('clock_ms'));if(left<=0)break;await f.advance(Math.min(2000,Math.ceil(left/250)+50));}assert.ok(Number(await f.view('clock_ms'))>=t,'chain time advanced');};
  const now=Number(await f.view('clock_ms'));const closes=now+60_000;
  const publish:Command={actor:'maker',action:{type:'publish',terms:{title:'Window',rules_version:1,modules:['cellar','gauntlet'],sockets:[],opens_at_ms:String(now-1000),closes_at_ms:String(closes),no_reward:true,difficulty_tag:'standard',style_tag:'combat',run_duration_ms:'900000',max_runs:4},fee:'0',funding:[]}};
  const pub=await f.call('execute',{op_id:'pub',command:publish});
  const admit=await f.call('execute',{op_id:'enter',command:{actor:'buyer',action:{type:'admit',edition_id:pub.result,expected_version:'1',expected_fee:'0',loadout_ids:[],seed:'1'}}});assert.equal(admit.status,'Applied');
  // 8 slots, 2 used, 2 reserved (open edition + active run): ordinary work stops while 2 slots remain.
  let recorded=0;for(let i=0;i<10;i++){try{assert.equal((await f.call('execute',{op_id:`fill-${i}`,command:debit(i)})).result,'UnknownProfile');recorded++;}catch(e){assert.match(String(e),trap('ReceiptCapacityReserved'));break;}}
  assert.equal(recorded,4,'ordinary work stops while terminal headroom remains');
  const cap=await f.view('capacity');assert.equal(cap.receipts.recent_receipts,4);assert.equal(Number(cap.receipts.tombstones),2);
  // The publication receipt left tier 1; its op id still cannot run again.
  const replay=await f.call('execute',{op_id:'pub',command:publish});assert.equal(replay.result,pub.result);assert.equal(replay.run,null);
  assert.equal((await f.view()).editions.length,1,'no second edition from a replayed publish');
  // Terminal obligations still complete in the reserved slots.
  assert.equal((await f.call('execute',{op_id:'leave',command:{actor:'buyer',action:{type:'void',run_id:admit.result,reason:'window test',disposition:empty()}}})).status,'Applied');
  await advanceTo(closes);
  assert.equal((await f.call('execute',{op_id:'close',command:{actor:'maker',action:{type:'finalize_close',edition_id:pub.result}}})).status,'Applied');
  await assert.rejects(f.call('execute',{op_id:'over',command:debit(99)}),trap('Receipt window full'));
  const full=await f.view('capacity');assert.equal(full.receipts.recent_receipts+Number(full.receipts.tombstones),8,'refused because all 8 slots hold receipts younger than the minimum age');assert.equal(await f.view('operation',{op_id:'over'}),null);
  assert.equal((await f.view('operation',{op_id:'pub'})).result,pub.result,'still remembered before the minimum age');
  // After the minimum age, old tombstones are forgotten a few per call and new work is admitted again.
  await advanceTo(Number(await f.view('clock_ms'))+3_601_000);
  // The first call forgets all four old tombstones; each new receipt then pushes a young one, so exactly four fit.
  for(let i=0;i<4;i++)assert.equal((await f.call('execute',{op_id:`later-${i}`,command:debit(100+i)})).result,'UnknownProfile');
  await assert.rejects(f.call('execute',{op_id:'later-4',command:debit(104)}),trap('Receipt window full'));
  assert.equal(await f.view('operation',{op_id:'pub'}),null,'only after the minimum age may a tombstone be forgotten');
 }finally{await f.close();}
});
