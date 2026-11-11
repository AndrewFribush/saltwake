/** Load test for town presence: N simulated clients walk, cross districts, enter player-building rooms and chat
 * through the real HTTP presence relay (SSE + POST), then the server is restarted to measure reconnection, and some
 * clients freeze to measure stale cleanup.   npx tsx scripts/presence-load.ts [--clients 50] [--seconds 40]
 * Local only; the server runs in a child process so its CPU is measured separately from the clients. */
import {fork,type ChildProcess} from 'node:child_process';import {parseArgs} from 'node:util';
const {values:a}=parseArgs({options:{clients:{type:'string',default:'50'},seconds:{type:'string',default:'40'}}});
const N=Number(a.clients),SECONDS=Number(a.seconds);
const districts=['center','n','ne','e','se','s','sw','w','nw'];
let server!:ChildProcess;let port=0;
const start=(p=0)=>new Promise<number>(resolve=>{server=fork('scripts/presence-load-server.ts',[String(N),String(p)],{execArgv:['--import','tsx'],stdio:['ignore','inherit','inherit','ipc']});server.on('message',(m:any)=>{if(m.ready)resolve(m.ready);});});
const ask=()=>new Promise<any>(resolve=>{const h=(m:any)=>{if(m.stats){server.off('message',h);resolve(m.stats);}};server.on('message',h);server.send('stats');});
type Client={i:number;cookie:string;district:string;room?:string;x:number;y:number;frozen:boolean;received:number;events:Record<string,number>;latencies:number[];connected:boolean;reconnectedAt?:number;abort?:AbortController;leftSeen:Set<string>;me?:string};
const base=()=>'http://127.0.0.1:'+port;
const headers=(c:Client)=>({'Content-Type':'application/json',Origin:base(),Cookie:c.cookie});
async function login(c:Client){const r=await fetch(base()+'/api/session',{method:'POST',headers:{'Content-Type':'application/json',Origin:base()},body:'{}'});c.cookie=r.headers.get('set-cookie')!.split(';')[0];}
async function stream(c:Client){
 c.abort=new AbortController();
 try{const r=await fetch(base()+'/api/presence/stream',{headers:{Cookie:c.cookie},signal:c.abort.signal});if(r.status!==200)throw Error('status '+r.status);
  c.connected=true;const reader=r.body!.getReader();let buf='';const dec=new TextDecoder();
  for(;;){const {value,done}=await reader.read();if(done)break;buf+=dec.decode(value,{stream:true});let k;while((k=buf.indexOf('\n\n'))>=0){const block=buf.slice(0,k);buf=buf.slice(k+2);const ev=/event: (\w+)/.exec(block)?.[1];const data=/data: (.*)/.exec(block)?.[1];if(!ev)continue;c.received++;c.events[ev]=(c.events[ev]??0)+1;
   if(ev==='hello')c.me=JSON.parse(data!).you;
   if(ev==='chat'){const m=JSON.parse(data!);const t=/@(\d+)/.exec(m.text);if(t)c.latencies.push(Date.now()-Number(t[1]));}
   if(ev==='leave')c.leftSeen.add(JSON.parse(data!).id);}}
 }catch{}
 c.connected=false;
}
const post=(c:Client,path:string,body:unknown)=>fetch(base()+'/api/presence/'+path,{method:'POST',headers:headers(c),body:JSON.stringify(body)}).then(r=>r.status).catch(()=>0);
const statuses:Record<string,number>={};const count=(k:string)=>statuses[k]=(statuses[k]??0)+1;
port=await start();
const clients:Client[]=Array.from({length:N},(_,i)=>({i,cookie:'',district:districts[i%districts.length],x:5+i%10,y:5,frozen:false,received:0,events:{},latencies:[],connected:false,leftSeen:new Set()}));
for(const c of clients){await login(c);void stream(c);}
await new Promise(r=>setTimeout(r,500));
let running=true,phase='steady';
const behave=async(c:Client)=>{let tick=0;while(running){await new Promise(r=>setTimeout(r,100+Math.random()*40));if(c.frozen||!c.connected)continue;tick++;
 if(tick%200===0){c.district=districts[Math.floor(Math.random()*districts.length)];c.room=undefined;}
 if(tick%150===0&&c.i%5===0)c.room=c.room?undefined:'shop-'+(c.i%3);
 c.x=Math.max(0,Math.min(23,c.x+Math.round(Math.random()*2-1)));c.y=Math.max(0,Math.min(15,c.y+Math.round(Math.random()*2-1)));
 count('move '+await post(c,'move',{district:c.district,x:c.x,y:c.y,facing:'down',...(c.room?{room:c.room}:{})}));
 if(Math.random()<0.01)count('chat '+await post(c,'chat',{text:`hello from ${c.i} @${Date.now()}`}));
 if(tick%50===0)count('beat '+await post(c,'move',{district:c.district,x:c.x,y:c.y,facing:'up',...(c.room?{room:c.room}:{})}));}};
const loops=clients.map(behave);
const t0=Date.now();await new Promise(r=>setTimeout(r,SECONDS*1000));
const steady=await ask();const steadyRecv=clients.reduce((n,c)=>n+c.received,0);const lat=clients.flatMap(c=>c.latencies).sort((x,y)=>x-y);
console.log(JSON.stringify({phase:'steady',clients:N,seconds:SECONDS,server:steady,eventsDelivered:steadyRecv,eventsPerClientPerSec:+(steadyRecv/N/((Date.now()-t0)/1000)).toFixed(1),posts:statuses,chatLatencyMs:{n:lat.length,p50:lat[Math.floor(lat.length/2)],p95:lat[Math.floor(lat.length*0.95)],max:lat.at(-1)}}));
// Stale cleanup: freeze 5 clients (no moves or heartbeats; streams left open).
phase='stale';const frozen=clients.slice(0,5);for(const c of frozen)c.frozen=true;const watchers=clients.slice(10);const freezeAt=Date.now();
const frozenIds=frozen.map(c=>c.me!);
await new Promise(r=>setTimeout(r,30000));
const sawLeave=watchers.filter(w=>frozenIds.some(id=>w.leftSeen.has(id))).length;const droppedStreams=frozen.filter(c=>!c.connected).length;
console.log(JSON.stringify({phase:'stale',frozen:frozenIds.length,secondsWaited:Math.round((Date.now()-freezeAt)/1000),frozenStreamsClosedByServer:droppedStreams,watchersWhoSawALeave:sawLeave}));
// Restart: the server goes away and comes back on the same port; sessions are in memory, so clients log in again.
phase='restart';for(const c of clients){c.frozen=false;}
server.send('exit');await new Promise(r=>setTimeout(r,1500));const downAt=Date.now();port=await start(port);
const reconnect=async(c:Client)=>{for(let attempt=0;attempt<20;attempt++){if(c.connected)return;await new Promise(r=>setTimeout(r,2000));try{await login(c);void stream(c);await new Promise(r=>setTimeout(r,300));if(c.connected){c.reconnectedAt=Date.now();return;}}catch{}}};
await Promise.all(clients.map(reconnect));
const back=clients.filter(c=>c.connected).length,times=clients.filter(c=>c.reconnectedAt).map(c=>c.reconnectedAt!-downAt).sort((x,y)=>x-y);
await new Promise(r=>setTimeout(r,5000));const after=await ask();
console.log(JSON.stringify({phase:'restart',reconnected:back,of:N,reconnectMs:{p50:times[Math.floor(times.length/2)],max:times.at(-1)},serverAfter:after}));
running=false;for(const c of clients)c.abort?.abort();await Promise.race([Promise.all(loops),new Promise(r=>setTimeout(r,2000))]);server.send('exit');process.exit(0);
