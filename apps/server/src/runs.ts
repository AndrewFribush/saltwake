import {createHash} from 'node:crypto';
import templates from '../../../content/rooms.json';
import {createRun,type RunState,type RoomLayout} from '../../../packages/game/src/state';
import {fundedLayout} from '../../../packages/game/src/funded-layout';
import {explore,visibleTiles} from '../../../packages/game/src/roguelike';
import {enterRoom,atClearedExit,hasNextRoom} from '../../../packages/game/src/generation';
import {addItem} from '../../../packages/game/src/inventory';
import {act,type Action} from '../../../packages/game/src/actions';
import {disposition} from '../../../packages/game/src/disposition';
import type {EconomySnapshot,EconomicRun,Partition,Command} from '../../../packages/shared/src/types';
import {Store} from './db';
import {Outbox} from './outbox';
export type SavedRun={id:string;profile:string;economic:EconomicRun;state:RunState;seq:number;terminal?:'extracted'|'died'|'expired'|'abandoned'|'void';settlement?:string};
const slots=[{x:3,y:1},{x:1,y:3},{x:5,y:3},{x:7,y:4}];
export class Runs {
 constructor(readonly db:Store,readonly outbox:Outbox,readonly clock=Date.now){}
 materialize(opId:string,snapshot:EconomySnapshot):SavedRun{
  const op=this.db.operation(opId);if(op?.status!=='Applied'||op.command.action.type!=='admit'||op.receipt?.status!=='Applied'||!op.receipt.run)throw Error('Admission not confirmed');
  const economic=op.receipt.run;const prior=this.db.get<SavedRun>('run',economic.id);if(prior)return prior;
  const edition=snapshot.editions.find(e=>e.id===economic.edition);if(!edition)throw Error('Missing confirmed edition');
  const state=createRun();state.items={};state.originalTownIds=[];state.reservedItemIds=[];
  if(![1,2].includes(edition.terms.rules_version))throw Error('Unsupported rules version');
  const generated=edition.terms.rules_version===2?fundedLayout(economic.seed,edition.terms.modules):undefined;
  if(generated){state.roguelike=true;state.explored=[];}
  const position=(room:number,slot:number)=>generated?generated[room]?.slots[slot]:slots[slot];
  state.layout=edition.terms.modules.map((id,index)=>{
   const template=templates.find(t=>t.id===id);if(!template)throw Error('Unsupported room template');
   const r:RoomLayout=generated?generated[index].layout:{...structuredClone(template),enemies:[],traps:[]};
   for(const socket of edition.terms.sockets.filter(s=>s.room===index)){
    const p=position(index,socket.slot);if(!p)throw Error('Invalid socket slot');
    if(socket.enemy!=='none')r.enemies.push({...p,id:socket.id,kind:socket.enemy,hp:socket.enemy==='charger'?6:4,intent:{...p},...(generated?{alerted:false}:{})});
    if(socket.trap)r.traps.push({...p,id:socket.id+'-trap',armed:true});
   }return r;
  });
  for(const id of economic.loadout_ids){const item=snapshot.items.find(i=>i.id===id);if(!item)throw Error('Missing loadout');
   const equipped=Object.values(state.items);const kind=item.item_type==='armor'&&!equipped.some(i=>i.location.kind==='armor')?'armor':['club','sword'].includes(item.item_type)&&!equipped.some(i=>i.location.kind==='weapon')?'weapon':'bag';
   addItem(state,{id,type:item.item_type,origin:'town',location:{kind}});if(kind==='weapon')state.player.weapon=item.item_type as 'club'|'sword';if(kind==='armor')state.player.armor=true;
  }
  for(const assignment of economic.assignments){const item=snapshot.items.find(i=>i.id===assignment.item_id);const socket=edition.terms.sockets.find(s=>s.id===assignment.socket);if(!item||!socket)throw Error('Missing reserved assignment');addItem(state,{id:item.id,type:item.item_type,origin:'dungeon',location:{kind:'floor',room:socket.room,...position(socket.room,socket.slot)!}});}
  enterRoom(state,0);explore(state);const row:SavedRun={id:economic.id,profile:economic.player,economic,state,seq:0};this.db.put('run',row.id,row);return row;
 }
 get(id:string,profile:string){const row=this.db.get<SavedRun>('run',id);if(!row||row.profile!==profile)throw Error('Run owner mismatch');return row;}
 view(id:string,profile:string){const row=this.get(id,profile);const state=structuredClone(row.state);
  // Only the present room's geometry/encounters and already carried goods cross HTTP.
  delete state.layout;
  delete state.expeditionSeed;
  const visible=visibleTiles(row.state);
  const isVisible=(p:{x:number;y:number})=>visible.has(`${p.x},${p.y}`);
  if(state.roguelike){
   const explored=new Set(state.explored??[]);
   state.room=state.room.map((line,y)=>[...line].map((tile,x)=>explored.has(`${state.roomIndex}:${x},${y}`)?tile:'?').join(''));
   state.enemies=state.enemies.filter(isVisible).map(e=>({...e,intent:isVisible(e.intent)?e.intent:{x:e.x,y:e.y},lane:e.lane?.filter(isVisible)}));
   state.traps=state.traps.filter(isVisible);
   // Off-screen combat can name dormant enemies; do not disclose those IDs via logs.
   const hiddenIds=row.state.layout!.flatMap(r=>r.enemies).filter(e=>!state.enemies.some(v=>v.id===e.id)).map(e=>e.id);
   state.log=state.log.filter(line=>!hiddenIds.some(id=>line.includes(id)));
  }
  state.items=Object.fromEntries(Object.entries(state.items).filter(([,i])=>i.location.kind!=='floor'||(i.location.room===state.roomIndex&&(!state.roguelike||isVisible(i.location)))));
  state.reservedItemIds=state.reservedItemIds.filter(id=>id in state.items);
  const terminalOp=row.settlement?this.db.operation(row.settlement):undefined;
  const settled=terminalOp?.status==='Applied'&&(terminalOp.command.action.type==='settle'||terminalOp.command.action.type==='void')?terminalOp.command.action.disposition:null;
  const disclosed=settled?Object.fromEntries(Object.entries(settled).map(([key,ids])=>[key,state.roguelike?ids.filter(itemId=>itemId in state.items):ids])):null;
  const withheldCounts=settled?Object.fromEntries(Object.entries(settled).map(([key,ids])=>[key,ids.length-(disclosed?.[key]?.length??0)])):null;
  return {id,profile,seq:row.seq,state,deadline:row.economic.deadline_ms,roomTitle:row.state.layout![state.roomIndex].title,exit:row.state.layout![state.roomIndex].exit,roomCount:row.state.layout!.length,canExtract:!row.terminal&&state.status==='active'&&this.clock()<Number(row.economic.deadline_ms)&&atClearedExit(row.state),hasNextRoom:hasNextRoom(row.state),terminal:row.terminal??null,settlement:terminalOp?{status:terminalOp.status,reason:terminalOp.reason??null,receipt:terminalOp.receipt?.status==='Applied'||terminalOp.receipt?.status==='Rejected'?{status:terminalOp.receipt.status,result:terminalOp.receipt.result}:null,disposition:disclosed,withheldCounts}:null};
 }
 action(id:string,profile:string,actionId:string,expectedSeq:number,action:Action){
  if(!/^[\w-]{1,64}$/.test(actionId)||!Number.isSafeInteger(expectedSeq)||JSON.stringify(action).length>2048)throw Error('Invalid action envelope');
  const hash=createHash('sha256').update(JSON.stringify({expectedSeq,action})).digest('hex');
  return this.db.transaction(()=>{
   const row=this.get(id,profile);const key=id+':'+actionId;const prior=this.db.get<{hash:string;view:ReturnType<Runs['view']>}>('action',key);
   if(prior){if(prior.hash!==hash)throw Error('Action payload conflict');return prior.view;}
   if(row.terminal)throw Error('Run terminal');if(row.seq!==expectedSeq)throw Error('Stale action sequence');if(row.seq>=2048)throw Error('Run action capacity');
   if(this.clock()>=Number(row.economic.deadline_ms)){this.finish(row,'expired');const view=this.view(id,profile);this.db.put('action',key,{hash,view});return view;}
   const next=act(row.state,action);if(next===row.state)throw Error('Action not permitted');
   row.state=next;row.seq++;row.state.log=row.state.log.slice(-200);this.db.put('run',id,row);
   if(next.status!=='active')this.finish(row,next.status);
   const view=this.view(id,profile);this.db.put('action',key,{hash,view});return view;
  });
 }
 finish(row:SavedRun,outcome:NonNullable<SavedRun['terminal']>){
  if(row.terminal)return;
  const d=disposition(row.state,outcome==='extracted'?'extracted':outcome==='void'?'void':'died');
  const partition:Partition={town_consumed:d.townConsumed,town_returned:d.townReturned,town_forfeited:d.townForfeited,dungeon_consumed:d.dungeonConsumed,dungeon_extracted:d.dungeonExtracted,dungeon_returned:d.dungeonReturned};
  const action:Command['action']=outcome==='void'?{type:'void',run_id:row.id,reason:'Operator run failure',disposition:partition}:{type:'settle',run_id:row.id,outcome,disposition:partition,carried_dungeon_ids:d.dungeonExtracted};
  row.terminal=outcome;row.settlement='terminal-'+row.id;this.outbox.enqueue(row.settlement,{actor:row.profile,action});this.db.put('run',row.id,row);
 }
 retryExpiry(chainNow:number){for(const row of this.db.all<SavedRun>('run')){const previous=row.settlement?this.db.operation(row.settlement):undefined;if(row.terminal==='expired'&&previous?.status==='Rejected'&&previous.receipt?.status==='Rejected'&&previous.receipt.result==='PrematureExpiry'&&chainNow>=Number(row.economic.deadline_ms))this.db.transaction(()=>{const id='expiry-retry-'+row.id;this.outbox.enqueue(id,previous.command);row.settlement=id;this.db.put('run',row.id,row);});}}
 expire(){for(const row of this.db.all<SavedRun>('run'))if(!row.terminal&&this.clock()>=Number(row.economic.deadline_ms))this.db.transaction(()=>this.finish(row,'expired'));}
}
