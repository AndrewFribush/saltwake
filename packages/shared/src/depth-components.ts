// Rules v12 ("depth") component vocabulary. Every field is explicit so the contract,
// builder, rehearsal and authoritative play read one definition without hidden defaults.
// Older rule versions never interpret any of this; their editions keep their behavior.
import {wellFormedId} from './mechanisms';
export const depthRulesVersion=12;
export type EnemyKind='pursuer'|'charger'|'archer'|'bomber'|'brute'|'nest';
export const depthEnemyKinds=['archer','bomber','brute','nest'] as const;
export const enemyKinds=['pursuer','charger',...depthEnemyKinds] as const;
/** Placement coins and defaults per enemy. Nest damage is the damage of the rats it hatches. */
export const enemyCatalog:Record<EnemyKind,{name:string;hp:number;damage:number;alert:number;cost:number;summary:string}>={
 pursuer:{name:'Pursuer',hp:4,damage:3,alert:5,cost:2,summary:'Follows walkable routes and commits its next step or bite.'},
 charger:{name:'Charger',hp:6,damage:4,alert:5,cost:3,summary:'When aligned, commits to a straight lane, hits the first creature in it, then recovers a turn.'},
 archer:{name:'Crossbow sentry',hp:3,damage:2,alert:5,cost:3,summary:'Keeps its distance. When you share a row or column within 6 tiles it aims, shows the bolt line, and fires next turn at the first creature in it. Reloads one turn.'},
 bomber:{name:'Powder crab',hp:2,damage:4,alert:5,cost:2,summary:'Scuttles toward you. Once adjacent it lights its fuse and bursts next turn, hitting every creature in the 3×3 around it. Kill it before it lights, or step clear.'},
 brute:{name:'Drowned brute',hp:10,damage:5,alert:4,cost:4,summary:'Slow: acts every other turn. Winds up a sweeping smash over the tile in front of it and both flanking tiles. Too heavy to shove.'},
 nest:{name:'Rat nest',hp:6,damage:1,alert:5,cost:4,summary:'Stationary. Once awake, hatches a rat every 4 turns on a marked tile (at most 3 alive, 6 total). Rats have 2 health.'},
};
export const ratHp=2,nestPeriod=4,nestAlive=3,nestTotal=6,archerRange=6;
export type SupplyKind='bomb'|'dart'|'flash';
export const supplyCatalog:Record<SupplyKind,{name:string;summary:string;range:number}>={
 bomb:{name:'Powder bomb',range:4,summary:'Throw at a visible tile within 4: bursts at once for 4 damage in a 3×3 square (you too), breaks cracked walls, lights kegs and oil.'},
 dart:{name:'Throwing dart',range:5,summary:'Throw along a clear row or column within 5: 2 damage to the first creature hit.'},
 flash:{name:'Flash powder',range:0,summary:'Stuns every enemy within 2 tiles for 2 turns. Stunned enemies cannot act.'},
};
export const bombDamage=4,dartDamage=2,flashRadius=2,flashTurns=2,maxSupplies=9;
export type AltarBoon='might'|'ward'|'sight';
export const altarBoons:Record<AltarBoon,string>={might:'+1 attack damage for the rest of the run',ward:'Each hit against you is reduced by 1 more for the rest of the run',sight:'Reveals this floor map, its loot and features'};
export type Feature={id:string;x:number;y:number}&(
 |{kind:'barrel';damage:number}
 |{kind:'crack';hp:number}
 |{kind:'oil'}
 |{kind:'pit'}
 |{kind:'fountain';heal:number;charges:number}
 |{kind:'altar';boon:AltarBoon;cost:number}
 |{kind:'cache';supply:SupplyKind;count:number}
 // Rules v13 progression components.
 |{kind:'key';color:string}
 |{kind:'lock';color:string}
 |{kind:'plate';channel:string}
);
export type FeatureKind=Feature['kind'];
type Range={min:number;max:number;default:number;label:string};
/** A named-string field (key colour or signal channel): letter first, then letters, digits, _ or -, at most 32. */
export type NameField={name:true;default:string;label:string};
export const progressionRulesVersion=13;
export const featureCatalog:Record<FeatureKind,{name:string;cost:number;onWall?:boolean;since?:number;summary:string;fields:Record<string,Range|NameField|readonly string[]>}>={
 barrel:{name:'Powder keg',cost:1,summary:'Blocks the tile. Hit it, or catch it in a blast or fire, and it lights: next turn it bursts in a 3×3 square, damaging every creature, lighting nearby kegs and oil and breaking cracked walls.',fields:{damage:{min:1,max:12,default:5,label:'Blast damage'}}},
 crack:{name:'Cracked wall',cost:1,onWall:true,summary:'Placed on a wall. Blocks movement and sight until broken: each bump deals 1, any blast breaks it. Hide side rooms or shortcuts behind it.',fields:{hp:{min:1,max:5,default:3,label:'Bumps to break'}}},
 oil:{name:'Oil slick',cost:1,summary:'Harmless until a blast or fire touches it; then it burns for 3 turns, dealing 2 damage to any creature on it and spreading to adjacent oil.',fields:{}},
 pit:{name:'Chasm',cost:1,summary:'Cannot be walked over but does not block sight. A creature shoved into it falls and is gone. Brutes cannot be shoved.',fields:{}},
 fountain:{name:'Salt spring',cost:2,summary:'Stand on it and drink to restore health. Limited draughts; it remembers what is left.',fields:{heal:{min:1,max:12,default:4,label:'Health per draught'},charges:{min:1,max:3,default:1,label:'Draughts'}}},
 altar:{name:'Blood altar',cost:2,summary:'Stand on it to make one pact: pay health now for a lasting boon. Cannot be used if it would kill you.',fields:{boon:['might','ward','sight'],cost:{min:1,max:6,default:3,label:'Health price'}}},
 cache:{name:'Supply cache',cost:2,summary:'Step on it to collect dungeon supplies. Supplies are used up in this run and never leave the dungeon.',fields:{supply:['bomb','dart','flash'],count:{min:1,max:3,default:2,label:'Supplies'}}},
 key:{name:'Key',cost:1,since:13,summary:'Step on it to pick up a key of its colour. Keys are kept across floors for this run and open one lock of the same colour.',fields:{color:{name:true,default:'brass',label:'Colour'}}},
 lock:{name:'Locked door',cost:1,since:13,summary:'Blocks movement and sight. Bump it holding a key of its colour to unlock it for good (the key is used up). Every lock needs a key of its colour somewhere in the dungeon.',fields:{color:{name:true,default:'brass',label:'Colour'}}},
 plate:{name:'Pressure plate',cost:1,since:13,summary:'Turns its channel on while any creature stands on it, off when it leaves. Wire it to gates (doors) or an exit condition with the same channel name; lure an enemy onto it to hold a gate open.',fields:{channel:{name:true,default:'plate',label:'Channel'}}},
};
export const featureKinds=Object.keys(featureCatalog) as FeatureKind[];
export const maxFeaturesPerFloor=24,maxFeaturesTotal=128;
export type Tide={turns:number;damage:number};
export const tideBounds={turns:{min:5,max:200},damage:{min:1,max:6}} as const;
export function defaultFeature(kind:FeatureKind,id:string,x:number,y:number):Feature{
 const fields=Object.fromEntries(Object.entries(featureCatalog[kind].fields).map(([k,v])=>[k,Array.isArray(v)?v[0]:(v as Range|NameField).default]));
 return {id,x,y,kind,...fields} as Feature;
}
const point=(p:any)=>!!p&&Number.isInteger(p.x)&&Number.isInteger(p.y);
export function validateTide(value:unknown):string[]{
 if(value===undefined)return [];
 const t=value as Tide;
 if(!t||typeof t!=='object'||Array.isArray(t)||Object.keys(t).some(k=>k!=='turns'&&k!=='damage'))return ['Tide needs only turns and damage.'];
 return Number.isInteger(t.turns)&&t.turns>=tideBounds.turns.min&&t.turns<=tideBounds.turns.max&&Number.isInteger(t.damage)&&t.damage>=tideBounds.damage.min&&t.damage<=tideBounds.damage.max?[]:[`Tide rises after ${tideBounds.turns.min}–${tideBounds.turns.max} turns and deals ${tideBounds.damage.min}–${tideBounds.damage.max} damage per turn.`];
}
/** Shape and placement checks for one floor's features. Connectivity is checked by the floor validator. */
export function validateFeatures(value:unknown,tiles:readonly string[],occupied:ReadonlySet<string>,version=12):string[]{
 if(!Array.isArray(value)||value.length>maxFeaturesPerFloor)return [`Use at most ${maxFeaturesPerFloor} features per floor.`];
 const errors:string[]=[],ids=new Set<string>(),taken=new Set(occupied),height=tiles.length,width=tiles[0]?.length??0;
 for(const f of value){
  if(!f||typeof f!=='object'||Array.isArray(f)||!Object.hasOwn(featureCatalog,f.kind)){errors.push('Unknown feature.');continue;}
  const spec=featureCatalog[f.kind as FeatureKind],fields=['id','x','y','kind',...Object.keys(spec.fields)];
  if(Object.keys(f).length!==fields.length||Object.keys(f).some(k=>!fields.includes(k))){errors.push(`${spec.name} fields must match its kind.`);continue;}
  if(typeof f.id!=='string'||!f.id.length||!wellFormedId(f.id)||new TextEncoder().encode(f.id).length>32||ids.has(f.id))errors.push('Feature IDs must be unique on each floor and use 1–32 bytes.');else ids.add(f.id);
  if((spec.since??12)>version){errors.push(`${spec.name} needs rules v${spec.since}.`);continue;}
  for(const [k,v] of Object.entries(spec.fields)){const got=(f as any)[k];if('name' in v?!/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(String(got))||typeof got!=='string':Array.isArray(v)?!v.includes(got):!Number.isInteger(got)||got<(v as Range).min||got>(v as Range).max)errors.push(`${spec.name}: ${Array.isArray(v)?k:(v as Range|NameField).label} is ${'name' in v?'not a valid name (letter first; letters, digits, _ or -)':'out of range'}.`);}
  if(!point(f)||f.x<0||f.y<0||f.x>=width||f.y>=height){errors.push('Features need whole tile coordinates within the floor.');continue;}
  const key=`${f.x},${f.y}`;if(taken.has(key))errors.push(`${spec.name} at ${key} overlaps another marker.`);taken.add(key);
  if(spec.onWall){
   const boundary=f.x===0||f.y===0||f.x===width-1||f.y===height-1;
   if(tiles[f.y][f.x]!=='#'||boundary||![[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>tiles[f.y+dy]?.[f.x+dx]==='.'))errors.push(`${spec.name} at ${key} must sit on an inner wall beside floor.`);
  }else if(tiles[f.y][f.x]!=='.')errors.push(`${spec.name} at ${key} must be on floor.`);
 }
 return errors;
}
/** Floor tiles reachable from spawn when cracked walls and kegs are broken; chasms block. */
export function depthReachable(tiles:readonly string[],spawn:{x:number;y:number},features:readonly Feature[]):{reached:Set<string>;missing:number;first?:{x:number;y:number}}{
 const cracks=new Set(features.filter(f=>f.kind==='crack'||f.kind==='lock').map(f=>`${f.x},${f.y}`)),pits=new Set(features.filter(f=>f.kind==='pit').map(f=>`${f.x},${f.y}`));
 const open=(x:number,y:number)=>!pits.has(`${x},${y}`)&&(tiles[y]?.[x]==='.'||cracks.has(`${x},${y}`));
 const reached=new Set<string>([`${spawn.x},${spawn.y}`]),queue=[spawn];
 for(const p of queue)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,y=p.y+dy,key=`${x},${y}`;if(open(x,y)&&!reached.has(key)){reached.add(key);queue.push({x,y});}}
 let missing=0,first:{x:number;y:number}|undefined;
 for(let y=0;y<tiles.length;y++)for(let x=0;x<tiles[y].length;x++)if(open(x,y)&&!reached.has(`${x},${y}`)){missing++;first??={x,y};}
 return {reached,missing,first};
}
export function validateDepthNetwork(floors:readonly {features?:readonly Feature[]}[]):string[]{
 const total=floors.reduce((n,f)=>n+(f.features?.length??0),0);
 return total>maxFeaturesTotal?[`Use at most ${maxFeaturesTotal} features across all floors.`]:[];
}
export function featureCost(floors:readonly {features?:readonly Feature[]}[]):number{return floors.reduce((n,f)=>n+(f.features??[]).reduce((m,x)=>m+featureCatalog[x.kind].cost,0),0);}
export function enemyCost(kind:string):number{return Object.hasOwn(enemyCatalog,kind)?enemyCatalog[kind as EnemyKind].cost:0;}
/** True when a design needs rules v12; otherwise it can still publish under v11. */
export function usesDepth(floors:readonly {features?:readonly unknown[];tide?:unknown}[],enemies:readonly string[]):boolean{
 return floors.some(f=>(f.features?.length??0)>0||f.tide!==undefined)||enemies.some(e=>(depthEnemyKinds as readonly string[]).includes(e));
}

/** Cross-floor v13 checks: every lock colour needs a key of that colour somewhere in the dungeon. */
export function validateProgressionNetwork(floors:readonly {features?:readonly Feature[]}[]):string[]{
 const all=floors.flatMap(f=>f.features??[]),keys=new Set(all.flatMap(f=>f.kind==='key'?[f.color]:[]));
 return [...new Set(all.flatMap(f=>f.kind==='lock'&&!keys.has(f.color)?[f.color]:[]))].map(c=>`Locked door colour ${c} needs a key of that colour somewhere in the dungeon.`);
}
export const plateChannels=(floors:readonly {features?:readonly Feature[]}[])=>new Set(floors.flatMap(f=>(f.features??[]).flatMap(x=>x.kind==='plate'?[x.channel]:[])));
/** Lowest rules version that can express a design: 11 plain, 12 depth, 13 progression. */
export function requiredRulesVersion(floors:readonly {features?:readonly Feature[];tide?:unknown}[],enemies:readonly string[]):11|12|13{
 if(floors.some(f=>(f.features??[]).some(x=>(featureCatalog[x.kind]?.since??12)>=13)))return 13;
 return usesDepth(floors,enemies)?12:11;
}
