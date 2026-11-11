import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../src/db';
import {withArchive,ARCHIVE_LIMITS} from '../src/history-archive';
import type {EconomySnapshot} from '../../../packages/shared/src/types';

const run=(id:string,status:string)=>({id,edition:'edition-0',player:'buyer',fee:'1',deadline_ms:'0',seed:'0',loadout_ids:[],assignments:[],status,terminal_reason:null}) as any;
const base=():EconomySnapshot=>({credits:{buyer:'1'},bank:'0',items:[],editions:[{id:'edition-0',maker:'maker',closed:true,active_runs:[]} as any],runs:[run('run-0','died'),run('run-1','active')],
 listings:[{id:'listing-0',seller:'maker',item_ids:['a'],remaining_ids:[],unit_price:'2',status:'sold'},{id:'listing-1',seller:'maker',item_ids:['b'],remaining_ids:['b'],unit_price:'2',status:'active'}] as any,
 shops:[{id:'shop-0',owner:'maker',listing_ids:['listing-0','listing-1']} as any],npc_order:{} as any,bank_prices:[],batches:[{id:'b-0',status:'finished'} as any],recovery:{} as any,
 commissions:[{id:'commission-0',status:'filled'} as any]});

test('terminal records pruned on chain stay visible to history views; the chain wins for records it holds',()=>{
 const dir=mkdtempSync(join(tmpdir(),'archive-'));const db=new Store(join(dir,'db.sqlite'));try{
  withArchive(db,base());
  // The contract pruned every terminal record and removed the sold listing from its shop.
  const pruned:EconomySnapshot={...base(),editions:[],runs:[run('run-1','active')],listings:[base().listings[1]],shops:[{id:'shop-0',owner:'maker',listing_ids:['listing-1']} as any],batches:[],commissions:[]};
  const merged=withArchive(db,pruned);
  assert.deepEqual(merged.runs.map(r=>r.id).sort(),['run-0','run-1']);
  assert.deepEqual(merged.listings.map(l=>l.id).sort(),['listing-0','listing-1']);
  assert.deepEqual(merged.shops?.[0].listing_ids.sort(),['listing-0','listing-1'],'the shop keeps its sales history');
  assert.deepEqual(merged.batches.map(b=>b.id),['b-0']);assert.deepEqual(merged.commissions?.map(c=>c.id),['commission-0']);assert.deepEqual(merged.editions.map(e=>e.id),['edition-0']);
  // Active records are never archived; a chain record always wins over an archived copy.
  assert.equal(db.get('archive-run','run-1'),undefined);
  const again=withArchive(db,{...pruned,runs:[run('run-0','died'),run('run-1','active')]});assert.equal(again.runs.length,2);
  // A demolished shop's id reused by someone else does not inherit its history.
  const other=withArchive(db,{...pruned,shops:[{id:'shop-0',owner:'p2',listing_ids:[]} as any]});assert.deepEqual(other.shops?.[0].listing_ids,[]);
  // The archive itself is bounded.
  withArchive(db,{...pruned,runs:Array.from({length:ARCHIVE_LIMITS.run+10},(_,i)=>run('run-x'+i,'void'))});
  assert.equal(db.all('archive-run').length,ARCHIVE_LIMITS.run);assert.equal(db.get('archive-run','run-0'),undefined,'oldest archived records go first');
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
