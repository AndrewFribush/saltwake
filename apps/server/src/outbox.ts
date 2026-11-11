import {playerProfile,playerOperationId,isPlayerAction} from '../../../packages/shared/src/player-identity';
import {commandSizeError,commandByteLimit,largePublicationBytes} from '../../../packages/shared/src/command-limits';
import {commandHash} from '../../../packages/shared/src/protocol';
import type {Command,OperationStatus} from '../../../packages/shared/src/types';
import {Store,type Signed,type StoredOperation} from './db';
export interface Chain {clock?():Promise<number>;sign(id:string,command:Command,minNonce?:string):Promise<Signed>;broadcast(tx:Signed):Promise<void>;receipt(id:string):Promise<OperationStatus|null>;transactionState?(tx:Signed):Promise<'failed'|'unknown'>;}
export class Outbox {
 private tail:Promise<unknown>=Promise.resolve();
 private playerTasks=new Map<string,Promise<StoredOperation>>();
 private receiptFlights=new Map<string,Promise<OperationStatus|null>>();
 private observationFlights=new Map<string,Promise<void>>();
 constructor(readonly db:Store,readonly chain:Chain,private observer?:{before(op:StoredOperation,signal?:AbortSignal):Promise<void>;after(op:StoredOperation,signal?:AbortSignal):Promise<void>},private options:{receiptTimeoutMs?:number;observationTimeoutMs?:number;capacity?:number}={}){if(options.receiptTimeoutMs!==undefined&&(!Number.isSafeInteger(options.receiptTimeoutMs)||options.receiptTimeoutMs<10||options.receiptTimeoutMs>30000))throw Error('Invalid receipt timeout');if(options.observationTimeoutMs!==undefined&&(!Number.isSafeInteger(options.observationTimeoutMs)||options.observationTimeoutMs<10||options.observationTimeoutMs>30000))throw Error('Invalid observation timeout');}
 private async observe(phase:"before"|"after",row:StoredOperation){
  if(!this.observer)return;const key=phase+':'+row.id;if(this.observationFlights.has(key))return;
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
  // Observers must check the signal after awaited reads and before committing.
  const work=Promise.resolve().then(()=>this.observer![phase](row,controller.signal)).catch(e=>{if(!controller.signal.aborted)this.db.put('cost-observation-errors',row.id,{phase,error:String(e).slice(0,300)});}).finally(()=>this.observationFlights.delete(key));
  this.observationFlights.set(key,work);
  try{await Promise.race([work,new Promise<void>(resolve=>{timer=setTimeout(()=>{controller.abort();this.db.put('cost-observation-errors',row.id,{phase,error:'Observation timed out; costs remain unknown without verified evidence.'});resolve();},this.options.observationTimeoutMs??5000);})]);}
  finally{if(timer)clearTimeout(timer);}
 }
 enqueue(id:string,command:Command):StoredOperation{
  if(typeof command.actor==='string'&&command.actor.startsWith('wallet:')&&!['settle','void','finish_craft','finish_recovery'].includes(command.action?.type))throw Error('Player signature required');
  return this.store(id,command);
 }
 enqueuePlayer(accountId:string,requestId:string,action:Command['action']):StoredOperation{
  if(!isPlayerAction(action))throw Error('Action requires game authority or is not enabled for wallets');
  if((action.type==='begin_craft'||action.type==='begin_recovery')&&action.batch_id!==playerOperationId(accountId,requestId))throw Error('Player batch must match account request');
  return this.store(playerOperationId(accountId,requestId),{actor:playerProfile(accountId),action},'player');
 }
 private store(id:string,command:Command,authority?:'player'):StoredOperation{
  if(!/^[A-Za-z0-9_-]{1,64}$/.test(id))throw Error('Invalid operation ID');
  const sizeError=commandSizeError(id,command);if(sizeError)throw Error(sizeError);
  const hash=commandHash(command);const prior=this.db.operation(id);
  if(prior){if(prior.authority!==authority)throw Error('Operation authority conflict');if(prior.hash!==hash)throw Error('Operation payload conflict');return prior;}
  const cap=this.options.capacity??256;// Must match the contract's receipt capacity (256 unless a simulation seed raised it).
  if(this.db.operations().length+1+this.reserved(command)>cap){
   // Final-chain discovery can reveal obligations after ordinary slots filled.
   // A bounded emergency lane accepts only the owner-bound oracle result for a
   // persisted confirmed batch; never additional player spending.
   const a=command.action;
   const saved=a.type==='finish_craft'||a.type==='finish_recovery'?this.db.get<{profile:string;confirmed:boolean;recovery:boolean;finished:boolean}>('craft',a.batch_id):undefined;
   const emergency=!authority&&saved?.confirmed&&!saved.finished&&saved.profile===command.actor&&saved.recovery===(a.type==='finish_recovery');
   if(!emergency||this.db.operations().length>=cap*2)throw Error('Outbox capacity reached; terminal headroom reserved');
  }
  const row:StoredOperation={...(authority?{authority}:{}),id,command:structuredClone(command),hash,status:'Pending'};this.db.putOperation(row);return row;
 }
 private reserved(incoming:Command){
  const rows=this.db.operations();const obligations=new Map<string,string>();
  for(const r of rows){if(r.status==='Rejected')continue;const a=r.command.action;
   if(a.type==='admit')obligations.set('run:'+(r.receipt?.status==='Applied'?r.receipt.run?.id??r.receipt.result:r.id),r.command.actor);
   if(a.type==='publish'||a.type==='publish_random')obligations.set('edition:'+(r.receipt?.status==='Applied'?r.receipt.result:r.id),r.command.actor);
   if(a.type==='begin_craft'||a.type==='begin_recovery')obligations.set('craft:'+a.batch_id,r.command.actor);
  }
  // Direct account admissions may have no locally prepared operation. Their
  // confirmed saved runs still need terminal headroom.
  for(const run of this.db.all<{id:string;profile:string;externalSettlement?:boolean;settlement?:string}>('run')){
   if(run.externalSettlement||run.settlement&&this.db.operation(run.settlement)?.status==='Applied')obligations.delete('run:'+run.id);else obligations.set('run:'+run.id,run.profile);
  }
  for(const batch of this.db.all<{id:string;profile:string;confirmed:boolean;finished:boolean}>('craft')){
   if(batch.finished)obligations.delete('craft:'+batch.id);else if(batch.confirmed)obligations.set('craft:'+batch.id,batch.profile);
  }
  const remove=(c:Command)=>{const a=c.action;const key=a.type==='settle'||a.type==='void'?'run:'+a.run_id:a.type==='finalize_close'?'edition:'+a.edition_id:a.type==='finish_craft'||a.type==='finish_recovery'?'craft:'+a.batch_id:undefined;if(key&&obligations.get(key)===c.actor)obligations.delete(key);};
  for(const r of rows)if(r.status!=='Rejected')remove(r.command);remove(incoming);
  const a=incoming.action;if(a.type==='admit'||a.type==='publish'||a.type==='publish_random'||a.type==='begin_craft'||a.type==='begin_recovery')return obligations.size+1;
  return obligations.size;
 }
 process(id:string):Promise<StoredOperation>{
  if(this.db.operation(id)?.authority==='player'){
   const prior=this.playerTasks.get(id);if(prior)return prior;
   const result=this.submit(id).finally(()=>this.playerTasks.delete(id));this.playerTasks.set(id,result);return result;
  }
  const result=this.tail.then(()=>this.submit(id));this.tail=result.catch(()=>{});return result;
 }
 private async receipt(id:string){
  let flight=this.receiptFlights.get(id);
  if(!flight){flight=Promise.resolve().then(()=>this.chain.receipt(id)).finally(()=>this.receiptFlights.delete(id));this.receiptFlights.set(id,flight);}
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([flight,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Receipt lookup timed out; preserve original request')),this.options.receiptTimeoutMs??5000);})]);}
  finally{if(timer)clearTimeout(timer);}
 }
 private async submit(id:string):Promise<StoredOperation>{
  const row=this.db.operation(id);if(!row)throw Error('Unknown operation');
  if(row.status==='Applied'||row.status==='Rejected'){if(row.status==='Applied')await this.observe('after',row);return row;}
  const accept=async()=>{const receipt=await this.receipt(id);if(!receipt)return false;
   if(receipt.status!=='Applied'&&receipt.status!=='Rejected')return false;
   if(receipt.op_id!==id||receipt.payload_hash!==row.hash)throw Error('Receipt identity conflict');
   row.receipt=receipt;row.status=receipt.status;delete row.reason;this.db.putOperation(row);await this.observe("after",row);return true;};
  try{
   if(await accept())return row;
   if(row.authority==='player'){
    await this.observe('before',row);
    row.status='Unknown';row.reason='Awaiting the exact player-signed transaction; the operator will not submit it.';
    this.db.putOperation(row);return row;
   }
   // A single unresolved signer stream prevents higher nonces overtaking a lost transaction.
   const first=this.db.operations().find(r=>r.authority!=='player'&&(r.status==='Pending'||r.status==='Unknown'));
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
   if(!row.signed){await this.observe('before',row);const minNonce=row.retired?.reduce((n,t)=>t.nonce&&BigInt(t.nonce)>=BigInt(n)?(BigInt(t.nonce)+1n).toString():n,'0');const signed=await this.chain.sign(id,row.command,minNonce);if(signed.bytes.length>(commandByteLimit(row.command.action)===largePublicationBytes?262144:65536))throw Error('Signed transaction too large');row.signed=signed;row.signedAt=Date.now();this.db.putOperation(row);}
   if(row.signed.bytes.length>(commandByteLimit(row.command.action)===largePublicationBytes?262144:65536))throw Error('Signed transaction too large');
   try{await this.chain.broadcast(row.signed);}catch(e){row.reason=String(e).slice(0,500);}
   if(await accept())return row;
   row.status='Unknown';row.reason??='No confirmed operation receipt; retain all locks';
  }catch(e){row.status='Unknown';row.reason=String(e).slice(0,500);}
  this.db.putOperation(row);return row;
 }
 async recover(){await Promise.all(this.db.operations().filter(row=>row.status==='Pending'||row.status==='Unknown'||(this.observer&&row.status==='Applied'&&!this.db.get('cost-journal',row.id))).map(row=>this.process(row.id)));}
}
