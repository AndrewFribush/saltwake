export type CostLot={owner:string;cost:string|null;source:string};
export type CostDisposal={editionId?:string;itemId:string;owner:string;cost:string|null;reason:'sale'|'funding'|'consumed'|'forfeited';proceeds:string|null};
export type CostState={lots:Record<string,CostLot>;owners:Record<string,string>;gaps:number};
export type CostReport={knownOwnedCost:string;unknownOwnedItems:number;fundingCost:string;unknownFundedItems:number;saleProceeds:string;matchedSaleCost:string;unknownSaleItems:number;recordedSaleContribution:string|null;gaps:number;trackedOperations:number};

export type EditionCostReport={settledFees:string;pendingFees:string;placementCost:string;knownTreasureCost:string;unknownTreasureItems:number;contribution:string|null};
