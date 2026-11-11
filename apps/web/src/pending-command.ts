/** A wallet request interrupted before its outcome was known is saved and retried under the same request id.
 * The contract remembers an operation for at least 72 hours (docs/systems/CAPACITY.md), so a retry is only safe
 * while it can still land inside that window: saved wallet requests older than 12 hours are dropped, never resent. */
export const WALLET_RETRY_MS=12*3600*1000;
export type PendingCommand={id:string;action:any;at?:number};
export function resumablePending(saved:string|null,wallet:boolean,now:number):{pending:PendingCommand|null;dropped:boolean}{
 if(!saved)return {pending:null,dropped:false};
 let pending:PendingCommand;try{pending=JSON.parse(saved);}catch{return {pending:null,dropped:true};}
 if(wallet&&(typeof pending.at!=='number'||!(now-pending.at<=WALLET_RETRY_MS)))return {pending:null,dropped:true};
 return {pending,dropped:false};
}
