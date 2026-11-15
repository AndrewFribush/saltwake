import {TownPresence,PresenceError,type Facing} from './presence';
import {districts,districtWalkable,type DistrictId} from '../../../packages/game/src/town-districts';
import type {Shopfront} from '../../../packages/shared/src/types';

/** A hosted crowd: townsfolk who walk the districts and talk in the town channel so a quiet demo world is not empty.
 * They are ordinary presence entries with ids `npc:<name>`, driven by a timer in the server process. Scenery only:
 * they hold no profile, no coins and no goods, never touch the economy, the contract or the outbox, and the client
 * hides trading for them. Default on for the local sandbox, off for wallet and testnet servers (`--crowd N`). */
export const NPC_PREFIX='npc:';
export const isNpc=(id:string)=>id.startsWith(NPC_PREFIX);

type World={shops?:readonly Shopfront[];editions?:readonly {title?:string;fee?:string;closed?:boolean;retired?:boolean}[]};
type Npc={id:string;name:string;look:number;district:DistrictId;x:number;y:number;facing:Facing;dx:number;dy:number;restUntil:number;moveUntil:number;lastSent:number;stepMs:number;nextStep:number};
type Exchange=[string,string];
export type CrowdOptions={size?:number;now?:()=>number;random?:()=>number;world?:()=>Promise<World>;tickMs?:number;chatEveryMs?:[number,number]};

const names=['maren','tobin','ysolde','arno','pell','wenna','corrin','hessa','dunstan','ferelith','gwil','orla','sawney','tamsin','brannoc','elowen'];
const ambient=[
 'Tide is turning. Anyone going down before dark?','Lost a good club on floor two last night. Rats.','Who is selling tonics under four coins? Asking for my ribs.',
 'The bank buys scrap at a bad price. Always has.','Heard the harbour watch walks a new route now.','Three coins to enter and a sword at the bottom. Sounds like a trap, so I am going.',
 'Anyone crafting fine tonics this week? The pantry is dry.','Kegs by the stairs again. Whoever builds like that owes me a tonic.','Made it out with two herbs and no pride.',
 'If you see a plate in the floor, do not stand on it. Trust me.','Looking for a partner for the deep vault. You carry, I run.','The square was packed at noon. Where did everyone go?',
 'The notice board says fees went up again.','First time below? Take the small one. Learn the rats first.','My cousin says the locks need keys now. Progress.',
 'Who left a cart by the dock crossing?','Sold a flask for three. Not bad for a Tuesday.','Does the tide clock on floor three ever stop? Asking before I go back.',
 'Anyone want to trade a herb for a flask? Meet me by the post.','Back from the drowned stair. The second floor bites.','Cheap dig, cheap loot. Still loot.',
];
const exchanges:Exchange[]=[
 ['Anyone seen the proprietor today?','In the pantry, counting herbs like always.'],
 ['How deep did you get?','Floor two. Then a keg had opinions.'],
 ['Is the warren still worth a coin?','For a first run, yes. For loot, no.'],
 ['Who is buying swords?','The rack in the south. Pays late, pays fair.'],
 ['Tide is in. Pier is wet.','It is always wet. That is the point of a pier.'],
 ['I need two flasks before dusk.','The pantry had some this morning. Two coins each.'],
 ['Anyone building this week?','Me. Three floors. Bring friends and regrets.'],
];
const aboutDungeon=(title:string,fee:string)=>[
 `${title} is open again. ${fee} coins at the door.`,`Someone extracted from ${title} with a full bag. Not me.`,`Went into ${title} greedy and came out humble.`,
 `${title}: bring a tonic. Bring two.`,`Who built ${title}? I have notes. Mostly rude ones.`,
];
const aboutShop=(title:string)=>[`${title} has stock again.`,`Prices at ${title} are fair this week. Write that down, it will not last.`];

export class Crowd{
 readonly #presence:TownPresence;readonly #o:Required<Pick<CrowdOptions,'size'|'now'|'random'|'tickMs'|'chatEveryMs'>>&{world?:CrowdOptions['world']};
 readonly #npcs:Npc[]=[];#shops:readonly Shopfront[]=[];#dungeons:{title:string;fee:string}[]=[];#shopTitles:string[]=[];
 #timer?:ReturnType<typeof setInterval>;#nextChat=0;#reply?:{at:number;by:Npc;text:string};#lastWorld=-Infinity;#disconnects:(()=>void)[]=[];
 constructor(presence:TownPresence,options:CrowdOptions={}){
  this.#presence=presence;
  this.#o={size:Math.max(0,Math.min(40,options.size??10)),now:options.now??Date.now,random:options.random??Math.random,tickMs:options.tickMs??700,chatEveryMs:options.chatEveryMs??[9_000,24_000],world:options.world};
 }
 get npcs(){return this.#npcs.map(n=>({...n}));}
 /** Connects the crowd and starts walking. Safe to call once; stop() undoes it. */
 async start(){
  await this.refreshWorld();
  const now=this.#o.now();const pick=<T,>(xs:readonly T[])=>xs[Math.floor(this.#o.random()*xs.length)];
  for(let i=0;i<this.#o.size;i++){
   const name=names[i%names.length]+(i>=names.length?String(Math.floor(i/names.length)+1):'');
   const district=pick(districts).id;const spot=this.#freeSpot(district)??{x:5,y:8};
   const npc:Npc={id:NPC_PREFIX+name,name,look:i%16,district,x:spot.x,y:spot.y,facing:'down',dx:0,dy:0,restUntil:now+this.#o.random()*4000,moveUntil:0,lastSent:-Infinity,stepMs:450+this.#o.random()*900,nextStep:0};
   // A silent stream: the crowd never reads events. connect() is what makes an npc visible to real players.
   try{this.#disconnects.push(this.#presence.connect(npc.id,{send:()=>{},end:()=>{}}));}catch{continue;}
   this.#npcs.push(npc);this.#send(npc,now);
  }
  this.#nextChat=now+this.#between(this.#o.chatEveryMs)/2;
  this.#timer=setInterval(()=>{void this.tick();},this.#o.tickMs);this.#timer.unref();
  return this;
 }
 stop(){clearInterval(this.#timer);this.#timer=undefined;for(const off of this.#disconnects.splice(0))off();this.#npcs.length=0;}
 /** Shops decide where the crowd may walk; edition and shop titles feed the chatter. Cheap: one snapshot a minute. */
 async refreshWorld(){
  if(!this.#o.world)return;
  try{const w=await this.#o.world();this.#shops=w.shops??[];
   const open=(w.editions??[]).filter(e=>e.title&&!e.closed&&!e.retired);this.#dungeons=open.map(e=>({title:e.title!,fee:String(e.fee??'?')}));
   // Buildings whose title is not a dungeon's are shops (dungeon halls carry their edition's title).
   const dungeonTitles=new Set(this.#dungeons.map(d=>d.title));this.#shopTitles=this.#shops.map(s=>(s as {title?:string}).title??'').filter(t=>t&&!dungeonTitles.has(t));
  }catch{/* keep the last world */}
  this.#lastWorld=this.#o.now();
 }
 /** One step of life: walkers walk, resters rest, and now and then someone says something in the town channel. */
 async tick(){
  const now=this.#o.now();
  if(now-this.#lastWorld>60_000)await this.refreshWorld();
  for(const npc of this.#npcs){
   if(now<npc.restUntil){
    // Standing folk look around now and then, and repeat their position so late joiners see them.
    if(this.#o.random()<0.06){const faces:Facing[]=['up','down','left','right'];npc.facing=faces[Math.floor(this.#o.random()*4)];this.#send(npc,now);}
    else if(now-npc.lastSent>8_000)this.#send(npc,now);
    continue;}
   // Everyone walks at their own pace, so the crowd never steps in unison.
   if(now<npc.nextStep)continue;npc.nextStep=now+npc.stepMs;
   if(now>=npc.moveUntil){
    // A heading ends in a pause more often than not: stop, look somewhere, then pick a new way.
    if(npc.moveUntil>0&&this.#o.random()<0.6){npc.moveUntil=0;npc.restUntil=now+1200+this.#o.random()*4500;const faces:Facing[]=['up','down','left','right'];npc.facing=faces[Math.floor(this.#o.random()*4)];this.#send(npc,now);continue;}
    // Pick a new heading; occasionally change district (walk off through the gate: arrive at a free spot).
    if(this.#o.random()<0.04){const next=districts[Math.floor(this.#o.random()*districts.length)].id;const spot=this.#freeSpot(next);if(spot){npc.district=next;npc.x=spot.x;npc.y=spot.y;}}
    const dirs:[number,number][]=[[1,0],[-1,0],[0,1],[0,-1]];const [dx,dy]=dirs[Math.floor(this.#o.random()*4)];npc.dx=dx;npc.dy=dy;npc.moveUntil=now+2000+this.#o.random()*5000;
   }
   const to={x:npc.x+npc.dx,y:npc.y+npc.dy};
   if(this.#walkable(npc.district,to)){npc.x=to.x;npc.y=to.y;npc.facing=npc.dx>0?'right':npc.dx<0?'left':npc.dy>0?'down':'up';}
   else{npc.moveUntil=0;if(this.#o.random()<0.35)npc.restUntil=now+1500+this.#o.random()*6000;}
   this.#send(npc,now);
  }
  if(this.#reply&&now>=this.#reply.at){const {by,text}=this.#reply;this.#reply=undefined;this.#say(by,text);}
  if(now>=this.#nextChat&&this.#npcs.length){this.#nextChat=now+this.#between(this.#o.chatEveryMs);this.#chatter(now);}
 }
 #chatter(now:number){
  const pick=<T,>(xs:readonly T[])=>xs[Math.floor(this.#o.random()*xs.length)];
  const speaker=pick(this.#npcs);const roll=this.#o.random();
  if(roll<0.35&&this.#npcs.length>1){const [q,a]=pick(exchanges);const other=pick(this.#npcs.filter(n=>n!==speaker));this.#say(speaker,q);this.#reply={at:now+4000+this.#o.random()*5000,by:other,text:a};return;}
  if(roll<0.55&&this.#dungeons.length){const d=pick(this.#dungeons);this.#say(speaker,pick(aboutDungeon(d.title,d.fee)));return;}
  if(roll<0.65&&this.#shopTitles.length){this.#say(speaker,pick(aboutShop(pick(this.#shopTitles))));return;}
  this.#say(speaker,pick(ambient));
 }
 #say(npc:Npc,text:string){try{this.#presence.chat(npc.id,text);}catch(e){if(!(e instanceof PresenceError))throw e;}}
 #send(npc:Npc,now:number){npc.lastSent=now;try{this.#presence.move(npc.id,{district:npc.district,x:npc.x,y:npc.y,facing:npc.facing,look:npc.look});}catch(e){if(!(e instanceof PresenceError))throw e;}}
 #walkable(district:DistrictId,p:{x:number;y:number}){return p.x>=1&&p.x<=22&&p.y>=1&&p.y<=14&&districtWalkable(district,p,this.#shops);}
 #freeSpot(district:DistrictId){for(let i=0;i<40;i++){const p={x:2+Math.floor(this.#o.random()*20),y:2+Math.floor(this.#o.random()*12)};if(this.#walkable(district,p))return p;}return undefined;}
 #between([lo,hi]:[number,number]){return lo+this.#o.random()*(hi-lo);}
}
