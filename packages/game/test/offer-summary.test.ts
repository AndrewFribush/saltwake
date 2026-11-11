import test from 'node:test';import assert from 'node:assert/strict';
import {offerSummary} from '../../shared/src/offer-summary';
const terms=(sockets:any[],extra:any={})=>({title:'T',rules_version:12,modules:['a','b'],sockets,opens_at_ms:'0',closes_at_ms:'1',run_duration_ms:'900000',capacity:4,no_reward:false,...extra}) as any;
test('offer summary counts threats, treasure and danger per floor',()=>{
 const s=offerSummary(terms([{id:'1',room:0,slot:0,enemy:'brute',trap:false,reward:'sword'},{id:'2',room:1,slot:0,enemy:'archer',trap:true,reward:null},{id:'3',room:1,slot:1,enemy:'archer',trap:false,reward:'tonic'}]),undefined,2);
 assert.deepEqual(s.enemies,[{name:'Drowned brute',count:1},{name:'Crossbow sentry',count:2}]);
 assert.equal(s.traps,1);assert.equal(s.randomSpots,2);assert.equal(s.danger,'Light');
 assert.ok(s.treasure.some(t=>/sword/i.test(t)));assert.match(s.record,/No one has tried/);
});
test('a deadly record raises the danger label and reports the death rate',()=>{
 const rec={attempts:5,completed:5,active:0,voided:0,extracted:1,died:4,abandoned:0,expired:0,participants:5,lootSamples:1,averageLoot:3,medianLoot:3} as any;
 const s=offerSummary(terms([{id:'1',room:0,slot:0,enemy:'pursuer',trap:false,reward:null}],{no_reward:true}),rec);
 assert.equal(s.danger,'Deadly');assert.match(s.dangerWhy,/80% of finished runs died/);assert.match(s.record,/1 escaped, 4 died/);
});
