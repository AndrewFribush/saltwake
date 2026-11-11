export type MatchOffer={id:string;maker:string;status:string;fee:string;terms:{style_tag:string;difficulty_tag:string;no_reward:boolean}};
export type MatchPreferences={maxFee:number;style:string;difficulty:string;rewards:'any'|'treasure'|'none'};
export function matchEditions<T extends MatchOffer>(offers:readonly T[],profile:string,p:MatchPreferences,rotation=0,limit=3):T[]{
 if(!Number.isFinite(p.maxFee)||p.maxFee<0)return [];
 const eligible=offers.filter(e=>e.status==='open'&&e.maker!==profile&&/^\d+$/.test(e.fee)&&BigInt(e.fee)<=BigInt(Math.floor(p.maxFee))&&(p.style==='any'||p.style===e.terms.style_tag)&&(p.difficulty==='any'||p.difficulty===e.terms.difficulty_tag)&&(p.rewards==='any'||(p.rewards==='none')===e.terms.no_reward));
 const groups=new Map<string,T[]>();for(const e of eligible){const key=BigInt(e.fee).toString();groups.set(key,[...(groups.get(key)??[]),e]);}
 return [...groups].sort(([a],[b])=>BigInt(a)<BigInt(b)?-1:BigInt(a)>BigInt(b)?1:0).flatMap(([,group])=>{const offset=((Math.trunc(rotation)%group.length)+group.length)%group.length;return [...group.slice(offset),...group.slice(0,offset)];}).slice(0,limit);
}
