import test from 'node:test';
import assert from 'node:assert/strict';
import {httpServer} from '../src/http';
import {WalletSessions} from '../src/wallet-auth';
import type {Outbox} from '../src/outbox';
import type {Runs} from '../src/runs';
import type {AddressInfo} from 'node:net';

test('unauthenticated configuration exposes exact mode and destination without chain reads or session creation',async()=>{
 for(const walletMode of [false,true]){
  const binding={origin:'http://127.0.0.1:18930',network:'local-sandbox',contractId:'economy.local'};
  const walletSessions=new WalletSessions({...binding,provider:{} as any,secureCookies:false});
  const app=httpServer({db:{}} as Outbox,{} as Runs,async()=>{throw Error('Config must not read chain');},undefined,walletMode?{...binding,walletSessions}:undefined);
  await new Promise<void>(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  try{
   const response=await fetch('http://127.0.0.1:'+(app.server.address() as AddressInfo).port+'/api/config');assert.equal(response.status,200);assert.equal(response.headers.get('set-cookie'),null);assert.equal(response.headers.get('cache-control'),'no-store');
   const value=await response.json();if(walletMode)assert.deepEqual(value,{authMode:'wallet',...binding});else{assert.equal(value.authMode,'demo');assert.equal(typeof value.label,'string');assert.deepEqual(Object.keys(value).sort(),['authMode','label']);}
  }finally{await new Promise<void>(resolve=>app.server.close(()=>resolve()));}
 }
});
