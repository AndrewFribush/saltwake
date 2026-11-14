import test from 'node:test';
import assert from 'node:assert/strict';
import {TownPresence,type PresenceStream} from '../src/presence';
import {Crowd,isNpc} from '../src/crowd';
import {districtWalkable} from '../../../packages/game/src/town-districts';

type Got={event:string;data:any};
function fakeStream(){const got:Got[]=[];const stream:PresenceStream={send:(event,data)=>{got.push({event,data:JSON.parse(JSON.stringify(data))});},end:()=>{}};return {stream,got,events:(e:string)=>got.filter(g=>g.event===e).map(g=>g.data)};}
/** Deterministic pseudo-random so a run is repeatable. */
const rng=(seed:number)=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32;};

test('the crowd walks on walkable tiles in presence, talks in the town channel, and leaves cleanly',async()=>{
 let now=1_000;const town=new TownPresence({now:()=>now});
 const me=fakeStream();town.connect('buyer',me.stream);town.move('buyer',{district:'center',x:5,y:8,facing:'down'});
 const crowd=new Crowd(town,{size:6,now:()=>now,random:rng(7),chatEveryMs:[3_000,3_000],world:async()=>({shops:[],editions:[{title:'The brine cut',fee:'1'}]})});
 await crowd.start();
 assert.equal(crowd.npcs.length,6);
 for(const n of crowd.npcs){assert.ok(isNpc(n.id),n.id);assert.ok(districtWalkable(n.district,{x:n.x,y:n.y}),`${n.id} stands on ${n.district} ${n.x},${n.y}`);}
 let moves=0;const seen=new Set<string>();
 for(let i=0;i<120;i++){now+=700;await crowd.tick();for(const n of crowd.npcs){assert.ok(districtWalkable(n.district,{x:n.x,y:n.y}),`${n.id} walked onto ${n.district} ${n.x},${n.y}`);seen.add(`${n.id}@${n.district}:${n.x},${n.y}`);}moves++;}
 assert.ok(seen.size>6*3,'townsfolk actually move about');
 const chats=me.events('chat');
 assert.ok(chats.length>=5,`town chat heard ${chats.length} lines over ${moves} ticks`);
 assert.ok(chats.every(c=>isNpc(c.from)&&typeof c.text==='string'&&c.text.length>0&&c.district),'every line is from a townsperson and says where it was spoken');
 assert.ok(chats.some(c=>c.text.includes('The brine cut')),'chatter mentions real dungeons');
 // Townsfolk in the viewer's district appear as ordinary presence players; those elsewhere do not.
 const here=crowd.npcs.filter(n=>n.district==='center');
 const joined=new Set([...me.events('join'),...me.events('move')].map(d=>d.player.id));
 for(const n of here)assert.ok(joined.has(n.id),`${n.id} is visible in center`);
 crowd.stop();
 assert.equal(crowd.npcs.length,0);
 now+=100;const late=fakeStream();town.connect('p2',late.stream);town.move('p2',{district:'center',x:6,y:8,facing:'down'});
 assert.equal(late.events('snapshot').at(-1).players.filter((p:any)=>isNpc(p.id)).length,0,'stopped townsfolk are gone from presence');
});

test('a crowd of zero connects nobody and a failing world snapshot does not stop it',async()=>{
 const town=new TownPresence({now:()=>0});
 const none=new Crowd(town,{size:0,world:async()=>{throw Error('no economy');}});await none.start();assert.equal(none.npcs.length,0);none.stop();
 const some=new Crowd(town,{size:2,random:rng(3),world:async()=>{throw Error('no economy');}});await some.start();assert.equal(some.npcs.length,2);await some.tick();some.stop();
});
