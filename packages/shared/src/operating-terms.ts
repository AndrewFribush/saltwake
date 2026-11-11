/** Relative operating settings are portable; absolute publication dates are not. */
export const operatingFields={delayMinutes:{label:'Opening delay (minutes)',min:0,max:1440},openMinutes:{label:'Open for (minutes)',min:1,max:1440},runMinutes:{label:'Time per run (minutes)',min:1,max:60},capacity:{label:'Concurrent runs',min:1,max:4}} as const;
export type OperatingField=keyof typeof operatingFields;
export type OperatingSettings=Record<OperatingField,string>;
export const defaultOperatingSettings:OperatingSettings={delayMinutes:'0',openMinutes:'60',runMinutes:'15',capacity:'4'};
export function isOperatingDraft(value:unknown):value is OperatingSettings{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;const v=value as Record<string,unknown>;
 return Object.keys(v).length===4&&Object.keys(operatingFields).every(k=>typeof v[k]==='string'&&(v[k] as string).length<=16);
}
export function operatingErrors(value:unknown):string[]{
 if(!isOperatingDraft(value))return ['Operating settings require delay, opening length, run time and capacity.'];
 return (Object.keys(operatingFields) as OperatingField[]).flatMap(key=>{const {label,min,max}=operatingFields[key];return /^\d{1,7}$/.test(value[key])&&Number(value[key])>=min&&Number(value[key])<=max?[]:[`${label} must be a whole number from ${min} to ${max}.`];});
}
export function publicationSchedule(settings:OperatingSettings,now:number){
 const errors=operatingErrors(settings);if(errors.length)throw Error(errors.join('; '));if(!Number.isSafeInteger(now)||now<0)throw Error('Invalid publication clock');
 const opens=now+Number(settings.delayMinutes)*60000,closes=opens+Number(settings.openMinutes)*60000;
 if(!Number.isSafeInteger(closes))throw Error('Publication clock overflow');
 return {opens_at_ms:String(opens),closes_at_ms:String(closes),run_duration_ms:String(Number(settings.runMinutes)*60000),max_runs:Number(settings.capacity)};
}
