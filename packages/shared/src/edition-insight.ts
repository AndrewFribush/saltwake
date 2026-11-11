/** Maker-facing summary of how an edition actually played, from finished runs the server hosted. */
export type RunLoot={socket:string;item_type:string;fate:'taken'|'left'|'used'|'lost'};
export type RunMark={floor:number;x:number;y:number;outcome:string;turn:number;killer?:string;floors?:number[];loot?:RunLoot[]};
export type SpotLoot={socket:string;item_type:string;funded:number;taken:number;left:number;used:number;lost:number};
export type EditionInsight={runs:number;died:number;escaped:number;other:number;funnel:{floor:number;reached:number;died:number}[];topKillers:{name:string;deaths:number}[];loot:SpotLoot[];suggestions:string[]};

const killerName=(k:string)=>k.replace(/ #\S+$/,'').replace(/^floor-\d+-slot-\d+$/,'an enemy');
const floorOf=(socket:string)=>Number(/^floor-(\d+)-/.exec(socket)?.[1]??NaN);

export function editionInsight(marks:readonly RunMark[],floorCount:number):EditionInsight{
 const runs=marks.length,died=marks.filter(m=>m.outcome==='died').length,escaped=marks.filter(m=>m.outcome==='extracted').length;
 const funnel=Array.from({length:Math.max(1,floorCount)},(_,floor)=>({floor,reached:marks.filter(m=>(m.floors??[m.floor]).includes(floor)||m.floor>floor).length,died:marks.filter(m=>m.outcome==='died'&&m.floor===floor).length}));
 const killers=new Map<string,number>();for(const m of marks)if(m.outcome==='died'&&m.killer){const k=killerName(m.killer);killers.set(k,(killers.get(k)??0)+1);}
 const topKillers=[...killers].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([name,deaths])=>({name,deaths}));
 const spots=new Map<string,SpotLoot>();
 for(const m of marks)for(const l of m.loot??[]){const s=spots.get(l.socket)??{socket:l.socket,item_type:l.item_type,funded:0,taken:0,left:0,used:0,lost:0};s.funded++;s[l.fate]++;spots.set(l.socket,s);}
 const loot=[...spots.values()].sort((a,b)=>a.socket.localeCompare(b.socket));
 const suggestions:string[]=[];
 if(runs===0)suggestions.push('No finished runs yet. Results appear here as delvers play it.');
 else{
  const worst=funnel.reduce((a,b)=>b.died>a.died?b:a,funnel[0]);const taken=loot.reduce((n,s)=>n+s.taken,0);
  const treasureFloors=loot.map(s=>floorOf(s.socket)).filter(Number.isFinite);const firstTreasure=treasureFloors.length?Math.min(...treasureFloors):undefined;
  if(died/runs>=0.6&&worst.died>0){
   const k=topKillers[0];const beforeTreasure=firstTreasure!==undefined&&worst.floor<=firstTreasure&&taken===0;
   suggestions.push(`Most delvers die${k?` to the ${k.name}`:''} on floor ${worst.floor+1}${beforeTreasure?' before reaching any treasure':''}. Soften that fight (fewer or weaker enemies, more cover) or give them a reason to push on.`);
  }
  if(escaped/runs>=0.8&&loot.length&&taken/Math.max(1,loot.reduce((n,s)=>n+s.funded,0))>=0.8)suggestions.push('Nearly everyone escapes with the treasure. Add a guard or raise the entry fee.');
  if(escaped/runs>=0.6&&loot.length&&taken===0)suggestions.push('Delvers escape but leave the treasure. It may be hidden too well, guarded too hard, or not worth the risk.');
  const stall=funnel.findIndex((f,i)=>i>0&&f.reached<funnel[i-1].reached*0.5);
  if(stall>0&&!suggestions.length)suggestions.push(`Few delvers reach floor ${stall+1}. Check what stops them on floor ${stall}.`);
  if(!loot.length&&escaped/runs>=0.8)suggestions.push('Almost everyone escapes and there is no treasure to fight for. Add a reward or a sharper threat.');
  if(runs<3)suggestions.push(`Only ${runs} ${runs===1?'run':'runs'} so far: wait for more before big changes.`);
  if(!suggestions.length)suggestions.push('A mix of deaths and escapes: the risk looks balanced.');
 }
 return {runs,died,escaped,other:runs-died-escaped,funnel,topKillers,loot,suggestions};
}
