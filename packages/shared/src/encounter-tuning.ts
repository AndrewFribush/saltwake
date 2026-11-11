export const tuningFields={hp:{label:'Health',min:1,max:30},damage:{label:'Damage',min:1,max:12},alert:{label:'Alert distance',min:1,max:8},trap_period:{label:'Cycle turns',min:2,max:8},trap_active:{label:'Armed turns',min:1,max:7},trap_offset:{label:'Starting phase',min:0,max:7},trap_damage:{label:'Trap damage',min:1,max:12}} as const;
export type TuningField=keyof typeof tuningFields;
export type EncounterTuning={slot:number}&Partial<Record<TuningField,number>>;
export const enemyFields=['hp','damage','alert'] as const;
export const trapFields=['trap_period','trap_active','trap_offset','trap_damage'] as const;
export function validateTuning(value:unknown,slots:number):string[]{
 if(!Array.isArray(value)||value.length>16)return ['Tuning must contain at most 16 encounters.'];const used=new Set<number>(),errors:string[]=[];
 for(const t of value){if(!t||typeof t!=='object'||Array.isArray(t)||!Number.isInteger(t.slot)||t.slot<0||t.slot>=slots||used.has(t.slot)){errors.push('Tuning needs unique existing encounter slots.');continue;}used.add(t.slot);
  const fields=Object.keys(t).filter(k=>k!=='slot');if(!fields.length||fields.some(k=>!Object.hasOwn(tuningFields,k))){errors.push('Unknown or empty encounter tuning.');continue;}
  for(const key of fields as TuningField[]){const bounds=tuningFields[key];if(!Number.isInteger(t[key])||t[key]<bounds.min||t[key]>bounds.max)errors.push(`${bounds.label} must be a whole number from ${bounds.min} to ${bounds.max}.`);}
  const period=t.trap_period??2;if((t.trap_active??1)>=period||(t.trap_offset??0)>=period)errors.push('Armed turns and starting phase must be less than cycle turns.');
 }
 return errors;
}
export function tuningCompatibility(t:EncounterTuning,enemy:string,trap:boolean):string[]{return [...(enemy==='none'&&enemyFields.some(k=>t[k]!==undefined)?['Enemy tuning needs an enemy.']:[]),...(!trap&&trapFields.some(k=>t[k]!==undefined)?['Trap tuning needs a trap.']:[])];}

/** Drafts preserve bounded unfinished values; publication applies full validation. */
export function isDraftTuning(value:unknown,slots:number):boolean{
 if(!Array.isArray(value)||value.length>16)return false;
 const used=new Set<number>();
 return value.every(t=>{if(!t||typeof t!=='object'||Array.isArray(t)||!Number.isInteger(t.slot)||t.slot<0||t.slot>=slots||used.has(t.slot))return false;used.add(t.slot);return Object.entries(t).every(([key,v])=>key==='slot'||Object.hasOwn(tuningFields,key)&&typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1000000);});
}
