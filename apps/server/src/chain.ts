import {JsonRpcProvider,KeyPairSigner,createTransaction,actions,baseDecode,baseEncode,encodeTransaction,decodeSignedTransaction} from 'near-api-js';
import type {Command,OperationStatus} from '../../../packages/shared/src/types';
import type {Chain} from './outbox';
import type {Signed} from './db';
export class NearChain implements Chain {
 constructor(readonly provider:JsonRpcProvider,readonly signer:KeyPairSigner,readonly accountId:string,readonly contractId:string){}
 async sign(id:string,command:Command,minNonce='0'):Promise<Signed>{
  const key=await this.signer.getPublicKey();
  const access=await this.provider.viewAccessKey({accountId:this.accountId,publicKey:key.toString(),finalityQuery:{finality:'final'}});
  const block=await this.provider.viewBlock({finality:'final'});
  const nonce=BigInt(access.nonce)+1n>BigInt(minNonce)?BigInt(access.nonce)+1n:BigInt(minNonce);
  const tx=createTransaction(this.accountId,key,this.contractId,nonce,[actions.functionCall('execute',{op_id:id,command},100_000_000_000_000n,0n)],baseDecode(block.header.hash));
  const signed=await this.signer.signTransaction(tx);
  return {hash:baseEncode(signed.txHash),nonce:nonce.toString(),bytes:Buffer.from(encodeTransaction(signed.signedTransaction)).toString('base64')};
 }
 async broadcast(tx:Signed){await this.provider.sendTransactionUntil(decodeSignedTransaction(Buffer.from(tx.bytes,'base64')),'FINAL');}
 async clock(){return Number(await this.provider.callFunction<string>({contractId:this.contractId,method:'clock_ms',args:{},blockQuery:{finality:'final'}}));}
 async transactionState(tx:Signed):Promise<'failed'|'unknown'>{try{const result=await this.provider.viewTransactionStatus({txHash:tx.hash,accountId:this.accountId,waitUntil:'FINAL'});return result.final_execution_status==='FINAL'&&typeof result.status==='object'&&'Failure' in result.status?'failed':'unknown';}catch{return 'unknown';}}
 async receipt(id:string){return (await this.provider.callFunction<OperationStatus>({contractId:this.contractId,method:'operation',args:{op_id:id},blockQuery:{finality:'final'}}))??null;}
}
