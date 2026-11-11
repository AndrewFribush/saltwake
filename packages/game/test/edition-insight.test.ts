import test from 'node:test';
import assert from 'node:assert/strict';
import {editionInsight,type RunMark} from '../../shared/src/edition-insight';

const died=(floor:number,killer:string,loot:RunMark['loot']=[]):RunMark=>({floor,x:1,y:1,outcome:'died',turn:5,killer,floors:Array.from({length:floor+1},(_,i)=>i),loot});
const out=(floors:number[],loot:RunMark['loot']=[]):RunMark=>({floor:floors.at(-1)!,x:1,y:1,outcome:'extracted',turn:9,floors,loot});

test('funnel, killers, loot per spot and a suggestion when a fight blocks the treasure',()=>{
 const sword=(fate:'taken'|'left'|'lost')=>[{socket:'floor-1-slot-0',item_type:'sword',fate}];
 const i=editionInsight([died(0,'charger #floor-0-slot-1',sword('lost')),died(0,'charger #floor-0-slot-1',sword('lost')),died(0,'brute #floor-0-slot-2',sword('lost')),out([0],sword('left'))],2);
 assert.equal(i.runs,4);assert.equal(i.died,3);assert.equal(i.escaped,1);
 assert.deepEqual(i.funnel,[{floor:0,reached:4,died:3},{floor:1,reached:0,died:0}]);
 assert.deepEqual(i.topKillers[0],{name:'charger',deaths:2});
 assert.deepEqual(i.loot,[{socket:'floor-1-slot-0',item_type:'sword',funded:4,taken:0,left:1,used:0,lost:3}]);
 assert.match(i.suggestions[0],/die to the charger on floor 1 before reaching any treasure/);
});
test('easy treasure and empty results produce their own advice',()=>{
 const t=[{socket:'floor-0-slot-0',item_type:'tonic',fate:'taken' as const}];
 assert.match(editionInsight([out([0],t),out([0],t),out([0],t),out([0],t),out([0],t)],1).suggestions.join(' '),/Nearly everyone escapes with the treasure/);
 assert.match(editionInsight([],1).suggestions[0],/No finished runs yet/);
 assert.match(editionInsight([out([0])],1).suggestions.join(' '),/Only 1 run so far/);
});
