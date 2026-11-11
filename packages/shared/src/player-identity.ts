import {createHash} from 'node:crypto';
import type {Command} from './types';

/** Server-side identity helpers; validate independently before Outbox persistence. */
export function validPlayerAccount(value:unknown):value is string{return typeof value==='string'&&value.length>=2&&value.length<=64&&/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(value);}
export function playerProfile(accountId:string):string{if(!validPlayerAccount(accountId))throw Error('Invalid player account');return `wallet:${accountId}`;}
export function playerOperationId(accountId:string,requestId:string):string{
 if(!validPlayerAccount(accountId))throw Error('Invalid player account');
 if(typeof requestId!=='string'||!/^[A-Za-z0-9_-]{1,40}$/.test(requestId))throw Error('Invalid player request ID');
 // Borsh tuple of strings, matching the contract's AccountId serialization.
 const parts=['saltwake.player-operation.v1',accountId,requestId].map(s=>{const bytes=Buffer.from(s,'utf8'),length=Buffer.alloc(4);length.writeUInt32LE(bytes.length);return Buffer.concat([length,bytes]);});
 return createHash('sha256').update(Buffer.concat(parts)).digest('hex');
}
/** Account starts use namespaced batches and chain time; results remain oracle-only. */
export function isPlayerAction(action:Command['action']|null|undefined):boolean{
 if(!action)return false;
 switch(action.type){
  case 'begin_craft':case 'begin_recovery':return /^[a-f0-9]{64}$/.test(action.batch_id??'')&&action.deadline_ms==='0';
  case 'publish':case 'publish_random':case 'admit':case 'finalize_close':case 'retire':case 'post_commission':case 'fill_commission':case 'cancel_commission':case 'refresh':case 'set_fee':
  case 'list':case 'cancel_listing':case 'buy':case 'bank_buy':case 'bank_sell':case 'fill_npc_order':
  case 'create_shop':case 'update_shop':case 'stock_shop':case 'remove_shop':case 'list_for':return true;
  default:return false;
 }
}
