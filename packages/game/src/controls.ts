import type {RunState} from './state';
import type {Action} from './actions';
export function keyAction(s:RunState,e:{key:string;repeat?:boolean;metaKey?:boolean;ctrlKey?:boolean;altKey?:boolean}):Action|null{
 if(e.repeat||e.metaKey||e.ctrlKey||e.altKey)return null;
 const key=e.key.toLowerCase();
 if(key==='g')return {type:'guard'};
 if(key===' ')return {type:'wait'};
 if(key==='e'&&s.depth)return {type:'interact'};
 const d:Record<string,number[]>={arrowup:[0,-1],w:[0,-1],arrowdown:[0,1],s:[0,1],arrowleft:[-1,0],a:[-1,0],arrowright:[1,0],d:[1,0]};
 if(!d[key])return null;
 const x=s.player.x+d[key][0],y=s.player.y+d[key][1];
 const enemy=s.enemies.find(e=>e.x===x&&e.y===y);
 return enemy?{type:'attack',enemyId:enemy.id}:{type:'move',x,y};
}
