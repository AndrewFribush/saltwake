import type {EconomicEdition,Item} from '../../../packages/shared/src/types';
import {catalog} from '../../../packages/shared/src/catalog';
export function availability(e:EconomicEdition,items:Item[],now:number){
 const stock=items.filter(i=>(i.location.kind==='edition_fixed'||i.location.kind==='edition_random')&&i.location.edition===e.id);
 const requirements=new Map<string,number>();for(const s of e.terms.sockets)if(s.reward)requirements.set(s.reward,(requirements.get(s.reward)??0)+1);
 let bundles=e.terms.max_runs-e.active_runs.length;
 for(const [type,count] of requirements)bundles=Math.min(bundles,Math.floor(stock.filter(i=>i.location.kind==='edition_fixed'&&i.item_type===type).length/count));
 for(const table of e.random_tables??[])bundles=Math.min(bundles,Math.floor(stock.filter(i=>i.location.kind==='edition_random'&&i.location.table_id===table.table_id).length/table.socket_ids.length));
 const status=e.closed?'closed':now<Number(e.terms.opens_at_ms)?'scheduled':now>=Number(e.terms.closes_at_ms)?'closing':bundles>0?'open':e.active_runs.length?'booked':'depleted';
 const reservedValue=items.filter(i=>i.location.kind==='reserved'&&e.active_runs.includes(i.location.run)).reduce((n,i)=>n+catalog[i.item_type].value,0);
 const remainingValue=stock.reduce((n,i)=>n+catalog[i.item_type].value,0);
 const ledgerKnown=[e.original_value,e.refresh_value,e.extracted_value,e.consumed_value,e.banked_value].every(v=>typeof v==='string');
 const valueBalanced=ledgerKnown?BigInt(e.original_value)+BigInt(e.refresh_value)===BigInt(remainingValue)+BigInt(reservedValue)+BigInt(e.extracted_value)+BigInt(e.consumed_value)+BigInt(e.banked_value):null;
 return {reservedValue,extractedValue:e.extracted_value,consumedValue:e.consumed_value,bankedValue:e.banked_value,valueBalanced,status,bundles:Math.max(0,bundles),remainingValue,originalValue:e.original_value,refreshValue:e.refresh_value};
}
