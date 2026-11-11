export type ShopSale={operationId:string;listingId:string;buyer:string;itemIds:string[];unitPrice:string;total:string};
/** What any visitor may see about a shop: counts from confirmed receipts, never buyer names or revenue. */
export type PublicShopRecord={sold:number;buyers:number;coverage:'complete'|'partial'};
export type ShopRecord={sales:ShopSale[];recordedRevenue:string;recordedItems:number;stockItems:number;coverage:'complete'|'partial';unrecordedSoldItems:number;cancelledListings:number;missingListings:number};
