import type {IncomingMessage,Server,ServerResponse} from 'node:http';
import {districts,type DistrictId} from '../../../packages/game/src/town-districts';
import {townSize} from '../../../packages/game/src/town';

/** Town presence: who is walking where, plus district chat. Purely social and in-memory.
 * It never reads or writes the economy, the contract or the outbox, and positions grant no authority. */
export type Facing='up'|'down'|'left'|'right';
/** `room` is a player building id (contract shop record). Players in a room only see and chat with that room. */
export type PresencePlayer={id:string;district:DistrictId|null;x:number;y:number;facing:Facing;room?:string;look?:number};
const roomPattern=/^shop-\d{1,4}$/;
/** The space a player occupies: a player building's room, else their district, else nowhere (indoors in an NPC house or a run). */
export const spaceOf=(p:PresencePlayer):string|null=>p.district?(p.room??p.district):null;
export type ChatMessage={id:string;from:string;text:string;at:number};
export type PresenceStream={send:(event:string,data:unknown)=>void;end:()=>void};
export type PresenceOptions={now?:()=>number;staleMs?:number;moveMinMs?:number;chatMax?:number;chatBurst?:number;chatWindowMs?:number;historySize?:number;historyMs?:number;maxPlayers?:number;maxStreamsPerPlayer?:number;pingMs?:number};
export class PresenceError extends Error{constructor(message:string,readonly status:number){super(message);this.name='PresenceError';}}

/** The one place presence learns who a request is: the server-side session, never the request body.
 * Demo sessions yield the operator profile id; wallet sessions yield `wallet:<account>`, shown as the account id. */
export const presenceIdentity=(sessions:{requireProfile(cookie:string|undefined):string})=>(cookie:string|undefined)=>{
 const profile=sessions.requireProfile(cookie);return profile.startsWith('wallet:')?profile.slice('wallet:'.length):profile;
};

const districtIds=new Set<string>(districts.map(d=>d.id));
const facings=new Set<string>(['up','down','left','right']);
type Entry={player:PresencePlayer;streams:Set<PresenceStream>;seenAt:number;movedAt:number;chats:number[]};

export function normalizeChat(text:unknown,max:number):string{
 if(typeof text!=='string')throw new PresenceError('Chat text required',400);
 // Control and bidi-override characters become spaces; rendering is text-only on the client.
 const clean=text.replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g,' ').replace(/\s+/g,' ').trim();
 if(!clean)throw new PresenceError('Chat text required',400);
 if([...clean].length>max)throw new PresenceError(`Chat is limited to ${max} characters`,400);
 return clean;
}

export class TownPresence{
 readonly #players=new Map<string,Entry>();
 readonly #history=new Map<string,ChatMessage[]>();
 readonly #now:()=>number;readonly #o:Required<Omit<PresenceOptions,'now'>>;
 #seq=0;#sweeper?:ReturnType<typeof setInterval>;
 constructor(options:PresenceOptions={}){
  this.#now=options.now??Date.now;
  this.#o={staleMs:20_000,moveMinMs:40,chatMax:160,chatBurst:5,chatWindowMs:10_000,historySize:20,historyMs:5*60_000,maxPlayers:200,maxStreamsPerPlayer:4,pingMs:15_000,...options};
 }
 get size(){return this.#players.size;}
 player(id:string){const p=this.#players.get(id)?.player;return p&&{...p};}

 /** Registers a live stream for an identity and returns its disconnect function. */
 connect(id:string,stream:PresenceStream):()=>void{
  let entry=this.#players.get(id);
  if(!entry){
   if(this.#players.size>=this.#o.maxPlayers)throw new PresenceError('Town is full',503);
   entry={player:{id,district:null,x:0,y:0,facing:'down'},streams:new Set(),seenAt:this.#now(),movedAt:-Infinity,chats:[]};this.#players.set(id,entry);
  }
  if(entry.streams.size>=this.#o.maxStreamsPerPlayer){const oldest=entry.streams.values().next().value!;entry.streams.delete(oldest);oldest.end();}
  entry.streams.add(stream);entry.seenAt=this.#now();
  stream.send('hello',{you:id});
  const space=spaceOf(entry.player);if(space)stream.send('snapshot',this.#snapshot(space,id));
  stream.send('rooms',this.rooms());
  return()=>{const current=this.#players.get(id);if(current!==entry||!entry.streams.delete(stream))return;if(!entry.streams.size)this.#remove(id);};
 }

 /** Validates and relays a position. Returns false when throttled (the update is dropped). */
 move(id:string,body:unknown):boolean{
  const entry=this.#require(id);const b=(body??{}) as Record<string,unknown>;
  const district=b.district===null?null:typeof b.district==='string'&&districtIds.has(b.district)?b.district as DistrictId:undefined;
  if(district===undefined)throw new PresenceError('Unknown district',400);
  const {x,y,facing}=b;
  if(!Number.isInteger(x)||!Number.isInteger(y)||(x as number)<0||(y as number)<0||(x as number)>=townSize.width||(y as number)>=townSize.height)throw new PresenceError('Position outside the town',400);
  if(typeof facing!=='string'||!facings.has(facing))throw new PresenceError('Unknown facing',400);
  // Cosmetic palette id only (0-15); it carries no authority.
  const look=b.look===undefined||b.look===null?undefined:Number.isInteger(b.look)&&(b.look as number)>=0&&(b.look as number)<16?b.look as number:null;
  if(look===null)throw new PresenceError('Unknown look',400);
  const room=b.room===undefined||b.room===null?undefined:typeof b.room==='string'&&roomPattern.test(b.room)&&district?b.room:null;
  if(room===null)throw new PresenceError('Unknown room',400);
  const now=this.#now();if(now-entry.movedAt<this.#o.moveMinMs)return false;
  entry.movedAt=now;entry.seenAt=now;
  const before=spaceOf(entry.player);const player:PresencePlayer={id,district,x:x as number,y:y as number,facing:facing as Facing,...(room?{room}:{}),...(look!==undefined?{look}:{})};entry.player=player;const after=spaceOf(player);
  if(before&&before!==after)this.#broadcast(before,'leave',{id},id);
  if(before!==after&&(roomPattern.test(before??'')||roomPattern.test(after??'')))this.#broadcastRooms();
  if(after){
   this.#broadcast(after,before===after?'move':'join',{player},id);
   if(before!==after)for(const s of entry.streams)s.send('snapshot',this.#snapshot(after,id));
  }
  return true;
 }

 chat(id:string,text:unknown):ChatMessage{
  const entry=this.#require(id);const district=spaceOf(entry.player);
  if(!district)throw new PresenceError('Step outside to talk in town',409);
  const clean=normalizeChat(text,this.#o.chatMax);const now=this.#now();
  entry.chats=entry.chats.filter(t=>now-t<this.#o.chatWindowMs);
  if(entry.chats.length>=this.#o.chatBurst)throw new PresenceError('Slow down: too many messages',429);
  entry.chats.push(now);entry.seenAt=now;
  const message:ChatMessage={id:`${now.toString(36)}-${(++this.#seq).toString(36)}`,from:id,text:clean,at:now};
  const history=[...(this.#history.get(district)??[]),message].slice(-this.#o.historySize);this.#history.set(district,history);
  this.#broadcast(district,'chat',message);
  return message;
 }

 /** Drops players whose clients stopped heartbeating (half-open connections, sleeping tabs). */
 sweep(){
  const now=this.#now();
  for(const [id,entry] of this.#players)if(now-entry.seenAt>this.#o.staleMs){for(const s of entry.streams)s.end();this.#remove(id);}
  for(const [district,list] of this.#history){const kept=list.filter(m=>now-m.at<=this.#o.historyMs);if(kept.length)this.#history.set(district,kept);else this.#history.delete(district);}
 }

 shutdown(){clearInterval(this.#sweeper);this.#sweeper=undefined;for(const entry of this.#players.values())for(const s of entry.streams)s.end();this.#players.clear();}

 /** Ends presence streams when the HTTP server closes so server.close() can finish. */
 attach(server:Server){
  this.#sweeper=setInterval(()=>this.sweep(),5_000);this.#sweeper.unref();
  const close=server.close.bind(server);
  server.close=((callback?:(err?:Error)=>void)=>{this.shutdown();return close(callback);}) as Server['close'];
  return this;
 }

 /** Routes /api/presence/*. Host, origin and JSON content-type checks happen in http.ts before this runs. */
 async handle(req:IncomingMessage,res:ServerResponse,url:URL,identityOf:(cookie:string|undefined)=>string){
  const reply=(status:number,value:unknown)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));};
  try{
   if(req.method==='GET'&&url.pathname==='/api/presence/stream'){
    const cookie=req.headers.cookie;const id=identityOf(cookie);
    res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store','Connection':'keep-alive','X-Accel-Buffering':'no'});
    res.write('retry: 2000\n\n');
    const stream:PresenceStream={send:(event,data)=>{if(!res.writableEnded)res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);},end:()=>{if(!res.writableEnded)res.end();}};
    let disconnect:()=>void;
    try{disconnect=this.connect(id,stream);}catch(e){stream.send('error',{error:(e as Error).message});stream.end();return;}
    // A demo profile switch or logout changes the session's identity; drop the old stream.
    const ping=setInterval(()=>{let same=false;try{same=identityOf(cookie)===id;}catch{}if(same)res.write(': ping\n\n');else stream.end();},this.#o.pingMs);ping.unref();
    const cleanup=()=>{clearInterval(ping);disconnect();};res.on('close',cleanup);res.on('finish',cleanup);
    return;
   }
   if(req.method==='POST'&&(url.pathname==='/api/presence/move'||url.pathname==='/api/presence/chat')){
    const id=identityOf(req.headers.cookie);const body=await readJson(req,1024);
    if(url.pathname.endsWith('/move'))return reply(this.move(id,body)?200:429,{ok:true});
    return reply(200,this.chat(id,body.text));
   }
   return reply(404,{error:'Not found'});
  }catch(e){if(e instanceof PresenceError)return reply(e.status,{error:e.message});throw e;}
 }

 #require(id:string){const entry=this.#players.get(id);if(!entry)throw new PresenceError('Open the town stream first',409);return entry;}
 #remove(id:string){const entry=this.#players.get(id);if(!entry)return;this.#players.delete(id);const space=spaceOf(entry.player);if(space)this.#broadcast(space,'leave',{id},id);if(roomPattern.test(space??''))this.#broadcastRooms();}
 /** Who is inside each player building (at most five names per room). Social only: for "X is browsing" hints. */
 rooms():Record<string,string[]>{const out:Record<string,string[]>={};for(const e of this.#players.values()){const r=e.player.district?e.player.room:undefined;if(r){const list=out[r]??=[];if(list.length<5)list.push(e.player.id);}}return out;}
 #broadcastRooms(){const rooms=this.rooms();for(const e of this.#players.values())for(const s of e.streams)s.send('rooms',rooms);}
 #snapshot(space:string,self:string){
  const room=roomPattern.test(space)?space:undefined;const district=room?[...this.#players.values()].find(e=>e.player.id===self)?.player.district??null:space;
  return {district,...(room?{room}:{}),players:[...this.#players.values()].filter(e=>spaceOf(e.player)===space&&e.player.id!==self).map(e=>({...e.player})),chat:this.#history.get(space)??[]};
 }
 #broadcast(space:string,event:string,data:unknown,except?:string){
  for(const entry of this.#players.values())if(spaceOf(entry.player)===space&&entry.player.id!==except)for(const s of entry.streams)s.send(event,data);
 }
}

async function readJson(req:IncomingMessage,maxBytes:number):Promise<Record<string,unknown>>{
 let bytes=0;const chunks:Buffer[]=[];
 for await(const chunk of req){bytes+=chunk.length;if(bytes>maxBytes)throw new PresenceError('Request too large',413);chunks.push(chunk);}
 let body:unknown;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new PresenceError('Invalid JSON',400);}
 if(!body||typeof body!=='object'||Array.isArray(body))throw new PresenceError('JSON object required',400);
 return body as Record<string,unknown>;
}
