import {smugglersChoice} from '../../../packages/game/src/smugglers-choice';
import {act,type Action} from '../../../packages/game/src/actions';
import type {RunState} from '../../../packages/game/src/state';
import {writeFileSync} from 'node:fs';
const start=smugglersChoice('sword');type Node={s:RunState;actions:Action[]};let beam:Node[]=[{s:start,actions:[]}];const seen=new Set<string>();
function score(s:RunState){const held=s.items['practice-cache'].location.kind==='bag';const target=held?{x:1,y:1}:{x:11,y:5};return Math.abs(s.player.x-target.x)+Math.abs(s.player.y-target.y)+(12-s.player.hp)*.6+(held?-25:0);}
let found:Node|undefined;
for(let depth=0;depth<100&&!found;depth++){
 const next:Node[]=[];
 for(const n of beam){const s=n.s;const actions:Action[]=[...[[0,-1],[0,1],[-1,0],[1,0]].map(([dx,dy])=>({type:'move' as const,x:s.player.x+dx,y:s.player.y+dy})),...s.enemies.map(e=>({type:'attack' as const,enemyId:e.id})),{type:'guard'},{type:'wait'},{type:'use',itemId:'practice-tonic'},{type:'pickup',itemId:'practice-cache'},{type:'extract'}];
 for(const a of actions){const state=act(s,a);if(state===s||state.status==='died')continue;const row={s:state,actions:[...n.actions,a]};if(state.status==='extracted'){if(state.items['practice-cache'].location.kind==='bag'){found=row;break;}continue;}
 const key=JSON.stringify([state.player,state.enemies,state.traps,state.items]);if(seen.has(key))continue;seen.add(key);next.push(row);
 }if(found)break;}
 beam=next.sort((a,b)=>score(a.s)-score(b.s)).slice(0,160);if(!beam.length)break;
}
if(!found)throw Error('No route found within bounded beam search');writeFileSync('docs/evidence/loop-v1/cache-route.json',JSON.stringify({fixture:'smugglers-choice-v1',kit:'sword',hp:found.s.player.hp,actions:found.actions},null,2));console.log(JSON.stringify({turns:found.s.turn,hp:found.s.player.hp,actions:found.actions}));
