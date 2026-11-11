import {enemyCatalog,type EnemyKind} from './depth-components';
import {catalog} from './catalog';
import type {EditionTerms} from './types';
import type {EditionRecord} from './edition-record';

/** What a delver should know before paying: threats, treasure, danger and the record, from the immutable terms. */
export type OfferSummary={floors:number;enemies:{name:string;count:number}[];traps:number;treasure:string[];randomSpots:number;danger:'Calm'|'Light'|'Dangerous'|'Deadly';dangerWhy:string;record:string};
export function offerSummary(terms:EditionTerms,record?:EditionRecord,randomDraws=0):OfferSummary{
 const floors=Math.max(1,terms.modules.length);const counts=new Map<string,number>();let threat=0,traps=0;const randomSpots=randomDraws;const treasure=new Map<string,number>();
 for(const s of terms.sockets){if(s.enemy&&s.enemy!=='none'){const k=enemyCatalog[s.enemy as EnemyKind];const name=k?.name??s.enemy;counts.set(name,(counts.get(name)??0)+1);threat+=k?.cost??2;}if(s.trap){traps++;threat+=1;}if(s.reward){const n=(catalog as Record<string,{name:string}>)[s.reward]?.name??s.reward;treasure.set(n,(treasure.get(n)??0)+1);}}
 const perFloor=threat/floors;
 let danger:OfferSummary['danger']=perFloor===0?'Calm':perFloor<=6?'Light':perFloor<=14?'Dangerous':'Deadly';let dangerWhy=threat?`${[...counts.values()].reduce((a,b)=>a+b,0)} enemies${traps?` and ${traps} traps`:''} over ${floors} ${floors===1?'floor':'floors'}`:'no enemies or traps';
 const done=record?(record.extracted+record.died):0;
 if(record&&done>=3){const rate=record.died/done;if(rate>=0.6&&danger!=='Deadly'){danger=rate>=0.8?'Deadly':'Dangerous';}dangerWhy+=`; ${Math.round(rate*100)}% of finished runs died`;}
 const rec=!record||record.attempts===0?'No one has tried it yet.':`${record.attempts} ${record.attempts===1?'run':'runs'}: ${record.extracted} escaped, ${record.died} died${record.abandoned?`, ${record.abandoned} gave up`:''}.${record.averageLoot!==null&&record.extracted?` Escapers carried out ${record.averageLoot} in value on average.`:''}${record.attempts<3?' Small sample.':''}`;
 return {floors,enemies:[...counts].map(([name,count])=>({name,count})),traps,treasure:[...treasure].map(([n,c])=>c>1?`${c} × ${n}`:n),randomSpots:terms.no_reward?0:randomSpots,danger,dangerWhy,record:rec};
}
