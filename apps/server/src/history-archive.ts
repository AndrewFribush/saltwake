import type {EconomySnapshot} from '../../../packages/shared/src/types';
import type {Store} from './db';

/** The contract keeps only the newest terminal records of each kind (docs/systems/CAPACITY.md). Terminal records
 * never change again, so the server keeps its own bounded copy of each one it has seen and merges the copies back
 * into the snapshot it hands to history views (edition records, ledgers, shop records, run fee history).
 * The chain always wins for a record it still holds. A record pruned on chain before this server ever polled it is
 * not recoverable here, which is why the contract retains 64 terminal runs, listings and batches between polls.
 * Nothing here feeds a safety decision: admission, settlement and capacity checks read the chain. */
export const ARCHIVE_LIMITS={run:1024,listing:256,batch:256,commission:128,edition:64} as const;
type Kind=keyof typeof ARCHIVE_LIMITS;
type ArchivedListing={listing:EconomySnapshot['listings'][number];shop?:string;owner?:string};

export function withArchive(db:Store,world:EconomySnapshot):EconomySnapshot{
 const keep=<T extends {id:string}>(kind:Kind,records:readonly T[],terminal:(r:T)=>boolean,wrap:(r:T)=>unknown=r=>r)=>{
  let added=false;
  for(const r of records)if(terminal(r)&&!db.get('archive-'+kind,r.id)){db.put('archive-'+kind,r.id,wrap(r));added=true;}
  if(added)db.trim('archive-'+kind,ARCHIVE_LIMITS[kind]);
 };
 db.transaction(()=>{
  keep('run',world.runs,r=>r.status!=='active');
  keep('listing',world.listings,l=>l.status!=='active',l=>{const shop=world.shops?.find(s=>s.listing_ids.includes(l.id));return {listing:l,...(shop?{shop:shop.id,owner:shop.owner}:{})} satisfies ArchivedListing;});
  keep('batch',world.batches??[],b=>b.status!=='active');
  keep('commission',world.commissions??[],c=>c.status!=='open');
  keep('edition',world.editions,e=>e.closed);
 });
 const merge=<T extends {id:string}>(chain:readonly T[],archived:readonly T[])=>{const ids=new Set(chain.map(r=>r.id));return [...chain,...archived.filter(r=>!ids.has(r.id))];};
 const listings=db.all<ArchivedListing>('archive-listing');
 const shops=world.shops?.map(s=>{const extra=listings.filter(a=>a.shop===s.id&&a.owner===s.owner&&a.listing.seller===s.owner&&!s.listing_ids.includes(a.listing.id)).map(a=>a.listing.id);return extra.length?{...s,listing_ids:[...s.listing_ids,...extra]}:s;});
 return {...world,
  runs:merge(world.runs,db.all('archive-run')),
  listings:merge(world.listings,listings.map(a=>a.listing)),
  batches:merge(world.batches??[],db.all('archive-batch')),
  editions:merge(world.editions,db.all('archive-edition')),
  ...(world.commissions?{commissions:merge(world.commissions,db.all('archive-commission'))}:{}),
  ...(shops?{shops}:{}),
 };
}
