import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {register} from 'node:module';
// Node renders markup only; CSS is verified by the browser build, not this loader.
register('data:text/javascript,'+encodeURIComponent("export async function load(url,context,next){return url.endsWith('.css')?{format:'module',source:'export default {}',shortCircuit:true}:next(url,context);}"));
const {WalletGame,createWalletGameConnection}=await import('../src/WalletGame');
import {WalletOnboarding} from '../src/WalletOnboarding';
import type {CommandResult} from '../src/wallet-transport';
const config={origin:'http://127.0.0.1:18930',network:'sandbox',contractId:'economy.testnet'};
const session={accountId:'alice.testnet',profileId:'wallet:alice.testnet',publicKey:'ed25519:abc',expiresAtMs:900000};

test('no adapter renders honest onboarding without making requests or signing',()=>{
 const html=renderToStaticMarkup(React.createElement(WalletGame,{config}));
 assert.match(html,/No connected wallet adapter/);assert.match(html,/game-stage/);
 assert.doesNotMatch(html,/Play as|Register player with wallet|Sign in with wallet|start.*sandbox/);
});
test('sign-in and registration are distinct explicit onboarding actions in the fixed frame',()=>{
 const props={connected:true,authenticated:false,busy:false,network:config.network,contractId:config.contractId,accountId:session.accountId};
 const signin=renderToStaticMarkup(React.createElement(WalletOnboarding,props));
 assert.match(signin,/Sign in with wallet/);assert.doesNotMatch(signin,/Register player with wallet/);
 const registered=renderToStaticMarkup(React.createElement(WalletOnboarding,{...props,authenticated:true}));
 assert.match(registered,/Register player with wallet/);assert.match(registered,/Check registration/);
 assert.doesNotMatch(registered,/Sign in with wallet/);assert.match(registered,/inset:0/);assert.match(registered,/overflow-y:auto/);
});
function seam(){
 let valid=true,status:CommandResult['status']='Unknown';const calls:any[]=[];
 const craft={id:'batch',profile:session.profileId,status:'active'};
 const transport={execute:async(id:string,action:any)=>{calls.push(['execute',id,action]);return {id,status} as CommandResult;},beginCraft:async(id:string,inputs:readonly string[],recovery?:boolean)=>{calls.push(['begin',id,inputs,recovery]);return {id:'batch',status,result:'RejectedRecipe'} as CommandResult;}};
 const connection=createWalletGameConnection({config,session,transport,sessionControls:null,guard:()=>{if(!valid)throw Error('identity changed');},guardedRequest:async(path,body)=>{calls.push([path,body]);return path==='world'?{craft}:craft;}});
 return {connection,calls,craft,setStatus:(s:typeof status)=>{status=s;},invalidate:()=>{valid=false;}};
}
test('wallet command seam uses exact caller request and refuses a stale identity',async()=>{
 const f=seam(),action={type:'bank_sell' as const,item_ids:['one'],expected_unit_prices:['2']};
 await f.connection.execute('original',action);assert.deepEqual(f.calls,[['execute','original',action]]);
 f.invalidate();await assert.rejects(f.connection.execute('other',action),/identity changed/);assert.equal(f.calls.length,1);
});
test('craft begin keeps uncertain preparation pending; confirmed begin reads authoritative view',async()=>{
 const f=seam(),body={id:'original',inputIds:['a','b','c','d'],recovery:true};
 await assert.rejects(f.connection.craft('begin',body),/Awaiting wallet confirmation/);
 assert.deepEqual(f.calls,[['begin','original',body.inputIds,true]]);
 f.setStatus('Applied');assert.equal(await f.connection.craft('begin',body),f.craft);
 assert.deepEqual(f.calls.at(-1),['world',undefined]);
 f.craft.id='another';await assert.rejects(f.connection.craft('begin',body),/not yet available/);
});
test('definitively rejected craft permits clearing UI retry while step events never invoke wallet approval',async()=>{
 const f=seam();f.setStatus('Rejected');
 await assert.rejects(f.connection.craft('begin',{id:'r',inputIds:['a','b','c','d']}),(e:any)=>e.terminal===true);
 f.calls.length=0;const body={id:'input',batch:'batch',seq:1,step:0};
 await f.connection.craft('input',body);assert.deepEqual(f.calls,[['craft/input',body]]);
});
test('wallet UI retry scope separates contract and account without using demo keys',()=>{
 const f=seam();assert.deepEqual(JSON.parse(f.connection.storageScope),[config.origin,config.network,config.contractId,session.accountId]);
});
