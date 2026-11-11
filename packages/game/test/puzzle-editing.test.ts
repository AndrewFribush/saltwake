import test from 'node:test';
import assert from 'node:assert/strict';
import {placePuzzlePiece,puzzleAt,removePuzzleThing,connectRooms,oneWay,isSealedArena,makeSealedArena,deadEndFloors,channelWiring,type PlaceOptions} from '../src/puzzle-editing';
import {validateCustomFloor,floorFormat,validateFloorGraph,type CustomFloor} from '../../shared/src/custom-layout';
import {validateMechanismNetwork} from '../../shared/src/mechanisms';
import {plateChannels} from '../../shared/src/depth-components';
const open=['###########',...Array(5).fill('#.........#'),'###########'];
const floor=():CustomFloor=>({tiles:[...open],spawn:{x:1,y:1},exit:{x:9,y:5},sockets:[{x:5,y:5}],tuning:[],devices:[],exit_rule:{extract:true,require_clear:false},features:[]});
let n=0;const o=(patch:Partial<PlaceOptions>={}):PlaceOptions=>({id:`p${n++}`,channel:'gate',color:'brass',mode:'toggle',openWhen:true,to:1,requireClear:false,...patch});

test('puzzle panel places plates, keys, locks, switches and gates in one place, wired by channel',()=>{
 const floors=[floor()];
 assert.equal(placePuzzlePiece(floors,0,'plate',2,3,o()),null);
 assert.equal(placePuzzlePiece(floors,0,'door',6,3,o()),null);
 assert.equal(placePuzzlePiece(floors,0,'key',3,4,o()),null);
 assert.equal(placePuzzlePiece(floors,0,'lock',7,2,o()),null);
 assert.equal(placePuzzlePiece(floors,0,'switch',4,1,o({channel:'side',mode:'set'})),null);
 assert.match(placePuzzlePiece(floors,0,'key',5,5,o())!,/already holds/);
 assert.match(placePuzzlePiece(floors,0,'plate',0,0,o())!,/floor tiles/);
 assert.match(placePuzzlePiece(floors,0,'door',8,1,o({channel:'9bad'}))!,/Channels/);
 assert.match(placePuzzlePiece(floors,0,'passage',8,1,o())!,/connected rooms/);
 assert.deepEqual(validateCustomFloor(floors[0],floorFormat(floors[0])),[]);
 assert.deepEqual(validateMechanismNetwork(floors,plateChannels(floors)),[]);
 const wiring=channelWiring(floors,0);
 assert.deepEqual(wiring.map(w=>w.channel),['gate','side']);
 assert.equal(wiring[0].plates.length,1);assert.equal(wiring[0].doors.length,1);assert.deepEqual(wiring[0].issues,[]);
 assert.match(wiring[1].issues.join(' '),/Nothing listens/);
 assert.equal(puzzleAt(floors[0],2,3)?.kind,'feature');assert.equal(puzzleAt(floors[0],6,3)?.kind,'device');
 removePuzzleThing(floors[0],puzzleAt(floors[0],6,3)!);assert.equal(puzzleAt(floors[0],6,3),null);
 assert.match(channelWiring(floors,0)[0].issues.join(' '),/Nothing listens/);
 placePuzzlePiece(floors,0,'switch',8,4,o());assert.match(channelWiring(floors,0)[0].issues.join(' '),/overridden/);
});

test('one-way passages and sealed arenas: stairs kept, no way back, exit opens once cleared, dead ends flagged',()=>{
 const floors=[floor(),floor(),floor()];
 connectRooms(floors);
 assert.deepEqual(floors.map(f=>f.links!.map(l=>l.to)),[[1],[2],[]]);
 assert.deepEqual(validateFloorGraph(floors),[]);
 assert.equal(placePuzzlePiece(floors,0,'passage',3,3,o({to:2})),null);
 assert.ok(oneWay(floors,0,floors[0].links![1]),'floor 3 has no passage back to floor 1');
 floors[2].links!.push({id:'back',x:2,y:2,to:0,require_clear:false});
 assert.ok(!oneWay(floors,0,floors[0].links![1]));
 assert.ok(!isSealedArena(floors,2));
 makeSealedArena(floors,2);
 assert.ok(isSealedArena(floors,2));assert.deepEqual(floors[2].links,[]);assert.deepEqual(floors[2].exit_rule,{extract:true,require_clear:true});
 floors[2].exit_rule={extract:false,require_clear:true};
 assert.deepEqual(deadEndFloors(floors),[2]);
 for(const f of floors)assert.deepEqual(validateCustomFloor(f,floorFormat(f)),[]);
});
