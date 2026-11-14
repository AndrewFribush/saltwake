/** The run journal (roguelike message log) accumulates engine messages the state no longer carries: the engine trims
 * `log` to its last 8 lines after every action. Given the previous and the next log, these are the new lines. */
export function freshLines(prev:readonly string[],next:readonly string[]):string[]{
 for(let k=Math.min(prev.length,next.length);k>0;k--){let same=true;for(let i=0;i<k;i++)if(prev[prev.length-k+i]!==next[i]){same=false;break;}if(same)return next.slice(k);}
 return [...next];
}
