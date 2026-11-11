import type {EconomySnapshot,Item} from './types';import {catalog} from './catalog';
export type RecoveryOffer={eligible:boolean;reason:string;holdings:string;wage:string;jobsLeft:number;bankInputIds:string[]};
/** Mirrors contract profile_holdings: collateral and pending income cannot be hidden to claim aid. */
export function recoveryOffer(w:EconomySnapshot,profile:string):RecoveryOffer{
 let holdings=BigInt(w.credits[profile]??'0');
 for(const i of w.items){const l=i.location;const mine=(l.kind==='owned'||l.kind==='loadout')?l.profile===profile:l.kind==='listed'?w.listings.some(x=>x.id===l.listing&&x.seller===profile):l.kind==='crafting'?w.batches.some(b=>b.id===l.batch&&!b.recovery&&b.actor===profile):false;if(mine)holdings+=BigInt(catalog[i.item_type].value);}
 for(const r of w.runs.filter(r=>r.status==='active'))if(r.player===profile||w.editions.some(e=>e.id===r.edition&&e.maker===profile))holdings+=BigInt(r.fee);
 for(const b of w.batches.filter(b=>b.actor===profile))holdings+=BigInt(b.wage_reserved);
 const recovery=w.recovery,wage=recovery?.wage??'0',jobsLeft=Math.max(0,(recovery?.max_jobs_per_profile??0)-(recovery?.jobs?.[profile]??0));
 const bankInputIds=['herb','flask'].flatMap(type=>w.items.filter(i=>i.location.kind==='bank'&&i.item_type===type).slice(0,2).map(i=>i.id));
 const reason=w.batches.some(b=>b.actor===profile&&b.status==='active')?'Finish your current batch first.':!jobsLeft?'Your recovery-job allowance is used up.':holdings>=8n?`Your holdings are ${holdings}; recovery work requires less than 8.`:BigInt(recovery?.budget??'0')<BigInt(wage)?'The labor fund is exhausted.':bankInputIds.length!==4?'The bank needs 2 herbs and 2 flasks to supply a job.':`Bank supplies the ingredients and keeps the tonics. You earn ${wage} coins.`;
 return {eligible:!w.batches.some(b=>b.actor===profile&&b.status==='active')&&jobsLeft>0&&holdings<8n&&BigInt(recovery?.budget??'0')>=BigInt(wage)&&bankInputIds.length===4,reason,holdings:holdings.toString(),wage,jobsLeft,bankInputIds};
}
export function recipeSelection(items:readonly Item[],profile:string,ids:readonly string[]):{valid:boolean;reason:string}{
 if(new Set(ids).size!==ids.length)return {valid:false,reason:'Select each ingredient once.'};
 const selected=ids.map(id=>items.find(i=>i.id===id&&i.location.kind==='owned'&&i.location.profile===profile));
 if(selected.some(i=>!i))return {valid:false,reason:'Some selected goods are no longer in your storage.'};
 const herbs=selected.filter(i=>i?.item_type==='herb').length,flasks=selected.filter(i=>i?.item_type==='flask').length;
 const small=ids.length===2&&herbs===1&&flasks===1;const valid=ids.length===4&&herbs===2&&flasks===2||small;
 return {valid,reason:small?'Ready: a small batch, 1 herb and 1 flask make 1 tonic.':valid?'Ready: 2 herbs and 2 flasks make 2 tonics.':`Selected ${herbs}/2 herbs and ${flasks}/2 flasks${ids.length>herbs+flasks?'; remove non-ingredients':''}. Choose exactly 2 of each from stored goods.`};
}
