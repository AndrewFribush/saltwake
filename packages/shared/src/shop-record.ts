export type ShopSale={operationId:string;listingId:string;buyer:string;itemIds:string[];unitPrice:string;total:string};
export type ShopRecord={sales:ShopSale[];recordedRevenue:string;recordedItems:number;stockItems:number;coverage:'complete'|'partial';unrecordedSoldItems:number;cancelledListings:number;missingListings:number};
