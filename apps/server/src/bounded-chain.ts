import type {Chain} from './outbox';import type {Store,Signed} from './db';import type {Command} from '../../../packages/shared/src/types';
/** Counts every broadcast attempt before sending; restart never replenishes the allowance. */
export class BoundedChain implements Chain {
 constructor(private chain:Chain,private db:Store,private id:string,private limit:number,private expiresAt:number){if(!Number.isInteger(limit)||limit<1||limit>20||!Number.isFinite(expiresAt))throw Error('Invalid runtime bounds');const prior=db.get<{limit:number;expiresAt:number;used:number}>('runtime-budget',id);if(prior&&(prior.limit!==limit||prior.expiresAt!==expiresAt))throw Error('Cannot change an existing runtime budget');if(!prior)db.put('runtime-budget',id,{limit,expiresAt,used:0});}
 private available(){const state=this.db.get<{used:number}>('runtime-budget',this.id)!;if(Date.now()>=this.expiresAt||state.used>=this.limit)throw Error('Testnet runtime budget exhausted; recover receipts without further broadcasts');return state;}
 async sign(id:string,c:Command,minNonce?:string){this.available();return this.chain.sign(id,c,minNonce);}
 async broadcast(tx:Signed){this.db.transaction(()=>{const state=this.available();this.db.put('runtime-budget',this.id,{...state,limit:this.limit,expiresAt:this.expiresAt,used:state.used+1});});return this.chain.broadcast(tx);}
 receipt(id:string){return this.chain.receipt(id);}
 clock(){if(!this.chain.clock)throw Error('Clock unavailable');return this.chain.clock();}
 transactionState(tx:Signed){return this.chain.transactionState?.(tx)??Promise.resolve('unknown' as const);}
}
