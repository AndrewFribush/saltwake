import test from 'node:test';import assert from 'node:assert/strict';import type {AddressInfo} from 'node:net';
import {httpServer} from '../src/http';import {DemoSessions} from '../src/auth';import type {Outbox} from '../src/outbox';import type {Runs} from '../src/runs';
test('operator moderation over HTTP: session required, reports listed, time-out silences chat',async()=>{
 const app=httpServer({db:{}} as Outbox,{} as Runs,async()=>{throw Error('no economy');},new DemoSessions({profiles:['buyer','p4'],secureCookies:false}));
 await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+(app.server.address() as AddressInfo).port;
 const login=async()=>{const r=await fetch(base+'/api/session',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:'{}'});return r.headers.get('set-cookie')!.split(';')[0];};
 const post=(c:string,p:string,b:unknown)=>fetch(base+'/api/'+p,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:c},body:JSON.stringify(b)});
 try{
  assert.equal((await fetch(base+'/api/moderation/reports')).status,401);
  const op=await login(),rude=await login();
  const s1=await fetch(base+'/api/presence/stream',{headers:{Cookie:op}}),s2=await fetch(base+'/api/presence/stream',{headers:{Cookie:rude}});await new Promise(r=>setTimeout(r,100));
  await post(op,'presence/move',{district:'center',x:1,y:1,facing:'down'});await post(rude,'presence/move',{district:'center',x:2,y:1,facing:'down'});
  const m=await (await post(rude,'presence/chat',{text:'bad'})).json() as any;
  assert.equal((await post(op,'presence/report',{messageId:m.id,from:'p4',text:'bad'})).status,200);
  const list=await (await fetch(base+'/api/moderation/reports',{headers:{Cookie:op}})).json() as any;assert.equal(list.reports[0].from,'p4');
  assert.equal((await post(op,'moderation/timeout',{player:'p4',minutes:99})).status,400);
  assert.equal((await post(op,'moderation/timeout',{player:'p4',minutes:5})).status,200);
  assert.equal((await post(rude,'presence/chat',{text:'again'})).status,403);
  await s1.body?.cancel();await s2.body?.cancel();
 }finally{await new Promise<void>(r=>app.server.close(()=>r()));}
});
