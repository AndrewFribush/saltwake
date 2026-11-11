import type {EconomySnapshot} from '../../../packages/shared/src/types';
import type {ShopRecord,ShopSale} from '../../../packages/shared/src/shop-record';
import type {StoredOperation} from './db';
/** Revenue from confirmed receipts only. Never infer sales from cancelled-listing residuals. */
export function shopRecord(world:EconomySnapshot,operations:readonly StoredOperation[],shopId:string):ShopRecord{
 const shop=world.shops?.find(s=>s.id===shopId);if(!shop)throw Error('Unknown shop');
 const listingIds=new Set(shop.listing_ids),listings=world.listings.filter(l=>listingIds.has(l.id));
 const sales:ShopSale[]=[],operationsSeen=new Set<string>(),itemsSeen=new Set<string>();let revenue=0n;
 for(const op of operations){
  const a=op.command.action,r=op.receipt;
  if(operationsSeen.has(op.id)||op.status!=='Applied'||r?.status!=='Applied'||r.op_id!==op.id||r.payload_hash!==op.hash||a.type!=='buy'||r.result!==a.listing_id)continue;
  const listing=listings.find(l=>l.id===a.listing_id);if(!listing||listing.seller!==shop.owner||listing.seller===op.command.actor||a.expected_unit_price!==listing.unit_price||!/^\d+$/.test(listing.unit_price)||!a.item_ids.length||new Set(a.item_ids).size!==a.item_ids.length||a.item_ids.some(id=>!listing.item_ids.includes(id)||listing.remaining_ids.includes(id)||itemsSeen.has(`${listing.id}:${id}`)))continue;
  const total=BigInt(listing.unit_price)*BigInt(a.item_ids.length);revenue+=total;operationsSeen.add(op.id);a.item_ids.forEach(id=>itemsSeen.add(`${listing.id}:${id}`));
  sales.push({operationId:op.id,listingId:listing.id,buyer:op.command.actor,itemIds:[...a.item_ids],unitPrice:listing.unit_price,total:total.toString()});
 }
 const unrecordedSoldItems=listings.filter(l=>l.status!=='cancelled').reduce((sum,l)=>sum+l.item_ids.filter(id=>!l.remaining_ids.includes(id)&&!itemsSeen.has(`${l.id}:${id}`)).length,0);
 const cancelledListings=listings.filter(l=>l.status==='cancelled').length,missingListings=shop.listing_ids.filter(id=>!listings.some(l=>l.id===id)).length;
 return {sales,recordedRevenue:revenue.toString(),recordedItems:sales.reduce((sum,s)=>sum+s.itemIds.length,0),stockItems:world.items.filter(i=>i.location.kind==='listed'&&listingIds.has(i.location.listing)).length,coverage:unrecordedSoldItems||cancelledListings||missingListings?'partial':'complete',unrecordedSoldItems,cancelledListings,missingListings};
}
