import test from 'node:test';
import assert from 'node:assert/strict';
import type {AddressInfo} from 'node:net';
import {TownPresence,PresenceError,normalizeChat,presenceIdentity,type PresenceStream} from '../src/presence';
import {httpServer} from '../src/http';
import {DemoSessions} from '../src/auth';
import type {Outbox} from '../src/outbox';
import type {Runs} from '../src/runs';

type Got={event:string;data:any};
function fakeStream(){const got:Got[]=[];let ended=false;const stream:PresenceStream={send:(event,data)=>{if(!ended)got.push({event,data:JSON.parse(JSON.stringify(data))});},end:()=>{ended=true;}};return {stream,got,ended:()=>ended,events:(name:string)=>got.filter(g=>g.event===name).map(g=>g.data)};}
const status=(code:number)=>(e:unknown)=>e instanceof PresenceError&&e.status===code;
const at=(district:string|null,x:number,y:number,facing='down')=>({district,x,y,facing});

test('join, move, district change and leave are relayed only within a district',()=>{
 let now=1_000;const town=new TownPresence({now:()=>now});
 const a=fakeStream(),b=fakeStream(),c=fakeStream();
 const offA=town.connect('buyer',a.stream);town.connect('maker',b.stream);town.connect('p2',c.stream);
 assert.deepEqual(a.events('hello'),[{you:'buyer'}]);
 now+=100;town.move('buyer',at('center',12,8));now+=100;town.move('maker',at('center',13,8));now+=100;town.move('p2',at('n',5,5));
 // maker arrives after buyer: buyer hears the join, maker's snapshot already lists buyer.
 assert.deepEqual(a.events('join').map(j=>j.player.id),['maker']);
 assert.deepEqual(b.events('snapshot').at(-1).players.map((p:any)=>p.id),['buyer']);
 assert.equal(c.events('join').length,0,'other districts hear nothing');
 now+=100;town.move('buyer',at('center',12,7,'up'));
 assert.deepEqual(b.events('move').at(-1),{player:{id:'buyer',district:'center',x:12,y:7,facing:'up'}});
 assert.equal(a.events('move').length,0,'no echo to the mover');
 now+=100;town.move('buyer',at('n',12,15));
 assert.deepEqual(b.events('leave').at(-1),{id:'buyer'});
 assert.deepEqual(c.events('join').at(-1).player.id,'buyer');
 assert.deepEqual(a.events('snapshot').at(-1).players.map((p:any)=>p.id),['p2']);
 now+=100;town.move('buyer',at(null,0,0));
 assert.deepEqual(c.events('leave').at(-1),{id:'buyer'},'going indoors hides you');
 now+=100;town.move('buyer',at('n',4,4));offA();
 assert.deepEqual(c.events('leave').at(-1),{id:'buyer'});assert.equal(town.player('buyer'),undefined);
});

test('moves are validated and throttled; unknown players are refused',()=>{
 let now=0;const town=new TownPresence({now:()=>now,moveMinMs:40});const a=fakeStream();
 assert.throws(()=>town.move('ghost',at('center',1,1)),status(409));
 town.connect('buyer',a.stream);
 for(const bad of [at('atlantis',1,1),at('center',24,1),at('center',-1,1),at('center',1.5,1),at('center',1,16),{district:'center',x:'1',y:1,facing:'up'},at('center',1,1,'sideways'),undefined])assert.throws(()=>town.move('buyer',bad),status(400));
 now=100;assert.equal(town.move('buyer',at('center',3,8)),true);
 now=120;assert.equal(town.move('buyer',at('center',4,8)),false);assert.equal(town.player('buyer')!.x,3);
 now=141;assert.equal(town.move('buyer',at('center',4,8)),true);
});

test('chat is normalized, length-limited, rate-limited and kept as short district history',()=>{
 let now=10_000;const town=new TownPresence({now:()=>now,chatMax:20,chatBurst:3,chatWindowMs:10_000});
 const a=fakeStream(),b=fakeStream(),far=fakeStream();
 town.connect('buyer',a.stream);town.connect('maker',b.stream);town.connect('p3',far.stream);
 assert.throws(()=>town.chat('buyer','hi'),status(409),'indoors/unplaced players cannot talk');
 town.move('buyer',at('center',5,8));now+=50;town.move('maker',at('center',6,8));now+=50;town.move('p3',at('se',6,8));
 const m=town.chat('buyer','  <b>hi</b>\u0007\n there‮ ');
 assert.equal(m.text,'<b>hi</b> there',"markup is kept as inert text; control/bidi characters are stripped");
 assert.equal(m.from,'buyer');
 assert.deepEqual(b.events('chat').map(c=>c.text),['<b>hi</b> there']);
 assert.deepEqual(a.events('chat').map(c=>c.text),['<b>hi</b> there'],'sender gets the normalized echo');
 assert.equal(far.events('chat').length,0);
 for(const bad of ['','   ','x'.repeat(21),42,null])assert.throws(()=>town.chat('maker',bad),status(400));
 assert.equal(normalizeChat('🦀'.repeat(20),20).length,40,'limit counts characters, not UTF-16 units');
 town.chat('buyer','two');town.chat('buyer','three');
 assert.throws(()=>town.chat('buyer','four'),status(429));
 now+=10_001;town.chat('buyer','later');
 const late=fakeStream();town.connect('p4',late.stream);now+=50;town.move('p4',at('center',7,8));
 assert.deepEqual(late.events('snapshot').at(-1).chat.map((c:any)=>c.text),['<b>hi</b> there','two','three','later']);
});

test('stale players are dropped and their streams closed; live ones stay',()=>{
 let now=0;const town=new TownPresence({now:()=>now,staleMs:20_000});
 const quiet=fakeStream(),live=fakeStream();
 town.connect('buyer',quiet.stream);town.connect('maker',live.stream);
 town.move('buyer',at('center',5,8));town.move('maker',at('center',6,8));
 for(let t=5_000;t<=25_000;t+=5_000){now=t;town.move('maker',at('center',6,8));town.sweep();}
 assert.equal(quiet.ended(),true);assert.equal(town.player('buyer'),undefined);
 assert.deepEqual(live.events('leave').at(-1),{id:'buyer'});
 assert.equal(live.ended(),false);assert.ok(town.player('maker'));
});

test('capacity limits: players per town and streams per player',()=>{
 const town=new TownPresence({maxPlayers:2,maxStreamsPerPlayer:2});
 town.connect('a',fakeStream().stream);town.connect('b',fakeStream().stream);
 assert.throws(()=>town.connect('c',fakeStream().stream),status(503));
 const s1=fakeStream(),s2=fakeStream(),s3=fakeStream();
 town.connect('a',s1.stream);town.connect('a',s2.stream);
 assert.equal(s1.ended(),false);town.connect('a',s3.stream);
 assert.equal(town.size,2);
});

test('identity comes only from the server session',()=>{
 const sessions=new DemoSessions({profiles:['buyer'],secureCookies:false});const cookie=sessions.create().setCookie.split(';')[0];
 assert.equal(presenceIdentity(sessions)(cookie),'buyer');
 assert.equal(presenceIdentity({requireProfile:()=>'wallet:alice.testnet'})('x'),'alice.testnet');
 assert.throws(()=>presenceIdentity(sessions)(undefined));
});

/** Reads server-sent events from a fetch body. */
function sse(response:Response){
 const reader=response.body!.getReader();const decoder=new TextDecoder();let buffer='';const queue:Got[]=[];
 const next=async(name:string,timeoutMs=3000):Promise<any>=>{
  const deadline=Date.now()+timeoutMs;
  for(;;){
   const i=queue.findIndex(g=>g.event===name);if(i>=0)return queue.splice(i,1)[0].data;
   if(Date.now()>deadline)throw Error('Timed out waiting for '+name);
   const {value,done}=await Promise.race([reader.read(),new Promise<never>((_,reject)=>setTimeout(()=>reject(Error('Timed out waiting for '+name)),deadline-Date.now()))]);
   if(done)throw Error('Stream ended');buffer+=decoder.decode(value,{stream:true});
   let cut;while((cut=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,cut);buffer=buffer.slice(cut+2);const event=block.match(/^event: (.*)$/m)?.[1];const data=block.match(/^data: (.*)$/m)?.[1];if(event&&data)queue.push({event,data:JSON.parse(data)});}
  }
 };
 return {next,close:()=>reader.cancel()};
}

test('HTTP relay: two demo sessions see each other move and chat; session identity wins over request data',async()=>{
 const sessions=new DemoSessions({profiles:['buyer','maker'],secureCookies:false});
 const app=httpServer({db:{}} as Outbox,{} as Runs,async()=>{throw Error('Presence must not read chain');},sessions);
 await new Promise<void>(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+(app.server.address() as AddressInfo).port;
 const login=async()=>{const r=await fetch(base+'/api/session',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:'{}'});return r.headers.get('set-cookie')!.split(';')[0];};
 const post=(cookie:string,path:string,body:unknown,origin=base)=>fetch(base+'/api/presence/'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,Cookie:cookie},body:JSON.stringify(body)});
 try{
  assert.equal((await fetch(base+'/api/presence/stream')).status,401,'no session, no stream');
  const ca=await login(),cb=await login();
  const ra=await fetch(base+'/api/presence/stream',{headers:{Cookie:ca}}),rb=await fetch(base+'/api/presence/stream',{headers:{Cookie:cb}});
  assert.equal(ra.headers.get('content-type'),'text/event-stream; charset=utf-8');
  const a=sse(ra),b=sse(rb);
  assert.deepEqual(await a.next('hello'),{you:'buyer'});assert.deepEqual(await b.next('hello'),{you:'maker'});
  assert.equal((await post(ca,'move',{id:'maker',district:'center',x:12,y:8,facing:'down'})).status,200);
  assert.equal((await post(cb,'move',{district:'center',x:13,y:8,facing:'left'})).status,200);
  assert.deepEqual((await b.next('snapshot')).players.map((p:any)=>p.id),['buyer'],'a forged id field is ignored');
  assert.equal((await a.next('join')).player.id,'maker');
  await new Promise(r=>setTimeout(r,60));assert.equal((await post(ca,'move',{district:'center',x:12,y:7,facing:'up'})).status,200);
  assert.deepEqual((await b.next('move')).player,{id:'buyer',district:'center',x:12,y:7,facing:'up'});
  assert.equal((await post(cb,'chat',{text:'ahoy <script>',from:'buyer'})).status,200);
  assert.deepEqual(await a.next('chat').then(m=>[m.from,m.text]),['maker','ahoy <script>']);
  assert.equal((await post(ca,'chat',{text:'x'.repeat(161)})).status,400);
  assert.equal((await post(ca,'move',{district:'center',x:99,y:7,facing:'up'})).status,400);
  assert.equal((await post(ca,'chat',{text:'hi'},'http://evil.example')).status,403,'cross-origin posts refused');
  assert.equal((await fetch(base+'/api/presence/chat',{method:'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:ca},body:JSON.stringify({text:'y'.repeat(2000)})})).status,413);
  await b.close();
  assert.deepEqual(await a.next('leave'),{id:'maker'},'closing the tab leaves the town');
  await a.close();
 }finally{await new Promise<void>(resolve=>app.server.close(()=>resolve()));}
});

test('a cosmetic look id is relayed when valid and rejected when not',()=>{
 let now=1_000;const town=new TownPresence({now:()=>now});const a=fakeStream(),b=fakeStream();
 town.connect('buyer',a.stream);town.connect('maker',b.stream);
 now+=100;town.move('maker',at('center',13,8));
 now+=100;town.move('buyer',{...at('center',12,8),look:3});
 assert.equal(b.events('join').at(-1).player.look,3);
 now+=100;assert.throws(()=>town.move('buyer',{...at('center',12,7),look:99}),status(400));
 now+=100;assert.throws(()=>town.move('buyer',{...at('center',12,7),look:'gold'}),status(400));
 now+=100;town.move('buyer',at('center',12,6));assert.equal(b.events('move').at(-1).player.look,undefined,'omitted look stays omitted');
});
