import type {ItemType} from '../../shared/src/types';
/** Hypothetical closed-edition accounts, never a quote or demand forecast. */
export function businessRehearsal(input:{rewards:(ItemType|null)[];randomSockets?:number;copies:number;fee:number;placement:number;paidAttempts:number;fullClaims:number;stockCost:number|null;otherCost:number}){
 const {rewards,copies,fee,placement,paidAttempts,fullClaims,stockCost,otherCost}=input;
 const randomSockets=input.randomSockets??0;
 for(const n of [randomSockets,copies,fee,placement,paidAttempts,fullClaims,otherCost,...(stockCost===null?[]:[stockCost])])if(!Number.isSafeInteger(n)||n<0||n>1_000_000)throw Error('Use whole numbers from 0 to 1,000,000.');
 if(copies<1)throw Error('At least one funded copy is required.');
 if(fullClaims>paidAttempts)throw Error('Full-pool claims cannot exceed paid attempts.');
 const requirements:Partial<Record<ItemType,number>>={};for(const type of rewards)if(type)requirements[type]=(requirements[type]??0)+copies;
 const hasRewards=Object.keys(requirements).length>0||randomSockets>0;
 if(Object.values(requirements).reduce((sum,n)=>sum+n,0)+randomSockets*copies>128)throw Error('This scenario exceeds the 128-item opening stock limit. Model later refreshes separately.');
 if(hasRewards&&fullClaims>copies)throw Error('Claims exceed funded copies. Model replenishment separately.');
 if(!hasRewards&&fullClaims)throw Error('A no-reward creation has no reward claims.');
 const revenue=fee*paidAttempts;
 // Full committed cost is charged once, even when unclaimed goods go to the bank.
 const cost=hasRewards&&stockCost===null?null:placement+(stockCost??0)+otherCost;
 return {requirements,randomItemsRequired:randomSockets*copies,revenue,totalCost:cost,contribution:cost===null?null:revenue-cost,breakEvenAttempts:cost===null?null:cost===0?0:fee===0?null:Math.ceil(cost/fee),remainingCopies:hasRewards?copies-fullClaims:null};
}
