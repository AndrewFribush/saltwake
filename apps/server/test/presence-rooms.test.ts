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
