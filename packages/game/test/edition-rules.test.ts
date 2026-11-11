import test from 'node:test';import assert from 'node:assert/strict';
import {editionRulePages} from '../src/edition-rules';
import {encodeCustomModule,type CustomFloor} from '../../shared/src/custom-layout';
import {terms} from '../../../tests/contract/helpers';
test('offer disclosure describes admitted tuning, exit conditions and directed routes without tile coordinates',()=>{
 const floor:CustomFloor={tiles:['#######','#.....#','#.....#','#.....#','#######'],spawn:{x:1,y:1},exit:{x:5,y:3},sockets:[{x:3,y:2}],tuning:[{slot:0,hp:19,damage:8,alert:2,trap_period:7,trap_active:3,trap_offset:4,trap_damage:9}],devices:[{id:'s',kind:'switch',channel:'seal',mode:'set',x:1,y:2}],links:[{id:'loop',x:2,y:3,to:0,require_clear:false}],exit_rule:{extract:true,require_clear:false,channel:'seal',value:true}};
 const pages=editionRulePages({...terms(100000),rules_version:11,modules:[encodeCustomModule(floor,'missions')],sockets:[{id:'danger',room:0,slot:0,enemy:'charger',trap:true,reward:null}]});
 const text=pages.map(p=>p.text).join(' ');
 for(const expected of ['19 health','8 charge damage, 8 close attack damage','alert distance 2','9 damage','3 of every 7','starting phase 4','Initially safe','Requires seal on','Surviving enemies do not block','1 directed passages','0 require a cleared room'])assert.ok(text.includes(expected),expected);
 assert.ok(!text.includes('#'));assert.ok(!text.includes('"x":'));
});
test('legacy metadata cannot change disclosed departure policy; malformed or unsupported terms do not invent rules',()=>{
 const floor:CustomFloor={tiles:['#######','#.....#','#.....#','#.....#','#######'],spawn:{x:1,y:1},exit:{x:5,y:3},sockets:[],tuning:[],devices:[],exit_rule:{extract:true,require_clear:false}};
 const t={...terms(100000),rules_version:10,modules:['custom10:'+JSON.stringify(floor)],sockets:[]};
 assert.match(editionRulePages(t).find(p=>p.title.includes('departure'))!.text,/Clear all enemies/);
 assert.throws(()=>editionRulePages({...t,rules_version:14}));
 assert.throws(()=>editionRulePages({...t,modules:['custom11:{}']}));
});
test('untuned charger disclosure distinguishes charge and adjacent damage',()=>{
 const floor:CustomFloor={tiles:['#######','#.....#','#.....#','#.....#','#######'],spawn:{x:1,y:1},exit:{x:5,y:3},sockets:[{x:3,y:2}],tuning:[],devices:[],exit_rule:{extract:true,require_clear:true}};
 const pages=editionRulePages({...terms(100000),rules_version:11,modules:[encodeCustomModule(floor,'missions')],sockets:[{id:'c',room:0,slot:0,enemy:'charger',trap:false,reward:null}]});
 assert.match(pages.find(p=>p.title.includes('enemy'))!.text,/4 charge damage, 3 close attack damage/);
});
