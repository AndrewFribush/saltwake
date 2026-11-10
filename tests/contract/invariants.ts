import assert from 'node:assert/strict';
import {catalog} from '../../packages/shared/src/catalog';
export function audit(s:any){
 const items=new Map<string,any>(s.items.map((i:any)=>[i.id,i]));assert.equal(items.size,14,'seeded instances neither lost nor duplicated');
 const credits=Object.values(s.credits).reduce<bigint>((n,v)=>n+BigInt(v as string),0n);
 const pending=s.runs.filter((r:any)=>r.status==='active').reduce((n:bigint,r:any)=>n+BigInt(r.fee),0n);
 assert.equal(credits+BigInt(s.bank)+pending,150n,'credits plus bank plus escrow conserved');
 for(const e of s.editions){
  assert.deepEqual([...e.active_runs].sort(),s.runs.filter((r:any)=>r.edition===e.id&&r.status==='active').map((r:any)=>r.id).sort());
  const funded=e.funded_ids.map((id:string)=>items.get(id));assert.equal(new Set(e.funded_ids).size,e.funded_ids.length);
  assert.equal(funded.reduce((n:bigint,i:any)=>n+BigInt(catalog[i.item_type as keyof typeof catalog].value),0n),BigInt(e.original_value));
  if(e.closed)assert.equal(e.active_runs.length,0);
  if(e.closed)assert.ok(!s.items.some((i:any)=>['edition_fixed','edition_random'].includes(i.location.kind)&&i.location.edition===e.id));
 }
 for(const r of s.runs.filter((r:any)=>r.status==='active')){
  for(const id of r.loadout_ids)assert.deepEqual(items.get(id)?.location,{kind:'loadout',run:r.id,profile:r.player});
  for(const a of r.assignments)assert.deepEqual(items.get(a.item_id)?.location,{kind:'reserved',run:r.id,socket:a.socket,source_pool:a.source_pool});
 }
 for(const i of s.items){const l=i.location;
  if(l.kind==='edition_fixed'){const e=s.editions.find((e:any)=>e.id===l.edition);assert.ok(e);assert.ok(e.funded_ids.includes(i.id));assert.equal(l.item_type,i.item_type);assert.equal(e.closed,false);}
  if(l.kind==='owned')assert.ok(Object.hasOwn(s.credits,l.profile));
  if(l.kind==='consumed')assert.ok(['tonic','fineTonic'].includes(i.item_type));
  if(l.kind==='reserved'||l.kind==='loadout'){
   const r=s.runs.find((r:any)=>r.id===l.run);assert.equal(r?.status,'active');
   if(l.kind==='reserved')assert.ok(r.assignments.some((a:any)=>a.item_id===i.id&&a.socket===l.socket&&a.source_pool===l.source_pool));else assert.ok(r.player===l.profile&&r.loadout_ids.includes(i.id));
  }
 }
}
