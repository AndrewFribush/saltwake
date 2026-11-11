import {createRun,type RoomLayout} from './state';
import {enterRoom} from './generation';
import {explore} from './roguelike';
import {addItem} from './inventory';
/** Fixed, synthetic practice fixture. Never passed to economic admission. */
export function smugglersChoice(weapon:'club'|'sword'='club'){
 const s=createRun();s.rulesVersion=4;s.roguelike=true;s.explored=[];s.items={};s.originalTownIds=[];s.reservedItemIds=[];s.player.weapon=weapon;
 const room:RoomLayout={id:'smugglers-choice-v1',title:'The Smuggler’s Choice',tiles:[
  '#############',
  '#.....#.....#',
  '#.....#.....#',
  '#...........#',
  '#.....#.....#',
  '#.....#.....#',
  '#.....#.....#',
  '#.....#.....#',
  '#############',
 ],spawn:{x:1,y:3},exit:{x:1,y:1},enemies:[
  {id:'Dock rat',kind:'pursuer',hp:4,x:4,y:3,intent:{x:3,y:3},alerted:true},
  {id:'Vault boar',kind:'charger',hp:6,x:9,y:3,intent:{x:9,y:3},alerted:false},
 ],traps:[{id:'Door spikes',x:5,y:3,armed:true},{id:'Cache spikes',x:10,y:5,armed:false}]};
 s.layout=[room];
 addItem(s,{id:'practice-weapon',type:weapon,origin:'town',location:{kind:'weapon'}});
 addItem(s,{id:'practice-tonic',type:'tonic',origin:'town',location:{kind:'bag'}});
 addItem(s,{id:'practice-cache',type:'fineTonic',origin:'dungeon',location:{kind:'floor',room:0,x:11,y:5}});
 addItem(s,{id:'practice-iron',type:'iron',origin:'dungeon',location:{kind:'floor',room:0,x:10,y:6}});
 enterRoom(s,0);explore(s);s.log=['The northern stairs lead home. The eastern vault holds the cache.','Club: shove creatures away. Sword: strike harder. Escaping spends a turn.'];return s;
}
