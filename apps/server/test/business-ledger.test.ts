import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {Store} from '../src/db';import {businessLedger} from '../src/business-ledger';import type {EconomySnapshot} from '../../../packages/shared/src/types';
test('buy-ins are itemized as labelled issuance and wallet purses reconcile; demo starting allocations stay unexplained',t=>{
 const dir=mkdtempSync(join(tmpdir(),'ledger-'));const db=new Store(join(dir,'db'));t.after(()=>{db.close();rmSync(dir,{recursive:true,force:true});});
 const world={credits:{'wallet:a.testnet':'10',maker:'5'},bank:'0',items:[],editions:[],runs:[],listings:[],batches:[],shops:[],buy_ins:{'wallet:a.testnet':'10'}} as unknown as EconomySnapshot;
 const a=businessLedger(world,db,'wallet:a.testnet');
 assert.deepEqual(a.cash,[{category:'buyin',direction:'in',amount:'10',count:1,label:'Bought with NEAR (labelled issuance)'}]);
 assert.deepEqual(a.reconciliation,{purse:'10',recordedNet:'10',unexplained:'0',startsAtZero:true});
 const m=businessLedger(world,db,'maker');assert.equal(m.cash.length,0);assert.deepEqual(m.reconciliation,{purse:'5',recordedNet:'0',unexplained:'5',startsAtZero:false});
 assert.ok(a.notes[0].includes('synthetic'));
});
