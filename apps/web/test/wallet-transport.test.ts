import test from 'node:test';
import assert from 'node:assert/strict';
import {WalletTransport,walletOperationId,type InjectedWalletAdapter,type WalletIdentity,type WalletPost,type WalletTransaction} from '../src/wallet-transport';
import type {Command} from '../../../packages/shared/src/types';
const config={origin:'http://127.0.0.1:18930',network:'sandbox',contractId:'economy.testnet'};
const action:Command['action']={type:'bank_buy',item_ids:['item-1'],expected_unit_prices:['2']};
function setup(storage?:Pick<Storage,'getItem'|'setItem'>){
 let now=1000,identity:WalletIdentity|null={accountId:'alice.testnet',network:'sandbox',revision:0};
 let session={accountId:'alice.testnet',profileId:'wallet:alice.testnet',publicKey:'ed25519:abc',expiresAtMs:900000};
 const calls:{path:string;body:any}[]=[],transactions:WalletTransaction[]=[],messages:any[]=[];
 let applied=false,mutate:(path:string,value:any)=>any=(_p,v)=>v;
 const proof={accountId:'alice.testnet',publicKey:'ed25519:abc',signature:'A'.repeat(86)+'=='};
 const adapter:InjectedWalletAdapter={identity:()=>identity,signMessage:async input=>{messages.push(input);return proof;},approveTransaction:async input=>{transactions.push(structuredClone(input.transaction));applied=true;return {status:'submitted',accountId:input.accountId,network:input.network};}};
 const post:WalletPost=async(path,body)=>{
  calls.push({path,body:structuredClone(body)});let value:any;
  if(path==='wallet/challenge'){const binding={purpose:'Saltwake sign-in only; does not authorize transactions',...config,accountId:'alice.testnet',issuedAtMs:now,expiresAtMs:now+120000};value={challenge:{accountId:'alice.testnet',recipient:config.contractId,message:JSON.stringify(binding),nonce:btoa('\0'.repeat(32)),expiresAtMs:binding.expiresAtMs}};}
  else if(path==='wallet/verify')value={authMode:'wallet',session:{...session}};
  else if(path==='session')value={authMode:'wallet',network:config.network,contractId:config.contractId,session:{...session},registered:true};
  else if(path==='wallet/register')value={authMode:'wallet',accountId:session.accountId,transaction:{receiverId:config.contractId,methodName:'register_player',args:{},gas:'100000000000000',deposit:'0'}};
  else if(path==='craft/begin'){const b=body as any,id=await walletOperationId(session.accountId,b.id),common={batch_id:id,challenge_commitment:'ab'.repeat(32),deadline_ms:'0'};const action=b.recovery?{type:'begin_recovery',...common,bank_input_ids:b.inputIds}:{type:'begin_craft',...common,input_ids:b.inputIds};value={id,profile:session.profileId,recovery:b.recovery,transaction:{receiverId:config.contractId,methodName:'execute_player',args:{request_id:b.id,action},gas:'100000000000000',deposit:'0'}};}
  else if(path==='command'){const b=body as any;value={id:await walletOperationId('alice.testnet',b.id),status:applied?'Applied':'Unknown',transaction:{receiverId:config.contractId,methodName:'execute_player',args:{request_id:b.id,action:b.action},gas:'100000000000000',deposit:'0'}};}
  else if(path==='wallet/logout')value={authMode:'wallet',session:null};
  else throw Error('Unexpected path '+path);
  return mutate(path,value);
 };
 const transport=new WalletTransport(config,adapter,post,()=>now,storage);
 return {transport,adapter,calls,transactions,messages,proof,setIdentity:(v:WalletIdentity|null)=>identity=v,setSession:(v:Partial<typeof session>)=>session={...session,...v},advance:(ms:number)=>now+=ms,mutate:(f:typeof mutate)=>mutate=f};
}
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>resolve=r);return {promise,resolve};}

test('NEP413 binding and exact account-bound register/execute descriptors',async()=>{
 const f=setup();await f.transport.login();assert.equal(f.messages.length,1);assert.equal(f.messages[0].accountId,'alice.testnet');assert.equal(f.messages[0].network,config.network);assert.equal(f.messages[0].recipient,config.contractId);assert.deepEqual(f.messages[0].nonce,new Uint8Array(32));
 await f.transport.register();assert.deepEqual(f.transactions[0],{receiverId:config.contractId,methodName:'register_player',args:{},gas:'100000000000000',deposit:'0'});
 // Registration in this fake adapter has no command receipt side effect relevant to approval.
 f.mutate((path,value)=>path==='command'?{...value,status:f.transactions.length>1?'Applied':'Unknown'}:value);
 const result=await f.transport.execute('stable-1',action);assert.equal(result.status,'Applied');assert.deepEqual(f.transactions[1],{receiverId:config.contractId,methodName:'execute_player',args:{request_id:'stable-1',action},gas:'100000000000000',deposit:'0'});
 const commands=f.calls.filter(c=>c.path==='command');assert.equal(commands.length,2);assert.deepEqual(commands[0].body,commands[1].body);assert.equal(commands[0].body.expectedProfile,'wallet:alice.testnet');
 await f.transport.execute('stable-1',action);assert.equal(f.transactions.length,2);await assert.rejects(f.transport.execute('stable-1',{...action,item_ids:['changed']}),/payload conflict/);
});

test('changed account, network, or away-and-back revision during NEP413 signing invalidates proof',async()=>{
 for(const changed of [{accountId:'bob.testnet',network:'sandbox',revision:1},{accountId:'alice.testnet',network:'mainnet',revision:1},{accountId:'alice.testnet',network:'sandbox',revision:2}]){
  const f=setup(),gate=deferred<typeof f.proof>(),entered=deferred<void>();f.adapter.signMessage=async()=>{entered.resolve();return gate.promise;};
  const login=f.transport.login();await entered.promise;f.setIdentity(changed);gate.resolve(f.proof);await assert.rejects(login,/identity\/session changed/);assert.equal(f.calls.filter(c=>c.path==='wallet/verify').length,0);
 }
});

test('cancelled and rejected message signing never verifies or grants a local session',async()=>{
 for(const reject of [false,true]){const f=setup();f.adapter.signMessage=async()=>{if(reject)throw Error('User rejected');return null;};await assert.rejects(f.transport.login(),reject?/User rejected/:/cancelled/);assert.equal(f.calls.some(c=>c.path==='wallet/verify'),false);await assert.rejects(f.transport.register(),/login required/);}
});

test('wrong configured network or challenge contract is rejected before signing',async()=>{
 const wrong=setup();wrong.setIdentity({accountId:'alice.testnet',network:'mainnet',revision:0});await assert.rejects(wrong.transport.login(),/network mismatch/);assert.equal(wrong.calls.length,0);
 const f=setup();f.mutate((path,v)=>{if(path==='wallet/challenge')v.challenge.recipient='evil.testnet';return v;});await assert.rejects(f.transport.login(),/challenge binding/);assert.equal(f.messages.length,0);
});

test('reject altered destination, method, deposit, gas, args and extra transaction fields',async()=>{
 for(const route of ['wallet/register','command'])for(const patch of [{receiverId:'evil.testnet'},{methodName:'execute'},{deposit:'1'},{gas:'300000000000000'},{args:{request_id:'substituted'}},{extra:'unapproved'}]){
  const f=setup();await f.transport.login();f.mutate((path,v)=>{if(path===route)Object.assign(v.transaction,patch);return v;});await assert.rejects(route==='command'?f.transport.execute('stable',action):f.transport.register(),/Unsafe wallet transaction/);assert.equal(f.transactions.length,0);
 }
});

test('account change during transaction approval discards its result and does not receipt-sync',async()=>{
 const f=setup();await f.transport.login();const gate=deferred<Awaited<ReturnType<InjectedWalletAdapter['approveTransaction']>>>(),entered=deferred<void>();
 f.adapter.approveTransaction=async()=>{entered.resolve();return gate.promise;};const command=f.transport.execute('change',action);await entered.promise;f.setIdentity({accountId:'bob.testnet',network:'sandbox',revision:1});gate.resolve({status:'submitted',accountId:'alice.testnet',network:'sandbox'});await assert.rejects(command,/identity\/session changed/);assert.equal(f.calls.filter(c=>c.path==='command').length,1);
});

test('session invalidation and expiry during signing invalidate results',async()=>{
 for(const expire of [false,true]){
  const f=setup();await f.transport.login();const entered=deferred<void>(),gate=deferred<Awaited<ReturnType<InjectedWalletAdapter['approveTransaction']>>>();f.adapter.approveTransaction=async()=>{entered.resolve();return gate.promise;};
  const command=f.transport.execute('change',action);await entered.promise;if(expire)f.advance(900000);else f.transport.invalidateSession();gate.resolve({status:'submitted',accountId:'alice.testnet',network:'sandbox'});await assert.rejects(command,/changed|expired/);
 }
});

test('server session changed during approval blocks receipt sync',async()=>{
 const f=setup();await f.transport.login();f.adapter.approveTransaction=async()=>{f.setSession({expiresAtMs:800000});return {status:'submitted',accountId:'alice.testnet',network:'sandbox'};};await assert.rejects(f.transport.execute('renewed',action),/session changed/);assert.equal(f.calls.filter(c=>c.path==='command').length,1);
});

test('explicit approval cancellation/rejection permits same-ID retry; ambiguous SDK failure does not resubmit',async()=>{
 for(const status of ['cancelled','rejected'] as const){const f=setup();await f.transport.login();let approvals=0;f.adapter.approveTransaction=async()=>{approvals++;return {status};};await assert.rejects(f.transport.execute('retry',action),new RegExp(status));await assert.rejects(f.transport.execute('retry',action),new RegExp(status));assert.equal(approvals,2);assert.deepEqual(f.calls.filter(c=>c.path==='command').map(c=>c.body.id),['retry','retry']);}
 const f=setup();await f.transport.login();let approvals=0;f.adapter.approveTransaction=async()=>{approvals++;throw Error('Lost wallet response after possible broadcast');};await assert.rejects(f.transport.execute('uncertain',action),/Lost wallet/);assert.equal((await f.transport.execute('uncertain',action)).status,'Unknown');assert.equal(approvals,1);
});

test('logout invalidates pending proof and blocks new login until logout completes',async()=>{
 const f=setup(),gate=deferred<typeof f.proof>(),entered=deferred<void>(),logoutGate=deferred<any>();f.adapter.signMessage=async()=>{entered.resolve();return gate.promise;};f.mutate((path,v)=>path==='wallet/logout'?logoutGate.promise:v);
 const login=f.transport.login();await entered.promise;const logout=f.transport.logout();gate.resolve(f.proof);await assert.rejects(login,/changed/);await assert.rejects(f.transport.login(),/pending/);logoutGate.resolve({});await logout;assert.equal(f.calls.some(c=>c.path==='wallet/verify'),false);
});

test('wrong proof account and server session network are rejected before transaction approval',async()=>{
 const proof=setup();proof.adapter.signMessage=async()=>({...proof.proof,accountId:'bob.testnet'});await assert.rejects(proof.transport.login(),/Invalid wallet proof/);assert.equal(proof.calls.some(c=>c.path==='wallet/verify'),false);
 const session=setup();await session.transport.login();session.mutate((path,v)=>path==='session'?{...v,network:'mainnet'}:v);await assert.rejects(session.transport.register(),/session binding mismatch/);assert.equal(session.transactions.length,0);
});

test('action is copied before awaits; concurrent approvals are rejected',async()=>{
 const f=setup();await f.transport.login();const entered=deferred<void>(),gate=deferred<any>();let blocked=true;
 f.mutate((path,v)=>{if(path==='session'&&blocked){blocked=false;entered.resolve();return gate.promise.then(()=>v);}return v;});
 const mutable={type:'bank_buy' as const,item_ids:['item-1'],expected_unit_prices:['2']};const command=f.transport.execute('copied',mutable);await entered.promise;
 if(mutable.type==='bank_buy')mutable.item_ids.push('unapproved');
 await assert.rejects(f.transport.execute('concurrent',action),/already pending/);gate.resolve({});await command;
 assert.deepEqual(f.transactions[0].args,{request_id:'copied',action});
 await assert.rejects(f.transport.execute('copied',mutable),/payload conflict/);
});

test('browser Borsh SHA256 operation ID matches server identity helper',async()=>{
 const {playerOperationId}=await import('../../../packages/shared/src/player-identity');
 for(const [account,id] of [['alice.testnet','entry-1'],['bob.testnet','entry-1'],['a'.repeat(64),'z'.repeat(40)]])assert.equal(await walletOperationId(account,id),playerOperationId(account,id));
 assert.notEqual(await walletOperationId('alice.testnet','entry-1'),await walletOperationId('bob.testnet','entry-1'));
});

test('foreign account/request operation IDs reject before approval and after receipt confirmation',async()=>{
 for(const wrongId of [await walletOperationId('bob.testnet','entry'),await walletOperationId('alice.testnet','other'),'anything']){
  const f=setup();await f.transport.login();f.mutate((path,v)=>path==='command'?{...v,id:wrongId}:v);await assert.rejects(f.transport.execute('entry',action),/Invalid command receipt/);assert.equal(f.transactions.length,0);
 }
 const f=setup();await f.transport.login();let reads=0;f.mutate((path,v)=>path==='command'&&++reads===2?{...v,id:'wrong-confirmed-id'}:v);await assert.rejects(f.transport.execute('entry',action),/Invalid command receipt/);assert.equal(f.transactions.length,1);
});


test('reload preserves uncertain approval and exact payload without resubmitting',async()=>{
 const values=new Map<string,string>(),storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v)}};
 const first=setup(storage);await first.transport.login();let approvals=0;
 first.adapter.approveTransaction=async()=>{approvals++;throw Error('lost response');};
 await assert.rejects(first.transport.execute('persisted',action),/lost response/);
 const second=setup(storage);await second.transport.resume();assert.equal(second.messages.length,0);
 const result=await second.transport.execute('persisted',action);assert.equal(result.status,'Unknown');assert.equal(second.transactions.length,0);assert.equal(approvals,1);
 await assert.rejects(second.transport.execute('persisted',{...action,expected_unit_prices:['999']} as Command['action']),/payload conflict/);
 assert.equal(values.size,1);assert.ok([...values.keys()][0].includes(config.contractId));
 assert.ok(![...values.values()][0].includes('publicKey'));
});

test('durable write failure prevents approval and corrupt saved intents are not silently discarded',async()=>{
 const storage={getItem:()=>null,setItem:()=>{throw Error('storage full')}};
 const f=setup(storage);await f.transport.login();await assert.rejects(f.transport.execute('store-fail',action),/storage full/);assert.equal(f.transactions.length,0);
 assert.throws(()=>setup({getItem:()=>'{broken',setItem:()=>{}}),/Saved wallet requests are invalid/);
});

test('explicit wallet cancellation remains retryable after reload',async()=>{
 const values=new Map<string,string>(),storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v)}};
 const first=setup(storage);await first.transport.login();first.adapter.approveTransaction=async()=>({status:'cancelled'});
 await assert.rejects(first.transport.execute('cancelled',action),/cancelled/);
 const second=setup(storage);await second.transport.resume();assert.equal((await second.transport.execute('cancelled',action)).status,'Applied');assert.equal(second.transactions.length,1);
});


test('prepared crafting binds input copies, account batch, commitment and chain deadline before approval',async()=>{
 for(const recovery of [false,true]){
  const f=setup();await f.transport.login();const ids=['h1','h2','f1','f2'];
  assert.equal((await f.transport.beginCraft('batch',ids,recovery)).status,'Applied');
  const tx=f.transactions[0],a=tx.args.action as any;assert.equal(a.type,recovery?'begin_recovery':'begin_craft');assert.equal(a.deadline_ms,'0');
  assert.deepEqual(a[recovery?'bank_input_ids':'input_ids'],ids);assert.equal(a.batch_id,await walletOperationId('alice.testnet','batch'));
 }
 for(const patch of [{batch_id:'foreign'},{deadline_ms:'1'},{input_ids:['substitute']},{type:'finish_craft'},{challenge_commitment:'bad'}]){
  const f=setup();await f.transport.login();f.mutate((path,v)=>{if(path==='craft/begin')Object.assign(v.transaction.args.action,patch);return v;});
  await assert.rejects(f.transport.beginCraft('batch',['h1','h2','f1','f2']),/Unsafe wallet transaction|Invalid prepared/);assert.equal(f.transactions.length,0);
 }
});

test('identity change during preparation cannot open a crafting approval',async()=>{
 const f=setup();await f.transport.login();f.mutate((path,v)=>{if(path==='craft/begin')f.setIdentity({accountId:'bob.testnet',network:'sandbox',revision:1});return v;});
 await assert.rejects(f.transport.beginCraft('batch',['h1','h2','f1','f2']),/identity\/session changed/);assert.equal(f.transactions.length,0);
});
