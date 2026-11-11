import type {CashEntry} from './business-account';
/** Owner-only business ledger. Every figure comes from confirmed receipts or authoritative contract records;
 * anything that cannot be proven is reported as unknown, never estimated. Synthetic game coins, not real profit. */
export type LedgerCash={category:CashEntry['category']|'wage'|'buyin';direction:'in'|'out';amount:string;count:number;label:string};
export type LedgerGood={itemId:string;itemType:string;cost:string|null;source:string};
export type LedgerEdition={id:string;title:string;open:boolean;placement:string;settledFees:string;pendingFees:string;knownTreasureCost:string;unknownTreasureItems:number;contribution:string|null;settledRuns:number;activeRuns:number;fundedGoodsRemaining:number;
 /** Fixed-reward goods one more complete copy still lacks (empty when a copy is ready or the dungeon has no fixed rewards). */
 missingForCopy:Record<string,number>};
export type LedgerShop={id:string;title:string;open:boolean;revenue:string;itemsSold:number;matchedCost:string;unknownCostItems:number;contribution:string|null;coverage:'complete'|'partial';stockItems:number};
export type BusinessLedger={cash:LedgerCash[];recordedIn:string;recordedOut:string;goods:LedgerGood[];knownGoodsCost:string;unknownCostGoods:number;
 committedFunding:{editions:number;goods:number;knownCost:string;unknownCostItems:number};pending:{makerFees:string;recoveryWages:string;reservedRunFees:string};
 editions:LedgerEdition[];shops:LedgerShop[];notes:string[];
 /** Purse = recorded net + unexplained. Wallet players start at 0, so unexplained should be 0 for them. */
 reconciliation:{purse:string;recordedNet:string;unexplained:string;startsAtZero:boolean}};
