import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {ChildProcess} from 'node:child_process';
import {Sandbox,GenesisAccount} from 'near-sandbox';
import {Account,JsonRpcProvider,type KeyPairString} from 'near-api-js';
import {playerProfile,playerOperationId,isPlayerAction,validPlayerAccount} from '../../packages/shared/src/player-identity';
import {commandHash} from '../../packages/shared/src/protocol';
import {defaultInterior} from '../../packages/game/src/interiors';
import {terms} from './helpers';
import {inputs,commitment} from './extended-fixture';
import type {Command,Partition} from '../../packages/shared/src/types';

const wasm='contracts/economy/target/wasm32-unknown-unknown/release/dungeon_economy.wasm';
const oldWasm='tests/fixtures/economy-pre-identity.wasm';
const shop={title:'Wallet shop',district:'center',x:14,y:7,interior:JSON.stringify(defaultInterior('market')),open:true};
const empty=():Partition=>({town_consumed:[],town_returned:[],town_forfeited:[],dungeon_consumed:[],dungeon_returned:[],dungeon_extracted:[]});
const contractError={name:'ContractExecutionError'};
async function fixture(path=wasm,players=2){
 const root=GenesisAccount.createDefault(),accounts=Array.from({length:players},(_,i)=>GenesisAccount.createDefault('player-'+i));
 const sandbox=await Sandbox.start({config:{additionalAccounts:accounts}});
 const provider=new JsonRpcProvider({url:sandbox.rpcUrl});
 const account=(g:typeof root)=>new Account(g.accountId,provider,g.privateKey as KeyPairString);
 const operator=account(root),wallets=accounts.map(account);
 const close=async()=>{const child=(sandbox as unknown as {childProcess:ChildProcess}).childProcess;const timer=setTimeout(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');},5000);try{await sandbox.tearDown();}finally{clearTimeout(timer);}};
 const call=(who:Account,methodName:string,args:Record<string,unknown>={})=>who.callFunction<any>({contractId:root.accountId,methodName,args,gas:100_000_000_000_000n,waitUntil:'INCLUDED_FINAL'});
 const view=(method='snapshot',args:Record<string,unknown>={})=>provider.callFunction<any>({contractId:root.accountId,method,args});
 try{
  await operator.deployContract(readFileSync(path));await call(operator,'init_demo_extended');
  const register=(n=0)=>call(wallets[n],'register_player');
  const execute=(id:string,command:Command)=>call(operator,'execute',{op_id:id,command});
  const player=(n:number,request_id:string,action:Command['action'],extra:Record<string,unknown>={})=>call(wallets[n],'execute_player',{request_id,action,...extra});
  const denied=async(work:()=>Promise<unknown>)=>{const before=await view();await assert.rejects(work,contractError);assert.deepEqual(await view(),before);};
  return {operator,wallets,accounts,root,call,view,register,execute,player,denied,close};
 }catch(e){await close();throw e;}
}
const freeTerms=(now:number)=>({...terms(now),sockets:[],no_reward:true,closes_at_ms:String(now+600000)});
const admit=(edition_id:string):Command['action']=>({type:'admit',edition_id,expected_version:'1',expected_fee:'0',loadout_ids:[],seed:'18446744073709551615'});

test('identity helper account/request boundaries and explicit action gates',()=>{
 for(const a of ['ab','a.b','a-b_c','0'.repeat(64)]){assert.equal(validPlayerAccount(a),true);assert.equal(playerProfile(a),'wallet:'+a);assert.match(playerOperationId(a,'request_1-test'),/^[0-9a-f]{64}$/);}
 for(const a of ['', 'a','A.test','a..b','a_-b','.ab','ab-','a:b','éé','a'.repeat(65),'ab\n']){assert.equal(validPlayerAccount(a),false);assert.throws(()=>playerProfile(a));assert.throws(()=>playerOperationId(a,'ok'));}
 for(const id of ['', 'x'.repeat(41),'a b','a.b','é','a\n'])assert.throws(()=>playerOperationId('ab',id));
 assert.notEqual(playerOperationId('ab','same'),playerOperationId('ac','same'));
 assert.notEqual(playerOperationId('ab','same'),playerOperationId('ab','different'));
 assert.equal(isPlayerAction(null),false);assert.equal(isPlayerAction(undefined),false);
 for(const type of ['settle','void','finish_craft','finish_recovery','begin_craft','begin_recovery','debit'])assert.equal(isPlayerAction({type} as Command['action']),false);
});

test('WASM wallet registration binds accounts, preserves zero issuance and enforces request identities',{timeout:120000},async()=>{
 const f=await fixture();try{
  const initial=await f.view(),name=playerProfile(f.accounts[0].accountId);
  await f.denied(()=>f.player(0,'unregistered',{type:'create_shop',...shop}));
  assert.equal(await f.view('operation',{op_id:playerOperationId(f.accounts[0].accountId,'unregistered')}),null);
  assert.equal(await f.view('wallet_profile',{account_id:f.accounts[0].accountId}),name);
  assert.equal(await f.call(f.wallets[0],'register_player',{actor:'maker',profile:'maker'}),name);
  assert.equal(await f.register(1),playerProfile(f.accounts[1].accountId));
  const registered=await f.view();assert.deepEqual(registered,{...initial,credits:{...initial.credits,[name]:'0',[playerProfile(f.accounts[1].accountId)]:'0'}});
  assert.equal(await f.register(),name);assert.deepEqual(await f.view(),registered);
  for(const id of ['a','A_0-b','x'.repeat(40)])assert.equal(await f.view('player_operation_id',{account_id:f.accounts[0].accountId,request_id:id}),playerOperationId(f.accounts[0].accountId,id));
  for(const id of ['', 'x'.repeat(41),'a.b','a b','é'])await f.denied(()=>f.player(0,id,{type:'create_shop',...shop}));
  await f.denied(()=>f.call(f.wallets[0],'execute',{op_id:'forged-operator',command:{actor:'maker',action:{type:'list',item_ids:['maker-tonic-0'],unit_price:'1'}}}));
  const action:Command['action']={type:'list',item_ids:['maker-tonic-0'],unit_price:'1'};
  const attempted=await f.player(0,'actor-injection',action,{actor:'maker'});assert.equal(attempted.result,'UnownedItem');
  assert.equal(attempted.payload_hash,commandHash({actor:name,action}));assert.deepEqual(await f.view(),registered);
 }finally{await f.close();}
});

test('WASM direct free admission pins submitted hash and derived seed; only bound oracle may terminate',{timeout:120000},async()=>{
 const f=await fixture();try{
  await f.register();await f.register(1);
  const t=freeTerms(Number(await f.view('clock_ms'))),p=await f.execute('free',{actor:'maker',action:{type:'publish',terms:t,fee:'0',funding:[]}});assert.equal(p.status,'Applied');
  const action=admit(p.result),actor=playerProfile(f.accounts[0].accountId);
  const r=await f.player(0,'entry',action);assert.equal(r.status,'Applied');assert.equal(r.op_id,playerOperationId(f.accounts[0].accountId,'entry'));
  assert.equal(r.payload_hash,commandHash({actor,action}));assert.equal(r.run.player,actor);assert.equal(r.run.fee,'0');assert.deepEqual(r.run.assignments,[]);
  assert.notEqual(r.run.seed,'18446744073709551615','effective entropy must not be the submitted seed');
  const other=await f.player(1,'entry',action);assert.equal(other.status,'Applied');assert.notEqual(other.op_id,r.op_id);
  const before=await f.view();assert.deepEqual(await f.player(0,'entry',action),r);assert.deepEqual(await f.view(),before);
  await f.denied(()=>f.player(0,'entry',{...action,seed:'0'} as Command['action']));
  const end:Command['action']={type:'settle',run_id:r.result,outcome:'extracted',disposition:empty(),carried_dungeon_ids:[]};
  await f.denied(()=>f.player(0,'self-settle',end));await f.denied(()=>f.player(1,'foreign-settle',end));
  await f.denied(()=>f.execute('wrong-bound',{actor:playerProfile(f.accounts[1].accountId),action:end}));
  await f.denied(()=>f.execute('missing-run',{actor,action:{...end,run_id:'missing'}}));
  const settled=await f.execute('oracle-settle',{actor,action:end});assert.equal(settled.status,'Applied');
  const after=await f.view();assert.deepEqual(await f.execute('oracle-settle',{actor,action:end}),settled);assert.deepEqual(await f.player(0,'entry',action),r);assert.deepEqual(await f.view(),after);
  const voidCommand:Command={actor:playerProfile(f.accounts[1].accountId),action:{type:'void',run_id:other.result,reason:'fixture oracle recovery',disposition:empty()}};
  assert.equal((await f.execute('oracle-void',voidCommand)).status,'Applied');
  assert.equal((await f.view()).credits[actor],'0');
 }finally{await f.close();}
});

test('WASM wallet shops enforce ownership, replay and explicit operator/player action allowlists',{timeout:120000},async()=>{
 const f=await fixture();try{
  await f.register();await f.register(1);const actor=playerProfile(f.accounts[0].accountId);
  const created=await f.player(0,'shop',{type:'create_shop',...shop});assert.equal(created.status,'Applied');assert.equal((await f.view()).shops[0].owner,actor);
  const update:Command['action']={type:'update_shop',shop_id:created.result,expected_version:'1',...shop,open:false};
  const wrong=await f.player(1,'update',update,{actor});assert.equal(wrong.result,'WrongShopOwner');
  const changed=await f.player(0,'update',update);assert.equal(changed.status,'Applied');const stable=await f.view();
  assert.deepEqual(await f.player(0,'update',update),changed);assert.deepEqual(await f.view(),stable);assert.equal(stable.shops[0].version,'2');
  const t=freeTerms(Number(await f.view('clock_ms')));
  const ordinary:Command['action'][]=[{type:'publish',terms:t,fee:'0',funding:[]},{type:'publish_random',terms:t,fee:'0',fixed_funding:[],random_tables:[]},admit('edition-0'),{type:'finalize_close',edition_id:'edition-0'},{type:'refresh',edition_id:'edition-0',fixed_funding:[],random_funding:[]},{type:'set_fee',edition_id:'edition-0',new_fee:'0'},{type:'list',item_ids:[],unit_price:'1'},{type:'cancel_listing',listing_id:'listing-0'},{type:'buy',listing_id:'listing-0',item_ids:[],expected_unit_price:'1'},{type:'bank_buy',item_ids:[],expected_unit_prices:[]},{type:'bank_sell',item_ids:[],expected_unit_prices:[]},{type:'fill_npc_order',order_id:'fine-tonic-demo',item_ids:[],expected_unit_price:'5'},{type:'create_shop',...shop},update,{type:'stock_shop',shop_id:created.result,item_ids:[],unit_price:'1'}];
  for(const [i,action] of ordinary.entries()){
   assert.equal(isPlayerAction(action),true);await f.denied(()=>f.execute('operator-denied-'+i,{actor,action}));assert.equal(await f.view('operation',{op_id:'operator-denied-'+i}),null);
  }
  const deadline_ms=String(BigInt(await f.view('clock_ms'))+600000n);
  const gated:Command['action'][]=[{type:'begin_craft',batch_id:'direct',input_ids:inputs('maker'),challenge_commitment:commitment,deadline_ms},{type:'begin_recovery',batch_id:'direct',bank_input_ids:inputs('bank'),challenge_commitment:commitment,deadline_ms},{type:'finish_craft',batch_id:'direct',tier:'fine',reason:'completed'},{type:'finish_recovery',batch_id:'direct',tier:'fine',reason:'completed'},{type:'void',run_id:'missing',reason:'fake',disposition:empty()},{type:'settle',run_id:'missing',outcome:'extracted',disposition:empty(),carried_dungeon_ids:[]},{type:'debit',amount:'0'}];
  for(const [i,action] of gated.entries()){assert.equal(isPlayerAction(action),false);await f.denied(()=>f.player(0,'gated-'+i,action));assert.equal(await f.view('operation',{op_id:playerOperationId(f.accounts[0].accountId,'gated-'+i)}),null);}
  await f.execute('demo-craft',{actor:'maker',action:{type:'begin_craft',batch_id:'demo-craft',input_ids:inputs('maker'),challenge_commitment:commitment,deadline_ms}});
  await f.execute('demo-recovery',{actor:'worker',action:{type:'begin_recovery',batch_id:'demo-recovery',bank_input_ids:inputs('bank'),challenge_commitment:commitment,deadline_ms}});
  for(const batch_id of ['demo-craft','demo-recovery','missing'])for(const type of ['finish_craft','finish_recovery'] as const)await f.denied(()=>f.execute(type+'-'+batch_id,{actor,action:{type,batch_id,tier:'fine',reason:'completed'}}));
 }finally{await f.close();}
});

test('WASM repeated registration preserves earned credits without grants',{timeout:120000},async()=>{
 const f=await fixture();try{
  const actor=await f.register(),t={...freeTerms(Number(await f.view('clock_ms'))),sockets:[{id:'loot',room:0,slot:0,enemy:'none' as const,trap:false,reward:'tonic' as const}],no_reward:false};
  const p=await f.execute('funded',{actor:'maker',action:{type:'publish',terms:t,fee:'0',funding:['maker-tonic-0']}});assert.equal(p.status,'Applied');
  const r=await f.player(0,'loot',admit(p.result));assert.equal(r.status,'Applied');
  assert.equal((await f.execute('extract',{actor,action:{type:'settle',run_id:r.result,outcome:'extracted',carried_dungeon_ids:['maker-tonic-0'],disposition:{...empty(),dungeon_extracted:['maker-tonic-0']}}})).status,'Applied');
  const l=await f.player(0,'list',{type:'list',item_ids:['maker-tonic-0'],unit_price:'1'});assert.equal(l.status,'Applied');
  assert.equal((await f.execute('demo-buyer',{actor:'buyer',action:{type:'buy',listing_id:l.result,item_ids:['maker-tonic-0'],expected_unit_price:'1'}})).status,'Applied');
  const before=await f.view();assert.equal(before.credits[actor],'1');assert.equal(before.credits.buyer,'9');assert.equal(await f.register(),actor);assert.deepEqual(await f.view(),before);
 }finally{await f.close();}
});

test('WASM registration caps only wallet profiles at 128 and existing registration remains replayable',{timeout:240000},async()=>{
 const f=await fixture(wasm,128);try{
  const initial=await f.view();
  for(let i=0;i<128;i++)assert.equal(await f.register(i),playerProfile(f.accounts[i].accountId));
  const before=await f.view();assert.equal(Object.keys(before.credits).filter(k=>k.startsWith('wallet:')).length,128);
  for(const [profile,credits] of Object.entries(initial.credits))assert.equal(before.credits[profile],credits);
  assert.deepEqual(before.items,initial.items);assert.equal(before.bank,initial.bank);assert.deepEqual(before.recovery,initial.recovery);
  await f.denied(()=>f.call(f.operator,'register_player'));assert.equal(await f.register(),playerProfile(f.accounts[0].accountId));assert.deepEqual(await f.view(),before);
 }finally{await f.close();}
});

test('WASM pre-identity populated upgrade preserves snapshots, hashes and receipts without migration',{timeout:180000},async()=>{
 const f=await fixture(oldWasm);try{
  const records:{id:string;command:Command;receipt:any}[]=[];
  const old=async(id:string,command:Command)=>{const receipt=await f.execute(id,command);assert.equal(receipt.status,'Applied',receipt.result);assert.equal(receipt.payload_hash,commandHash(command));records.push({id,command,receipt});return receipt;};
  const t=freeTerms(Number(await f.view('clock_ms')));
  const p=await old('legacy-publish',{actor:'maker',action:{type:'publish',terms:t,fee:'2',funding:[]}});
  const r=await old('legacy-admit',{actor:'buyer',action:{type:'admit',edition_id:p.result,expected_version:'1',expected_fee:'2',loadout_ids:['buyer-club'],seed:'42'}});assert.equal(r.run.seed,'42');
  await old('legacy-list',{actor:'maker',action:{type:'list',item_ids:['maker-fine-tonic-0'],unit_price:'3'}});
  await old('legacy-shop',{actor:'maker',action:{type:'create_shop',...shop}});
  const deadline_ms=String(BigInt(await f.view('clock_ms'))+600000n);
  await old('legacy-craft',{actor:'maker',action:{type:'begin_craft',batch_id:'old-craft',input_ids:inputs('maker'),challenge_commitment:commitment,deadline_ms}});
  await old('legacy-recovery',{actor:'worker',action:{type:'begin_recovery',batch_id:'old-recovery',bank_input_ids:inputs('bank'),challenge_commitment:commitment,deadline_ms}});
  const before=await f.view();await f.operator.deployContract(readFileSync(wasm));assert.deepEqual(await f.view(),before);
  for(const {id,command,receipt} of records){assert.deepEqual(await f.view('operation',{op_id:id}),receipt);assert.equal(await f.view('command_hash',{command}),commandHash(command));assert.deepEqual(await f.execute(id,command),receipt);}
  assert.deepEqual(await f.view(),before);
  const profile=await f.register();assert.deepEqual(await f.view(),{...before,credits:{...before.credits,[profile]:'0'}});
  assert.equal((await f.execute('legacy-finish-run',{actor:'buyer',action:{type:'settle',run_id:r.result,outcome:'extracted',carried_dungeon_ids:[],disposition:{...empty(),town_returned:['buyer-club']}}})).status,'Applied');
  for(const [actor,type,batch_id] of [['maker','finish_craft','old-craft'],['worker','finish_recovery','old-recovery']] as const){const c:Command={actor,action:{type,batch_id,tier:'fine',reason:'completed'}};const receipt=await f.execute('finish-'+batch_id,c);assert.equal(receipt.status,'Applied');assert.deepEqual(await f.execute('finish-'+batch_id,c),receipt);}
  const final=await f.view();assert.equal(final.credits[profile],'0');assert.equal(final.credits.buyer,'8');assert.equal(final.credits.worker,'2');assert.equal(final.runs[0].status,'extracted');
  console.log('Upgrade proof: active run + paid escrow + craft/recovery reservations + listing + shop + six receipts preserved without migration; legacy terminals still settle.');
 }finally{await f.close();}
});


test('WASM wallet recovery starts bind batch identity and chain deadline; replay never resets the window',{timeout:120000},async()=>{
 const f=await fixture();try{
  const actor=await f.register();await f.register(1);
  const id=playerOperationId(f.accounts[0].accountId,'recover');
  const action:Command['action']={type:'begin_recovery',batch_id:id,bank_input_ids:inputs('bank'),challenge_commitment:commitment,deadline_ms:'0'};
  assert.equal(isPlayerAction(action),true);
  await f.denied(()=>f.player(1,'recover',action));
  await f.denied(()=>f.player(0,'recover',{...action,deadline_ms:'1'}));
  await f.denied(()=>f.execute('operator-start',{actor,action}));
  const before=Number(await f.view('clock_ms'));
  const receipt=await f.player(0,'recover',action);assert.equal(receipt.status,'Applied');assert.equal(receipt.result,id);
  assert.equal(receipt.payload_hash,commandHash({actor,action}));
  const world=await f.view(),batch=world.batches.find((b:any)=>b.id===id);
  assert.equal(batch.actor,actor);assert.equal(batch.recovery,true);assert.equal(batch.status,'active');
  assert.ok(Number(batch.deadline_ms)>=before+120000);
  assert.ok(Number(batch.deadline_ms)<=Number(await f.view('clock_ms'))+120000);
  assert.deepEqual(await f.player(0,'recover',action),receipt);assert.deepEqual(await f.view(),world);
  await f.denied(()=>f.player(0,'recover',{...action,challenge_commitment:'cd'.repeat(32)}));
  await f.denied(()=>f.player(0,'forge-finish',{type:'finish_recovery',batch_id:id,tier:'fine',reason:'completed'}));
  const premature=await f.execute('premature',{actor,action:{type:'finish_recovery',batch_id:id,tier:'normal',reason:'expired'}});
  assert.equal(premature.result,'PrematureExpiry');assert.deepEqual(await f.view(),world);
  const finished=await f.execute('oracle-finish',{actor,action:{type:'finish_recovery',batch_id:id,tier:'fine',reason:'completed'}});
  assert.equal(finished.status,'Applied');assert.deepEqual(await f.player(0,'recover',action),receipt);
  const final=await f.view();assert.equal(final.batches.find((b:any)=>b.id===id).status,'finished');
  assert.equal(final.credits[actor],world.batches.find((b:any)=>b.id===id).wage_reserved);
  for(const item of final.items.filter((i:any)=>i.id.startsWith('crafted-'+id)))assert.deepEqual(item.location,{kind:'bank'});
  assert.equal(final.items.filter((i:any)=>i.id.startsWith('crafted-'+id)).length,2);
  const craftId=playerOperationId(f.accounts[0].accountId,'unowned');
  const unowned=await f.player(0,'unowned',{type:'begin_craft',batch_id:craftId,input_ids:inputs('maker'),challenge_commitment:commitment,deadline_ms:'0'});
  assert.equal(unowned.result,'UnownedInput');assert.deepEqual(await f.view(),final);
 }finally{await f.close();}
});


test('WASM wallet crafts its extracted supplies and can list the confirmed finite outputs',{timeout:120000},async()=>{
 const f=await fixture();try{
  const actor=await f.register(),materials=inputs('maker');
  const t={...freeTerms(Number(await f.view('clock_ms'))),no_reward:false,sockets:['herb','herb','flask','flask'].map((reward,i)=>({id:'s'+i,room:0,slot:i,enemy:'none' as const,trap:false,reward:reward as 'herb'|'flask'}))};
  const published=await f.execute('supplies',{actor:'maker',action:{type:'publish',terms:t,fee:'0',funding:materials}});assert.equal(published.status,'Applied');
  const entered=await f.player(0,'gather',admit(published.result));assert.equal(entered.status,'Applied');
  assert.equal((await f.execute('extracted',{actor,action:{type:'settle',run_id:entered.result,outcome:'extracted',carried_dungeon_ids:materials,disposition:{...empty(),dungeon_extracted:materials}}})).status,'Applied');
  const id=playerOperationId(f.accounts[0].accountId,'make');
  const action:Command['action']={type:'begin_craft',batch_id:id,input_ids:materials,challenge_commitment:commitment,deadline_ms:'0'};
  const started=await f.player(0,'make',action);assert.equal(started.status,'Applied');assert.equal(started.payload_hash,commandHash({actor,action}));
  assert.equal((await f.execute('craft-result',{actor,action:{type:'finish_craft',batch_id:id,tier:'fine',reason:'completed'}})).status,'Applied');
  const world=await f.view(),batch=world.batches.find((b:any)=>b.id===id);assert.equal(batch.output_ids.length,2);
  for(const output of batch.output_ids){const item=world.items.find((i:any)=>i.id===output);assert.equal(item.item_type,'fineTonic');assert.deepEqual(item.location,{kind:'owned',profile:actor});}
  const listing=await f.player(0,'sell-batch',{type:'list',item_ids:batch.output_ids,unit_price:'3'});assert.equal(listing.status,'Applied');
  assert.deepEqual(await f.player(0,'make',action),started);
 }finally{await f.close();}
});
