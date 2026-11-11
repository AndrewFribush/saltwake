/** Child process for scripts/presence-load.ts: the real HTTP server and presence relay with N demo identities,
 * stubbed economy (presence never touches it). Reports its own CPU and memory over IPC. */
import type {AddressInfo} from 'node:net';
import {httpServer} from '../apps/server/src/http';import {DemoSessions} from '../apps/server/src/auth';
import type {Outbox} from '../apps/server/src/outbox';import type {Runs} from '../apps/server/src/runs';
const n=Number(process.argv[2]??50),port=Number(process.argv[3]??0);
const sessions=new DemoSessions({profiles:Array.from({length:n+10},(_,i)=>`bot-${i}`),secureCookies:false});
const app=httpServer({db:{}} as Outbox,{} as Runs,async()=>{throw Error('presence load test: no economy');},sessions,undefined,{webOrigin:'http://127.0.0.1:'+(port||18989)});
app.server.listen(port,'127.0.0.1',()=>{const p=(app.server.address() as AddressInfo).port;process.send!({ready:p});});
let lastCpu=process.cpuUsage(),lastAt=Date.now();
process.on('message',(m:any)=>{
 if(m==='stats'){const cpu=process.cpuUsage(lastCpu),ms=Date.now()-lastAt;lastCpu=process.cpuUsage();lastAt=Date.now();process.send!({stats:{cpuPct:Math.round(100*(cpu.user+cpu.system)/1000/ms),rssMb:Math.round(process.memoryUsage().rss/1e6),heapMb:Math.round(process.memoryUsage().heapUsed/1e6)}});}
 if(m==='exit'){app.server.closeAllConnections?.();process.exit(0);}
});
