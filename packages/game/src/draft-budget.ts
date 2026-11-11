// Shrinks a generated draft until its placement estimate fits a coin budget, so a newcomer's "Fit my budget" always
// gives them something they can open. Pure; the result is an ordinary editable draft.
import {estimateDraft,fitBudget,generateDraft,generatorPresets,type GeneratedDraft,type GeneratorPreset} from './draft-generator';
import {enemyCost} from '../../shared/src/depth-components';

/** Hazards that never carry a route (cracked walls, keys, locks and plates do, so they stay). */
const OPTIONAL_FEATURES=['oil','barrel','cache','altar','fountain','pit'];

/** Removes optional hazards, then traps, then the most expensive enemies (keeping one fight) until the draft costs
 * at most `coins`. Returns null when even the bare layout with one enemy costs more. */
export function thinDraftToCoins(draft:GeneratedDraft,coins:number):GeneratedDraft|null{
 const d:GeneratedDraft={floors:draft.floors.map(f=>({...f,features:[...(f.features??[])]})),placements:draft.placements.map(ps=>ps.map(p=>({...p})))};
 const cost=()=>estimateDraft(d).coins;
 while(cost()>coins){
  const fi=d.floors.findIndex(f=>(f.features??[]).some(x=>OPTIONAL_FEATURES.includes(x.kind)));
  if(fi>=0){d.floors[fi]={...d.floors[fi],features:d.floors[fi].features!.filter((x,i,all)=>i!==all.findIndex(y=>OPTIONAL_FEATURES.includes(y.kind)))};continue;}
  const trap=d.placements.flatMap((ps,f)=>ps.map((p,s)=>({p,f,s}))).find(x=>x.p.trap);
  if(trap){d.placements[trap.f][trap.s]={...trap.p,trap:false};continue;}
  const enemies=d.placements.flatMap((ps,f)=>ps.map((p,s)=>({p,f,s}))).filter(x=>x.p.enemy!=='none');
  if(enemies.length<=1)return null;
  const worst=enemies.reduce((a,b)=>enemyCost(b.p.enemy)>enemyCost(a.p.enemy)?b:a);
  d.placements[worst.f][worst.s]={...worst.p,enemy:'none'};
 }
 return d;
}

/** fitBudget, plus a last resort: the Small preset thinned to the player's coins (no treasure if goods are short). */
export function fitBudgetOrThin(seed:number,coins:number,goods:number):{preset:GeneratorPreset;draft:GeneratedDraft;treasure:boolean;thinned:boolean}|null{
 // Below a medium's cheapest cost only the Small preset can fit; skip generating the big ones (slow).
 if(coins>=28){const fit=fitBudget(seed,coins,goods);if(fit)return {...fit,thinned:false};}
 for(const treasure of goods>0?[true,false]:[false]){
  const small=generateDraft(seed,{...generatorPresets.small.options,treasure});const e=estimateDraft(small);
  if(e.coins<=coins&&e.goods<=goods)return {preset:'small',draft:small,treasure,thinned:false};
 }
 for(const treasure of goods>0?[true,false]:[false]){
  const thin=thinDraftToCoins(generateDraft(seed,{...generatorPresets.small.options,treasure}),coins);
  if(thin&&estimateDraft(thin).goods<=goods)return {preset:'small',draft:thin,treasure,thinned:true};
 }
 return null;
}
