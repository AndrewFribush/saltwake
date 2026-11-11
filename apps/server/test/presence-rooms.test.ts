import test from 'node:test';
import assert from 'node:assert/strict';
import {TownPresence,PresenceError,spaceOf,type PresenceStream} from '../src/presence';
type Got={event:string;data:any};
function fakeStream(){const got:Got[]=[];const stream:PresenceStream={send:(event,data)=>{got.push({event,data:JSON.parse(JSON.stringify(data))});},end:()=>{}};return {stream,events:(name:string)=>got.filter(g=>g.event===name).map(g=>g.data)};}
test('player-building rooms are shared spaces separate from the street',()=>{
 let now=1_000;const town=new TownPresence({now:()=>now});const a=fakeStream(),b=fakeStream(),c=fakeStream();
 town.connect('buyer',a.stream);town.connect('maker',b.stream);town.connect('p2',c.stream);
 now+=100;town.move('buyer',{district:'e',room:'shop-3',x:5,y:7,facing:'down'});
 now+=100;town.move('maker',{district:'e',room:'shop-3',x:6,y:7,facing:'down'});
 now+=100;town.move('p2',{district:'e',x:5,y:12,facing:'down'});
 assert.deepEqual(b.events('snapshot').at(-1).players.map((p:any)=>p.id),['buyer']);
 assert.equal(b.events('snapshot').at(-1).room,'shop-3');
 assert.deepEqual(a.events('join').map(j=>j.player.id),['maker']);
 assert.equal(c.events('join').length,0,'the street does not see room visitors');
 now+=100;town.chat('buyer','hello room');
 assert.equal(b.events('chat').at(-1).text,'hello room');assert.equal(c.events('chat').length,0);
 // Stepping out of the door leaves the room and joins the street.
 now+=100;town.move('maker',{district:'e',x:5,y:12,facing:'down'});
 assert.deepEqual(a.events('leave').at(-1),{id:'maker'});assert.equal(c.events('join').at(-1).player.id,'maker');
 assert.equal(spaceOf({id:'x',district:null,x:0,y:0,facing:'down',room:'shop-1'}),null);
 now+=100;assert.throws(()=>town.move('buyer',{district:'e',room:'../etc',x:1,y:1,facing:'down'}),(e:unknown)=>e instanceof PresenceError&&e.status===400);
 now+=100;assert.throws(()=>town.move('buyer',{district:null,room:'shop-1',x:1,y:1,facing:'down'}),(e:unknown)=>e instanceof PresenceError&&e.status===400);
});
test('room occupancy is announced to everyone for notice-board hints, names only',()=>{
 let now=1_000;const town=new TownPresence({now:()=>now});const a=fakeStream(),b=fakeStream();
 town.connect('buyer',a.stream);town.connect('maker',b.stream);
 assert.deepEqual(b.events('rooms').at(-1),{});
 now+=100;town.move('buyer',{district:'s',room:'shop-4',x:5,y:7,facing:'down'});
 assert.deepEqual(b.events('rooms').at(-1),{'shop-4':['buyer']},'the street hears who is browsing');
 const count=b.events('rooms').length;now+=100;town.move('buyer',{district:'s',room:'shop-4',x:5,y:6,facing:'up'});assert.equal(b.events('rooms').length,count,'moving inside a room does not rebroadcast');
 now+=100;town.move('buyer',{district:'s',x:5,y:12,facing:'down'});assert.deepEqual(b.events('rooms').at(-1),{});
});
test('chat reports are recorded for the operator, validated and rate limited; they change nothing for the reported player',()=>{
 let now=1_000;const town=new TownPresence({now:()=>now});const a=fakeStream(),b=fakeStream();
 town.connect('buyer',a.stream);town.connect('maker',b.stream);now+=100;town.move('buyer',{district:'center',x:1,y:1,facing:'down'});now+=100;town.move('maker',{district:'center',x:2,y:1,facing:'down'});
 const m=town.chat('maker','rude words');
 assert.deepEqual(town.report('buyer',{messageId:m.id,from:'maker',text:m.text}),{ok:true});
 assert.equal(town.reports()[0].from,'maker');assert.equal(town.reports()[0].space,'center');
 assert.throws(()=>town.report('buyer',{messageId:m.id,from:'buyer'}),(e:unknown)=>e instanceof PresenceError&&e.status===400,'cannot report yourself');
 for(let i=0;i<4;i++)town.report('buyer',{messageId:m.id,from:'maker'});
 assert.throws(()=>town.report('buyer',{messageId:m.id,from:'maker'}),(e:unknown)=>e instanceof PresenceError&&e.status===429);
 assert.equal(town.player('maker')?.district,'center','the reported player is unaffected');
});
