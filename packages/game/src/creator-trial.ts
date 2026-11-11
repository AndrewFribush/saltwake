import {enterRoom} from './generation';import {explore} from './roguelike';
import {encodeBlueprint} from '../../shared/src/blueprint';
import {creatorRehearsal,type RehearsalKit,type RehearsalSample} from './authored-layout';
import {actWithMessages,type Action} from './actions';
import {appendPlayEvent,type PlayTrace} from './play-events';
import type {CustomFloor} from '../../shared/src/custom-layout';import type {CreatorPlacement} from '../../shared/src/creator-rewards';import type {ItemType} from '../../shared/src/types';import type {RunState} from './state';
export type TrialDesign={floors:CustomFloor[];placements:CreatorPlacement[][]};
export type CreatorTrial={id:string;draftId:string;startFloor?:number;design:TrialDesign;kit:RehearsalKit;sample:RehearsalSample;trace:PlayTrace;outcome:RunState['status']|'stopped';turns:number;health:number;floor:number;position:{x:number;y:number}};
export type TrialSession={id:string;draftId:string;startFloor?:number;design:TrialDesign;kit:RehearsalKit;sample:RehearsalSample;trace:PlayTrace;state:RunState};
export function designMatches(a:TrialDesign,b:TrialDesign){return JSON.stringify(a.floors)===JSON.stringify(b.floors)&&JSON.stringify(a.placements)===JSON.stringify(b.placements);}
export function startTrial(id:string,draftId:string,design:TrialDesign,kit:RehearsalKit,sample:RehearsalSample,startFloor=0):TrialSession{
 if(!Number.isInteger(startFloor)||startFloor<0||startFloor>=design.floors.length)throw Error('Invalid rehearsal starting floor');
 const state=creatorRehearsal(design.floors,design.placements,kit,sample);if(startFloor){state.explored=[];enterRoom(state,startFloor);explore(state);}
 return {id,draftId,startFloor,design:structuredClone(design),kit,sample:structuredClone(sample),trace:{events:[],dropped:0},state};
}
export function stepTrial(session:TrialSession,action:Action):TrialSession{let messages:string[]=[];const state=actWithMessages(session.state,action,m=>{messages=m;});if(state===session.state)return session;let trace=appendPlayEvent(session.trace,session.state,action,state,messages);const excess=Math.max(0,trace.events.length-128);if(excess)trace={events:trace.events.slice(excess),dropped:trace.dropped+excess};return {...session,state,trace};}
export function finishTrial(s:TrialSession):CreatorTrial{return {id:s.id,draftId:s.draftId,startFloor:s.startFloor??0,design:structuredClone(s.design),kit:s.kit,sample:structuredClone(s.sample),trace:structuredClone(s.trace),outcome:s.state.status==='active'?'stopped':s.state.status,turns:s.state.turn,health:s.state.player.hp,floor:s.state.roomIndex,position:{x:s.state.player.x,y:s.state.player.y}};}
export function appendTrial(book:CreatorTrial[],trial:CreatorTrial):CreatorTrial[]{return [...book.filter(t=>t.id!==trial.id),trial].slice(-5);}
/** Stored data is display-only. Never execute imported actions or use this as economic evidence. */
export function decodeTrialBook(text:string):CreatorTrial[]{
 if(text.length>500000)throw Error('Trial notebook exceeds 500 KB');const value=JSON.parse(text);if(value?.version!==1||!Array.isArray(value.trials)||value.trials.length>5)throw Error('Unsupported trial notebook');
 for(const t of value.trials){if(!t||typeof t.id!=='string'||t.id.length>64||typeof t.draftId!=='string'||t.draftId.length>64||!['club','sword','armored','unarmed'].includes(t.kit)||!['active','stopped','died','extracted'].includes(t.outcome)||!Number.isInteger(t.turns)||t.turns<0||!Number.isInteger(t.health)||t.health<0||t.health>12||!Number.isInteger(t.floor)||t.floor<0||t.floor>15||!t.position||!Number.isInteger(t.position.x)||!Number.isInteger(t.position.y)||!t.trace||!Array.isArray(t.trace.events)||t.trace.events.length>128||!Number.isInteger(t.trace.dropped)||t.trace.dropped<0)throw Error('Invalid trial record');
  if(t.startFloor!==undefined&&(!Number.isInteger(t.startFloor)||t.startFloor<0||t.startFloor>=t.design?.floors?.length))throw Error('Invalid trial starting floor');
  encodeBlueprint({title:'Trial validation',fee:'0',...t.design});
  const validPosition=(p:{x:number;y:number},floor:number)=>p.x>=0&&p.x<(t.design.floors[floor]?.tiles[0]?.length??0)&&p.y>=0&&p.y<(t.design.floors[floor]?.tiles.length??0);
  if(t.floor>=t.design.floors.length||!validPosition(t.position,t.floor))throw Error('Invalid trial finish location');
  creatorRehearsal(t.design?.floors,t.design?.placements,t.kit,t.sample);
  for(const e of t.trace.events)if(!e||!Number.isInteger(e.seq)||!Number.isInteger(e.turn)||!Number.isInteger(e.roomIndex)||e.roomIndex<0||e.roomIndex>=t.design.floors.length||!Number.isFinite(e.hpBefore)||!Number.isFinite(e.hpAfter)||!e.position||!Number.isInteger(e.position.x)||!Number.isInteger(e.position.y)||!validPosition(e.position,e.roomIndex)||e.hpBefore<0||e.hpBefore>12||e.hpAfter<0||e.hpAfter>12||!e.action||typeof e.action.type!=='string'||!Array.isArray(e.messages)||e.messages.some((m:unknown)=>typeof m!=='string'||m.length>600))throw Error('Invalid recorded turn');
 }
 return value.trials;
}
