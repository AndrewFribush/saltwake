import {commandHash} from '../../../packages/shared/src/protocol';
import type {Command,OperationStatus} from '../../../packages/shared/src/types';
import {Store,type Signed,type StoredOperation} from './db';
export interface Chain {clock?():Promise<number>;sign(id:string,command:Command,minNonce?:string):Promise<Signed>;broadcast(tx:Signed):Promise<void>;receipt(id:string):Promise<OperationStatus|null>;transactionState?(tx:Signed):Promise<'failed'|'unknown'>;}
export class Outbox {
 private tail:Promise<unknown>=Promise.resolve();
 constructor(readonly db:Store,readonly chain:Chain){}
 enqueue(id:string,command:Command):StoredOperation{
  if(!/^[A-Za-z0-9_-]{1,64}$/.test(id))throw Error('Invalid operation ID');
  if(Buffer.byteLength(JSON.stringify({op_id:id,command}))>32768)throw Error('Command too large');
  const hash=commandHash(command);const prior=this.db.operation(id);
  if(prior){if(prior.hash!==hash)throw Error('Operation payload conflict');return prior;}
  if(this.db.operations().length+1+this.reserved(command)>256)throw Error('Outbox capacity reached; terminal headroom reserved');
  const row:StoredOperation={id,command:structuredClone(command),hash,status:'Pending'};this.db.putOperation(row);return row;
 }
 private reserved(incoming:Command){
  const rows=this.db.operations();const obligations=new Set<string>();
  for(const r of rows){if(r.status==='Rejected')continue;const a=r.command.action;
   if(a.type==='admit')obligations.add('run:'+(r.receipt?.status==='Applied'?r.receipt.run?.id??r.receipt.result:r.id));
   if(a.type==='publish'||a.type==='publish_random')obligations.add('edition:'+(r.receipt?.status==='Applied'?r.receipt.result:r.id));
   if(a.type==='begin_craft'||a.type==='begin_recovery')obligations.add('craft:'+a.batch_id);
  }
  const remove=(a:Command['action'])=>{if(a.type==='settle'||a.type==='void')obligations.delete('run:'+a.run_id);if(a.type==='finalize_close')obligations.delete('edition:'+a.edition_id);if(a.type==='finish_craft'||a.type==='finish_recovery')obligations.delete('craft:'+a.batch_id);};
  for(const r of rows)if(r.status!=='Rejected')remove(r.command.action);remove(incoming.action);
  const a=incoming.action;if(a.type==='admit'||a.type==='publish'||a.type==='publish_random'||a.type==='begin_craft'||a.type==='begin_recovery')return obligations.size+1;
  return obligations.size;
 }
 process(id:string):Promise<StoredOperation>{const result=this.tail.then(()=>this.submit(id));this.tail=result.catch(()=>{});return result;}
 private async submit(id:string):Promise<StoredOperation>{
  const row=this.db.operation(id);if(!row)throw Error('Unknown operation');
  if(row.status==='Applied'||row.status==='Rejected')return row;
  const accept=async()=>{const receipt=await this.chain.receipt(id);if(!receipt)return false;
   if(receipt.status!=='Applied'&&receipt.status!=='Rejected')return false;
   if(receipt.op_id!==id||receipt.payload_hash!==row.hash)throw Error('Receipt identity conflict');
   row.receipt=receipt;row.status=receipt.status;delete row.reason;this.db.putOperation(row);return true;};
  try{
   if(await accept())return row;
   // A single unresolved signer stream prevents higher nonces overtaking a lost transaction.
   const first=this.db.operations().find(r=>r.status==='Pending'||r.status==='Unknown');
   if(first?.id!==id)return row;
   if(row.signed){
    const failed=await this.chain.transactionState?.(row.signed)==='failed';
    // Replacement keeps the exact logical ID/hash. Even a late old transaction
    // cannot duplicate effects: the contract returns its original operation receipt.
    if(failed||Date.now()-(row.signedAt??Date.now())>120000){
     if((row.retired?.length??0)>=3)throw Error('Signed transaction retry budget exhausted; retain locks for operator recovery');
     row.retired=[...(row.retired??[]),row.signed];delete row.signed;this.db.putOperation(row);
    }
   }
   if(!row.signed){const minNonce=row.retired?.reduce((n,t)=>t.nonce&&BigInt(t.nonce)>=BigInt(n)?(BigInt(t.nonce)+1n).toString():n,'0');row.signed=await this.chain.sign(id,row.command,minNonce);row.signedAt=Date.now();if(row.signed.bytes.length>65536)throw Error('Signed transaction too large');this.db.putOperation(row);}
   try{await this.chain.broadcast(row.signed);}catch(e){row.reason=String(e).slice(0,500);}
   if(await accept())return row;
   row.status='Unknown';row.reason??='No confirmed operation receipt; retain all locks';
  }catch(e){row.status='Unknown';row.reason=String(e).slice(0,500);}
  this.db.putOperation(row);return row;
 }
 async recover(){for(const row of this.db.operations())if(row.status==='Pending'||row.status==='Unknown')await this.process(row.id);}
}
