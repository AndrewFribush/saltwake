import test from 'node:test';
import assert from 'node:assert/strict';
import {authoredRehearsal} from '../src/authored-layout';
import {act} from '../src/actions';
import {validateCustomFloor,encodeCustomModule,decodeCustomModule} from '../../shared/src/custom-layout';
import {encodeBlueprint,decodeBlueprint} from '../../shared/src/blueprint';
import {editionRulePages} from '../src/edition-rules';
import {generateDraft,depthPractice} from '../src/draft-generator';
import {visibleThreatTiles} from '../src/telegraph';
import type {Socket} from '../../shared/src/types';
const open=['###########',...Array(5).fill('#.........#'),'###########'];
const floor=(patch:Record<string,unknown>={}):any=>({tiles:open,spawn:{x:1,y:1},exit:{x:9,y:5},sockets:[],tuning:[],devices:[],exit_rule:{extract:true,require_clear:false},features:[],...patch});
const sock=(enemy:Socket['enemy'],slot=0,trap=false):Socket=>({id:`e${slot}`,room:0,slot,enemy,trap,reward:null});
const run=(f:any,sockets:Socket[]=[],kit:'club'|'sword'='club')=>authoredRehearsal([f],sockets,kit);

test('v12 floors: hidden rooms behind cracked walls are valid; sealed rooms and chasm splits are not',()=>{
 const pocket=['###########','#.......#.#','#.......#.#','#.......###',...Array(2).fill('#.........#'),'###########'];
 assert.ok(validateCustomFloor(floor({tiles:pocket}),'depth').length);
 assert.deepEqual(validateCustomFloor(floor({tiles:pocket,features:[{id:'w',x:8,y:1,kind:'crack',hp:2}]}),'depth'),[]);
 const split=['#######','#.....#','#.###.#','#.....#','#######'];
 assert.deepEqual(validateCustomFloor({...floor(),tiles:split,exit:{x:5,y:3}},'depth'),[]);
 assert.ok(validateCustomFloor({...floor(),tiles:split,exit:{x:5,y:3},features:[{id:'p',x:1,y:2,kind:'pit'},{id:'q',x:5,y:2,kind:'pit'}]},'depth').length);
 const m=encodeCustomModule(floor({features:[{id:'k',x:3,y:3,kind:'barrel',damage:4}],tide:{turns:20,damage:2}}),'depth');
 assert.ok(m.startsWith('custom12:'));assert.equal(decodeCustomModule(m).features?.[0].kind,'barrel');assert.equal(decodeCustomModule(m).tide?.turns,20);
 assert.ok(validateCustomFloor(floor({features:[{id:'k',x:3,y:3,kind:'barrel',damage:4,extra:1}]}),'depth').length);
});

test('kegs light when bumped and burst after the next turn, chaining through oil and kegs',()=>{
 let s=run(floor({spawn:{x:2,y:1},features:[{id:'k',x:3,y:1,kind:'barrel',damage:5},{id:'o',x:4,y:1,kind:'oil'},{id:'k2',x:5,y:1,kind:'barrel',damage:5}]}),[]);
 s=act(s,{type:'move',x:3,y:1});assert.equal(s.features!.find(f=>f.id==='k')!.fuse,1);assert.equal(s.player.x,2);
 assert.ok(visibleThreatTiles(s).some(p=>p.x===2&&p.y===1));
 s=act(s,{type:'move',x:1,y:1});s=act(s,{type:'move',x:1,y:2});
 assert.equal(s.features!.find(f=>f.id==='k')!.spent,true);
 for(let i=0;i<4;i++)s=act(s,{type:'wait'});
 assert.equal(s.features!.find(f=>f.id==='k2')!.spent,true);
 assert.equal(s.player.hp,12);
});

test('powder crab lights when adjacent and bursts next turn; stepping clear dodges; a blow on a lit crab sets it off',()=>{
 let s=run(floor({spawn:{x:2,y:1},sockets:[{x:4,y:1}]}),[sock('bomber')]);
 s=act(s,{type:'wait'});assert.equal(s.enemies[0].x,3);assert.equal(s.enemies[0].primed,true);
 s=act(s,{type:'move',x:1,y:1});
 assert.equal(s.enemies.length,0);assert.equal(s.player.hp,12);
 let t=run(floor({sockets:[{x:3,y:1}]}),[sock('bomber')],'sword');
 t=act(t,{type:'wait'});assert.equal(t.enemies[0].x,2);assert.equal(t.enemies[0].primed,true);
 t=act(t,{type:'attack',enemyId:'e0'});assert.equal(t.enemies.length,0);assert.ok(t.player.hp<12);
});

test('crossbow sentry aims along a line then fires at the first creature; sidestepping dodges and it reloads',()=>{
 let s=run(floor({spawn:{x:2,y:3},sockets:[{x:7,y:3}]}),[sock('archer')]);
 assert.equal(s.enemies[0].aim,true);
 s=act(s,{type:'move',x:2,y:4});assert.equal(s.player.hp,12);assert.equal(s.enemies[0].recovering,true);
 let t=run(floor({spawn:{x:2,y:3},sockets:[{x:7,y:3}]}),[sock('archer')]);t=act(t,{type:'wait'});assert.equal(t.player.hp,10);
});

test('brute lumbers every other turn, sweeps three tiles, and resists shoves; chasms swallow shoved enemies',()=>{
 let s=run(floor({spawn:{x:2,y:2},sockets:[{x:3,y:2}]}),[sock('brute')]);
 assert.equal(s.enemies[0].lane!.length,3);
 assert.equal(act(s,{type:'shove',enemyId:'e0'}),s);
 s=act(s,{type:'move',x:1,y:2});assert.equal(s.player.hp,12);assert.equal(s.enemies[0].resting,true);
 let t=run(floor({spawn:{x:2,y:2},sockets:[{x:3,y:2}],features:[{id:'p',x:4,y:2,kind:'pit'}]}),[sock('pursuer')]);
 t=act(t,{type:'shove',enemyId:'e0'});assert.equal(t.enemies.length,0);
});

test('nests hatch bounded rats; caches, springs, altars and flash powder work',()=>{
 let s=run(floor({sockets:[{x:8,y:5}],features:[{id:'c',x:2,y:1,kind:'cache',supply:'flash',count:1},{id:'f',x:3,y:1,kind:'fountain',heal:3,charges:1},{id:'a',x:4,y:1,kind:'altar',boon:'might',cost:2}]}),[sock('nest')]);
 s.enemies[0].alerted=true;
 s=act(s,{type:'move',x:2,y:1});assert.equal(s.supplies?.flash,1);
 s=act(s,{type:'move',x:3,y:1});assert.equal(act(s,{type:'interact'}),s);
 s=act(s,{type:'move',x:4,y:1});s=act(s,{type:'interact'});assert.equal(s.player.hp,10);assert.equal(s.buffs?.might,1);
 s=act(s,{type:'move',x:3,y:1});s=act(s,{type:'interact'});assert.ok(s.player.hp>10);
 for(let i=0;i<40&&s.status==='active';i++)s=act(s,{type:'guard'});
 const nest=s.enemies.find(e=>e.kind==='nest')!;assert.ok(nest.spawned!>0&&nest.spawned!<=6);
 assert.ok(s.enemies.filter(e=>e.minion).length<=3);
});

test('the tide floods a floor after its turn budget',()=>{
 let s=run(floor({tide:{turns:5,damage:2}}),[]);
 for(let i=0;i<5;i++)s=act(s,{type:'wait'});assert.equal(s.player.hp,12);
 s=act(s,{type:'wait'});assert.equal(s.player.hp,10);
});

test('bombs need a visible target within range; darts need a line',()=>{
 let s=run(floor({features:[{id:'c',x:2,y:1,kind:'cache',supply:'bomb',count:2}]}),[]);s=act(s,{type:'move',x:2,y:1});
 assert.equal(act(s,{type:'supply',supply:'bomb',x:9,y:5}),s);
 const n=act(s,{type:'supply',supply:'bomb',x:5,y:2});assert.notEqual(n,s);assert.equal(n.supplies?.bomb,1);assert.equal(n.player.hp,12);
 assert.equal(act(s,{type:'supply',supply:'dart',x:4,y:4}),s);
});

test('blueprints and rule pages carry depth designs; plain designs stay v11',()=>{
 const d=generateDraft(7);const text=encodeBlueprint({title:'Gen',fee:'1',...d});assert.equal(JSON.parse(text).version,12);
 assert.equal(decodeBlueprint(text).floors[0].features!.length,d.floors[0].features!.length);
 const plain=encodeBlueprint({title:'Plain',fee:'0',floors:[{...floor(),features:undefined}],placements:[[]]});assert.equal(JSON.parse(plain).version,11);
 const pages=editionRulePages({title:'x',rules_version:12,modules:d.floors.map(f=>encodeCustomModule(f,'depth')),sockets:d.placements.flatMap((ps,room)=>ps.map((p,slot)=>({id:`s${room}-${slot}`,room,slot,enemy:p.enemy,trap:p.trap,reward:null}))),opens_at_ms:'0',closes_at_ms:'1',no_reward:true,difficulty_tag:'standard',style_tag:'combat',run_duration_ms:'60000',max_runs:1});
 assert.ok(pages.some(p=>/cracked wall/i.test(p.title)));
});

test('generated drafts are valid for many seeds and practice runs start',()=>{
 for(let seed=1;seed<=40;seed++){const d=generateDraft(seed);for(const f of d.floors)assert.deepEqual(validateCustomFloor(f,'depth'),[]);}
 assert.equal(depthPractice(3).status,'active');
});
