// Server-side canonical Borsh encoder. Order/enum indices are pinned by sandbox parity tests.
import {createHash} from 'node:crypto';
import type {Command} from './types';
export function encodeCommand(c:Command):Uint8Array{
 const chunks:Buffer[]=[];
 const byte=(n:number)=>{if(!Number.isInteger(n)||n<0||n>255)throw Error('Invalid u8');chunks.push(Buffer.from([n]));};
 const u32=(n:number)=>{if(!Number.isInteger(n)||n<0||n>0xffffffff)throw Error('Invalid u32');const b=Buffer.alloc(4);b.writeUInt32LE(n);chunks.push(b);};
 const u64=(n:string)=>{if(typeof n!=='string'||!/^(0|[1-9]\d*)$/.test(n))throw Error('Canonical integer string required');const value=BigInt(n);if(value>18446744073709551615n)throw Error('u64 overflow');const b=Buffer.alloc(8);b.writeBigUInt64LE(value);chunks.push(b);};
 const str=(s:string)=>{if(typeof s!=='string')throw Error('String required');const b=Buffer.from(s,'utf8');u32(b.length);chunks.push(b);};
 const strings=(ss:readonly string[])=>{if(!Array.isArray(ss))throw Error('String array required');u32(ss.length);ss.forEach(str);};
 const bool=(b:boolean)=>{if(typeof b!=='boolean')throw Error('Boolean required');byte(b?1:0);};
 str(c.actor);const a=c.action;
 if(a.type==='debit'){byte(0);u64(a.amount);}
 else if((a.type==='publish'||a.type==='publish_random')){
  byte(a.type==='publish'?1:6);const t=a.terms;str(t.title);byte(t.rules_version);strings(t.modules);u32(t.sockets.length);
  for(const s of t.sockets){str(s.id);byte(s.room);byte(s.slot);byte(['none','pursuer','charger','archer','bomber','brute','nest'].indexOf(s.enemy));bool(s.trap);byte(s.reward===null?0:1);if(s.reward!==null)byte(['club','sword','armor','herb','iron','flask','tonic','fineTonic'].indexOf(s.reward));}
  u64(t.opens_at_ms);u64(t.closes_at_ms);bool(t.no_reward);str(t.difficulty_tag);str(t.style_tag);u64(t.run_duration_ms);byte(t.max_runs);u64(a.fee);if(a.type==='publish')strings(a.funding);else{strings(a.fixed_funding);u32(a.random_tables.length);for(const t of a.random_tables){str(t.table_id);strings(t.socket_ids);strings(t.item_ids);}}
 }else if(a.type==='settle'||a.type==='void'){
  byte(a.type==='settle'?3:4);str(a.run_id);if(a.type==='settle')byte(['extracted','died','abandoned','expired'].indexOf(a.outcome));else str(a.reason);
  const d=a.disposition;for(const ids of [d.town_consumed,d.town_returned,d.town_forfeited,d.dungeon_consumed,d.dungeon_extracted,d.dungeon_returned])strings(ids);
  if(a.type==='settle')strings(a.carried_dungeon_ids);
 }else if(a.type==='admit'){byte(2);str(a.edition_id);u64(a.expected_version);u64(a.expected_fee);strings(a.loadout_ids);u64(a.seed);}
 else if(a.type==='finalize_close'){byte(5);str(a.edition_id);}
 else if(a.type==='refresh'){byte(7);str(a.edition_id);strings(a.fixed_funding);u32(a.random_funding.length);for(const t of a.random_funding){str(t.table_id);strings(t.item_ids);}}
 else if(a.type==='set_fee'){byte(8);str(a.edition_id);u64(a.new_fee);}
 else if(a.type==='list'){byte(9);strings(a.item_ids);u64(a.unit_price);}
 else if(a.type==='cancel_listing'){byte(10);str(a.listing_id);}
 else if(a.type==='buy'){byte(11);str(a.listing_id);strings(a.item_ids);u64(a.expected_unit_price);}
 else if(a.type==='bank_buy'||a.type==='bank_sell'){byte(a.type==='bank_buy'?12:13);strings(a.item_ids);u32(a.expected_unit_prices.length);a.expected_unit_prices.forEach(u64);}
 else if(a.type==='fill_npc_order'){byte(14);str(a.order_id);strings(a.item_ids);u64(a.expected_unit_price);}
 else if(a.type==='begin_craft'||a.type==='begin_recovery'){byte(a.type==='begin_craft'?15:17);str(a.batch_id);strings(a.type==='begin_craft'?a.input_ids:a.bank_input_ids);str(a.challenge_commitment);u64(a.deadline_ms);}
 else if(a.type==='finish_craft'||a.type==='finish_recovery'){byte(a.type==='finish_craft'?16:18);str(a.batch_id);byte(['normal','fine'].indexOf(a.tier));byte(['completed','expired'].indexOf(a.reason));}
 else if(a.type==='create_shop'||a.type==='update_shop'){byte(a.type==='create_shop'?19:20);if(a.type==='update_shop'){str(a.shop_id);u64(a.expected_version);}str(a.title);str(a.district);byte(a.x);byte(a.y);str(a.interior);bool(a.open);}
 else if(a.type==='stock_shop'){byte(21);str(a.shop_id);strings(a.item_ids);u64(a.unit_price);}
 else if(a.type==='remove_shop'){byte(22);str(a.shop_id);u64(a.expected_version);}
 else throw Error('Unknown action');
 return Buffer.concat(chunks);
}
export function commandHash(c:Command){return createHash('sha256').update(encodeCommand(c)).digest('hex');}
