import test from 'node:test';
import assert from 'node:assert/strict';
import {blueprintFromEdition} from '../../shared/src/clone-design';
import {decodeBlueprint,encodeBlueprint} from '../../shared/src/blueprint';
import {encodeCustomModule,type CustomFloor} from '../../shared/src/custom-layout';

const floor=():CustomFloor=>({tiles:['#########','#.......#','#.......#','#.......#','#########'],spawn:{x:1,y:1},exit:{x:7,y:3},sockets:[{x:3,y:2},{x:5,y:2}]});
const terms=(modules:string[])=>({title:'Smugglers vault',rules_version:3,modules,sockets:[{id:'floor-0-slot-0',room:0,slot:0,enemy:'pursuer',trap:true,reward:'sword'},{id:'floor-0-slot-1',room:0,slot:1,enemy:'none',trap:false,reward:null}],opens_at_ms:'0',closes_at_ms:'1',no_reward:false,difficulty_tag:'standard',style_tag:'combat',run_duration_ms:'900000',max_runs:4}) as any;

test('a published player-built edition copies into an editable, attributed draft without goods',()=>{
 const e={id:'edition-7',maker:'wallet:ana.testnet',terms:terms([encodeCustomModule(floor(),'sized')]),randomTables:[{table_id:'gems',socket_ids:['floor-0-slot-1']}]};
 const b=blueprintFromEdition(e,'ana.testnet');
 assert.equal(b.title,'Smugglers vault (copy)');assert.equal(b.fee,'0');
 assert.deepEqual(b.source,{title:'Smugglers vault',maker:'ana.testnet',edition:'edition-7'});
 assert.deepEqual(b.placements,[[{enemy:'pursuer',trap:true,reward:'sword'},{enemy:'none',trap:false,reward:'random',randomPool:'gems'}]]);
 assert.deepEqual(b.floors[0].tiles,floor().tiles);
 const text=encodeBlueprint(b);assert.ok(!/funded|item_ids|bank-|maker-/.test(text.replace('"maker": "ana.testnet"','')),'no goods or funding identities travel');
 assert.deepEqual(decodeBlueprint(text).source,b.source,'attribution survives export and import');
});
test('developer preset rooms cannot be copied; bad attribution is rejected',()=>{
 assert.throws(()=>blueprintFromEdition({id:'e',maker:'maker',terms:terms(['cellar'])}),/player-built/);
 const b=blueprintFromEdition({id:'e',maker:'maker',terms:terms([encodeCustomModule(floor(),'sized')])});
 assert.throws(()=>decodeBlueprint(encodeBlueprint({...b,source:{title:'',maker:'x'}})),/attribution/);
});
