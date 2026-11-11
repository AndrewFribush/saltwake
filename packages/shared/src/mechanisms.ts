export type Device={id:string;x:number;y:number;channel:string}&({kind:'switch';mode:'toggle'|'set'|'clear'}|{kind:'door';open_when:boolean});
export function validChannel(value:unknown):value is string{return typeof value==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(value);}
export function validateDevices(value:unknown):string[]{
 if(!Array.isArray(value)||value.length>16)return ['Use at most 16 devices per floor.'];const errors:string[]=[],ids=new Set<string>();
 for(const d of value){if(!d||typeof d!=='object'||Array.isArray(d)){errors.push('Invalid device.');continue;}
 const fields=d.kind==='switch'?['id','x','y','channel','kind','mode']:d.kind==='door'?['id','x','y','channel','kind','open_when']:[];
 if(!fields.length||Object.keys(d).length!==fields.length||Object.keys(d).some(k=>!fields.includes(k)))errors.push('Device fields must match its kind.');
 if(typeof d.id!=='string'||!wellFormedId(d.id)||!d.id.length||new TextEncoder().encode(d.id).length>32||ids.has(d.id))errors.push('Device IDs must be unique on each floor and use 1–32 bytes.');else ids.add(d.id);
 if(!Number.isInteger(d.x)||!Number.isInteger(d.y)||d.x<0||d.y<0)errors.push('Devices need whole tile coordinates.');
 if(!validChannel(d.channel))errors.push('Channels need a letter followed by up to 31 letters, digits, underscores or hyphens.');
 if(d.kind==='switch'&&!['toggle','set','clear'].includes(d.mode)||d.kind==='door'&&typeof d.open_when!=='boolean')errors.push('Invalid device behavior.');
 }return errors;
}
export function validateMechanismNetwork(floors:readonly {devices?:Device[]}[],plates:ReadonlySet<string>=new Set()):string[]{
 const devices=floors.flatMap(f=>f.devices??[]),switches=new Set([...devices.filter(d=>d.kind==='switch').map(d=>d.channel),...plates]),errors:string[]=[];
 if(devices.length>64)errors.push('Use at most 64 devices across all floors.');
 for(const channel of new Set(devices.filter(d=>d.kind==='door'&&!switches.has(d.channel)).map(d=>d.channel)))errors.push(`Door channel ${channel} needs a switch somewhere in the dungeon.`);
 return errors;
}
export function signalValue(signals:Record<string,boolean>|undefined,channel:string):boolean{return !!signals&&Object.hasOwn(signals,channel)&&signals[channel]===true;}
export function doorOpen(device:Device,signals:Record<string,boolean>|undefined):boolean{return device.kind!=='door'||signalValue(signals,device.channel)===device.open_when;}

export function wellFormedId(id:string):boolean{for(let i=0;i<id.length;i++){const c=id.charCodeAt(i);if(c>=0xd800&&c<=0xdbff){const next=id.charCodeAt(++i);if(!(next>=0xdc00&&next<=0xdfff))return false;}else if(c>=0xdc00&&c<=0xdfff)return false;}return true;}
