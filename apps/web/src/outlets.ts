import {catalog} from '../../../packages/shared/src/catalog';
type W={profile:string;npc_order?:any;commissions?:any[]};
/** Where a crafted good sells best right now: open commissions, the standing order, then the bank's half-price buyback. */
export function bestOutlets(world:W,type:string):{text:string;best:number}{
 const value=(catalog as Record<string,{value:number;name:string}>)[type]?.value??0;const bank=Math.floor(value/2);
 const out:{price:number;where:string}[]=[{price:bank,where:'the bank buys at the market counter (Sell tab)'}];
 const o=world.npc_order;if(o&&o.item_type===type&&o.remaining>0)out.push({price:Number(o.unit_price),where:`the market’s standing order takes ${o.remaining} more (Orders tab)`});
 for(const c of world.commissions??[])if(c.status==='open'&&c.item_type===type&&c.buyer!==world.profile){const left=c.quantity-c.filled;if(left>0)out.push({price:Number(c.unit_price),where:`a player commission wants ${left} (notice board, Commissions tab)`});}
 out.sort((a,b)=>b.price-a.price);
 return {best:out[0].price,text:out.slice(0,3).map(x=>`${x.price} each: ${x.where}`).join(' · ')};
}
