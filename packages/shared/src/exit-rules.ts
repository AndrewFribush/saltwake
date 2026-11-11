import {validChannel,type Device} from './mechanisms';
export type ExitRule={extract:boolean;require_clear:boolean;channel?:string;value?:boolean};
export const defaultExitRule:ExitRule={extract:true,require_clear:true};
export function validateExitRule(value:unknown):string[]{
 if(!value||typeof value!=='object'||Array.isArray(value))return ['Exit rule must be an object.'];const r=value as Record<string,unknown>;
 if(typeof r.extract!=='boolean'||typeof r.require_clear!=='boolean'||Object.keys(r).some(k=>!['extract','require_clear','channel','value'].includes(k)))return ['Exit rules need boolean extraction and clear-room settings, with no unknown fields.'];
 const hasChannel=Object.hasOwn(r,'channel'),hasValue=Object.hasOwn(r,'value');
 return hasChannel!==hasValue||hasChannel&&(!validChannel(r.channel)||typeof r.value!=='boolean')?['An exit condition needs a valid channel and an on/off value together.']:[];
}
export function validateExitNetwork(floors:readonly {exit_rule?:ExitRule;devices?:Device[]}[],plates:ReadonlySet<string>=new Set()):string[]{
 const errors:string[]=[],channels=new Set([...floors.flatMap(f=>(f.devices??[]).filter(d=>d.kind==='switch').map(d=>d.channel)),...plates]);
 if(!floors.some(f=>(f.exit_rule??defaultExitRule).extract))errors.push('At least one floor must allow extraction.');
 for(const channel of new Set(floors.flatMap(f=>f.exit_rule?.channel!==undefined?[f.exit_rule.channel]:[])))if(!channels.has(channel))errors.push(`Exit channel ${channel} needs a switch somewhere in the dungeon.`);
 return errors;
}
