// Server-side canonical Borsh encoder. Order/enum indices are pinned by sandbox parity tests.
import {createHash} from 'node:crypto';
import type {Command} from './types';
export function encodeCommand(c:Command):Uint8Array{
 const chunks:Buffer[]=[];
 const byte=(n:number)=>{if(!Number.isInteger(n)||n<0||n>255)throw Error('Invalid u8');chunks.push(Buffer.from([n]));};
 const u32=(n:number)=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);chunks.push(b);};
 const u64=(n:string)=>{if(typeof n!=='string'||!/^(0|[1-9]\d*)$/.test(n))throw Error('Canonical integer string required');const value=BigInt(n);if(value>18446744073709551615n)throw Error('u64 overflow');const b=Buffer.alloc(8);b.writeBigUInt64LE(value);chunks.push(b);};
 const str=(s:string)=>{const b=Buffer.from(s,'utf8');u32(b.length);chunks.push(b);};
 const strings=(ss:readonly string[])=>{u32(ss.length);ss.forEach(str);};
 const bool=(b:boolean)=>{if(typeof b!=='boolean')throw Error('Boolean required');byte(b?1:0);};
 str(c.actor);const a=c.action;
 if(a.type==='debit'){byte(0);u64(a.amount);}
 else if(a.type==='publish'){
  byte(1);const t=a.terms;str(t.title);byte(t.rules_version);strings(t.modules);u32(t.sockets.length);
  for(const s of t.sockets){str(s.id);byte(s.room);byte(s.slot);byte(['none','pursuer','charger'].indexOf(s.enemy));bool(s.trap);byte(s.reward===null?0:1);if(s.reward!==null)byte(['club','sword','armor','herb','iron','flask','tonic','fineTonic'].indexOf(s.reward));}
  u64(t.opens_at_ms);u64(t.closes_at_ms);bool(t.no_reward);str(t.difficulty_tag);str(t.style_tag);u64(t.run_duration_ms);byte(t.max_runs);u64(a.fee);strings(a.funding);
 }else if(a.type==='settle'||a.type==='void'){
  byte(a.type==='settle'?3:4);str(a.run_id);if(a.type==='settle')byte(['extracted','died','abandoned','expired'].indexOf(a.outcome));else str(a.reason);
  const d=a.disposition;for(const ids of [d.town_consumed,d.town_returned,d.town_forfeited,d.dungeon_consumed,d.dungeon_extracted,d.dungeon_returned])strings(ids);
  if(a.type==='settle')strings(a.carried_dungeon_ids);
 }else if(a.type==='admit'){byte(2);str(a.edition_id);u64(a.expected_version);u64(a.expected_fee);strings(a.loadout_ids);u64(a.seed);}
 else if(a.type==='finalize_close'){byte(5);str(a.edition_id);}
 else throw Error('Unknown action');
 return Buffer.concat(chunks);
}
export function commandHash(c:Command){return createHash('sha256').update(encodeCommand(c)).digest('hex');}
