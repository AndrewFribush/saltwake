import type {Action} from './actions';
import type {RunState} from './state';
export type PlayEvent={seq:number;turn:number;roomIndex:number;rulesVersion:number;action:Action;hpBefore:number;hpAfter:number;position:{x:number;y:number};outcome:RunState['status'];messages:string[]};
export type PlayTrace={events:PlayEvent[];dropped:number};
/** Local observer trace, never a gameplay authority or a source of rewards. */
export function appendPlayEvent(trace:PlayTrace,before:RunState,action:Action,after:RunState,messages:string[]=[]):PlayTrace{
 if(before===after)return trace;
 const event:PlayEvent={seq:trace.dropped+trace.events.length+1,turn:after.turn,roomIndex:after.roomIndex,rulesVersion:after.rulesVersion??1,action:structuredClone(action),hpBefore:before.player.hp,hpAfter:after.player.hp,position:{x:after.player.x,y:after.player.y},outcome:after.status,messages:[...messages]};
 const events=[...trace.events,event];const excess=Math.max(0,events.length-2048);
 return {events:events.slice(excess),dropped:trace.dropped+excess};
}
