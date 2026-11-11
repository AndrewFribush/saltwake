/** NEAR buy-in: mirrors contracts/economy/src/buyin.rs. 0.01 NEAR per coin (0.1 NEAR = 10 coins). */
export const COIN_PRICE_YOCTO=10n**22n;
export const MAX_COINS_PER_PURCHASE=1000;
export const BUY_IN_GAS='30000000000000';
export type BuyInTransaction={receiverId:string;methodName:'buy_coins';args:{request_id:string;expected_coins:string};gas:string;deposit:string};
export const buyInDeposit=(coins:number)=>(BigInt(coins)*COIN_PRICE_YOCTO).toString();
/** "0.1 NEAR" style label for an exact yocto amount. */
export function nearLabel(yocto:string|bigint){const v=BigInt(yocto),whole=v/10n**24n,frac=(v%10n**24n).toString().padStart(24,'0').replace(/0+$/,'');return `${whole}${frac?'.'+frac:''} NEAR`;}
export function buyInTransaction(contractId:string,requestId:string,coins:number):BuyInTransaction{
 if(!Number.isSafeInteger(coins)||coins<1||coins>MAX_COINS_PER_PURCHASE)throw Error(`Buy between 1 and ${MAX_COINS_PER_PURCHASE} coins`);
 if(!/^[A-Za-z0-9_-]{1,40}$/.test(requestId))throw Error('Invalid request id');
 return {receiverId:contractId,methodName:'buy_coins',args:{request_id:requestId,expected_coins:String(coins)},gas:BUY_IN_GAS,deposit:buyInDeposit(coins)};
}
/** The only transaction allowed to attach NEAR: exact shape, and deposit = expected_coins × price. */
export function isExactBuyIn(tx:any,contractId:string):tx is BuyInTransaction{
 if(!tx||typeof tx!=='object'||Object.keys(tx).sort().join(',')!=='args,deposit,gas,methodName,receiverId')return false;
 if(tx.receiverId!==contractId||tx.methodName!=='buy_coins'||tx.gas!==BUY_IN_GAS||!tx.args||Object.keys(tx.args).sort().join(',')!=='expected_coins,request_id')return false;
 const {request_id,expected_coins}=tx.args;
 if(typeof request_id!=='string'||!/^[A-Za-z0-9_-]{1,40}$/.test(request_id)||typeof expected_coins!=='string'||!/^[1-9]\d{0,3}$/.test(expected_coins)||Number(expected_coins)>MAX_COINS_PER_PURCHASE)return false;
 return typeof tx.deposit==='string'&&/^\d{1,40}$/.test(tx.deposit)&&BigInt(tx.deposit)===BigInt(expected_coins)*COIN_PRICE_YOCTO;
}
