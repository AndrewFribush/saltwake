// Scores generator seeds by how much of the combat and hazard catalogue they show: distinct enemy kinds, traps,
// features (kegs, oil, cracked walls, plates, clocks, springs, altars), devices (doors, switches) and floors.
// Usage: npx tsx scripts/showcase-seeds.ts [maxSeed=400]. Read-only; prints the top seeds per preset.
import {generateDraft,generatorPresets,type GeneratorPreset} from '../packages/game/src/draft-generator';
const max=Number(process.argv[2]??400);
const presets:(GeneratorPreset|'practice')[]=['practice','small','medium','large'];
for(const preset of presets){
 const rows:{seed:number;score:number;kinds:string[];features:string[];devices:number;traps:number;floors:number}[]=[];
 for(let seed=1;seed<=max;seed++){
  let d;try{d=generateDraft(seed,preset==='practice'?{}:generatorPresets[preset].options);}catch{continue;}
  const kinds=new Set<string>(),features=new Set<string>();let traps=0,devices=0;
  for(const [i,f] of d.floors.entries()){
   for(const p of d.placements[i]??[]){const e=p.enemy as unknown;const k=typeof e==='string'?e:e&&typeof e==='object'&&'kind' in e?String((e as {kind:unknown}).kind):e?'pursuer':'';if(k)kinds.add(k);if(p.trap)traps++;}
   for(const x of (f as {features?:{kind:string}[]}).features??[])features.add(x.kind);
   devices+=((f as {devices?:unknown[]}).devices??[]).length;
  }
  rows.push({seed,score:kinds.size*3+features.size*2+Math.min(devices,2)+Math.min(traps,3),kinds:[...kinds].sort(),features:[...features].sort(),devices,traps,floors:d.floors.length});
 }
 rows.sort((a,b)=>b.score-a.score||a.seed-b.seed);
 console.log(`\n${preset}: ${rows.length} seeds`);
 for(const r of rows.slice(0,5))console.log(` seed ${r.seed}  score ${r.score}  floors ${r.floors}  kinds [${r.kinds.join(',')}]  features [${r.features.join(',')}]  devices ${r.devices} traps ${r.traps}`);
}
