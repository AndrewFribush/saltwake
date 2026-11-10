import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {AddressInfo} from 'node:net';
import type {EconomySnapshot, EconomicRun, EconomicEdition} from '../../../packages/shared/src/types';
import {Store} from '../src/db';
import {walletView} from '../src/wallet';
import {Outbox} from '../src/outbox';
import {Runs} from '../src/runs';
import {httpServer} from '../src/http';
import {DemoSessions} from '../src/auth';

function world(): EconomySnapshot {
  return {credits: {buyer: '9007199254740993', maker: '8'}, bank: '0', items: [], editions: [], runs: [], listings: [], batches: [],
    bank_prices: [], npc_order: {id: 'order', item_type: 'tonic', unit_price: '1', remaining: 0, budget: '0', seeded_demo_demand: true},
    recovery: {epoch: '1', budget: '0', wage: '2', max_jobs_per_profile: 1, jobs: {}}};
}
function run(id: string, player: string, status: EconomicRun['status'], fee: string): EconomicRun {
  return {id, player, status, fee, edition: 'edition', deadline_ms: '0', seed: '0', loadout_ids: [], assignments: [], terminal_reason: null};
}
test('wallet separates purse, reserved fees, catalog assets and unearned wages exactly', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wallet-')); const db = new Store(join(dir, 'db'));
  try {
    const state = world();
    state.runs = [run('active', 'buyer', 'active', '9007199254740993'), run('other', 'maker', 'active', '7'), run('void', 'buyer', 'void', '50'), run('done', 'buyer', 'extracted', '30')];
    state.items = [{id: 'own', item_type: 'sword', location: {kind: 'owned', profile: 'buyer'}},
      {id: 'other', item_type: 'sword', location: {kind: 'owned', profile: 'maker'}},
      {id: 'listed', item_type: 'sword', location: {kind: 'listed', listing: 'sale'}},
      {id: 'carried', item_type: 'club', location: {kind: 'loadout', run: 'active', profile: 'buyer'}}];
    const batch = {id: 'job', actor: 'buyer', input_ids: [], challenge_commitment: '', deadline_ms: '0', recovery: true, wage_reserved: '3', status: 'active' as const, tier: null, reason: null, output_ids: []};
    state.batches = [batch, {...batch, id: 'other', actor: 'maker'}, {...batch, id: 'done', status: 'finished'}];
    const view = walletView(state, db, 'buyer');
    assert.equal(view.purse, '9007199254740993');
    assert.equal(view.reservedRunFees, '9007199254740993');
    assert.equal(view.ownedItemCatalogValue, '12'); assert.equal(view.ownedItemCount, 1);
    assert.equal(view.pendingRecoveryWages, '3');
    assert.equal(walletView(state, db, 'absent').purse, null);
  } finally { db.close(); rmSync(dir, {recursive: true, force: true}); }
});
test('only matching authoritative receipts survive restart; unknown is never a receipt', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wallet-')); const path = join(dir, 'db'); let db = new Store(path);
  try {
    const command = {actor: 'buyer', action: {type: 'debit' as const, amount: '2'}};
    const receipt = {status: 'Applied' as const, op_id: 'paid', payload_hash: 'hash', result: 'debited', run: null};
    db.putOperation({id: 'paid', command, hash: 'hash', status: 'Applied', receipt, signed: {hash: 'secret-hash', bytes: 'private-signed-bytes'}});
    db.putOperation({id: 'unknown', command, hash: 'hash', status: 'Unknown', reason: 'private diagnostic'});
    db.putOperation({id: 'forged', command, hash: 'hash', status: 'Applied', receipt});
    db.putOperation({id: 'other', command: {...command, actor: 'maker'}, hash: 'hash', status: 'Applied', receipt: {...receipt, op_id: 'other'}});
    db.putOperation({id: 'rejected', command, hash: 'hash', status: 'Rejected', receipt: {...receipt, op_id: 'rejected', status: 'Rejected', result: 'insufficient credits'}});
    db.close(); db = new Store(path);
    const view = walletView(world(), db, 'buyer');
    assert.deepEqual(view.receipts.map(r => r.id), ['rejected', 'paid']);
    assert.deepEqual(view.unresolved, [{id: 'unknown', action: 'debit', status: 'Unknown'}]);
    assert.doesNotMatch(JSON.stringify(view), /private|secret-hash|forged/);
  } finally { db.close(); rmSync(dir, {recursive: true, force: true}); }
});
test('wallet API requires a session and ignores requested actors; world embeds the same view', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wallet-http-')); const db = new Store(join(dir, 'db'));
  const box = new Outbox(db, {async sign() { throw Error('No signing expected'); }, async broadcast() { throw Error('No broadcast expected'); }, async receipt() { return null; }});
  const app = httpServer(box, new Runs(db, box), async () => world(), new DemoSessions({profiles: ['buyer', 'maker'], secureCookies: false}));
  await new Promise<void>(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + (app.server.address() as AddressInfo).port;
  try {
    assert.equal((await fetch(base + '/api/wallet')).status, 401);
    const session = await fetch(base + '/api/session', {method: 'POST', headers: {Origin: base, 'Content-Type': 'application/json'}, body: '{}'});
    const Cookie = session.headers.get('set-cookie')!.split(';')[0];
    const response = await fetch(base + '/api/wallet?profile=maker', {headers: {Cookie}});
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    const wallet = await response.json(); assert.equal(wallet.profile, 'buyer');
    const state = await (await fetch(base + '/api/world', {headers: {Cookie}})).json();
    assert.deepEqual(state.wallet, wallet);
    await fetch(base + '/api/profile', {method: 'POST', headers: {Cookie, Origin: base, 'Content-Type': 'application/json'}, body: JSON.stringify({profile: 'maker', expectedProfile: 'buyer'})});
    const switched = await (await fetch(base + '/api/wallet', {headers: {Cookie}})).json();
    assert.equal(switched.profile, 'maker'); assert.equal(switched.purse, '8');
  } finally { await new Promise<void>(resolve => app.server.close(() => resolve())); db.close(); rmSync(dir, {recursive: true, force: true}); }
});


test('run fee history uses edition ownership, exact amounts and settled outcomes, excluding voids', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wallet-fees-')); const db = new Store(join(dir, 'db'));
  try {
    const state = world();
    const edition: EconomicEdition = {
      id: 'edition', maker: 'maker', terms: {title: 'Test', rules_version: 1, modules: [], sockets: [], opens_at_ms: '0', closes_at_ms: '1', no_reward: true, difficulty_tag: '', style_tag: '', run_duration_ms: '1', max_runs: 8},
      terms_hash: '', fee: '999', version: '1', placement_paid: '0', original_value: '0', refresh_value: '0', refresh_ids: [], random_tables: [], active_runs: [], funded_ids: [], closed: false, extracted_value: '0', consumed_value: '0', banked_value: '0',
    };
    state.editions = [edition, {...edition, id: 'unrelated', maker: 'stranger'}];
    state.runs = [run('active', 'buyer', 'active', '9007199254740993'), run('done', 'buyer', 'extracted', '30'),
      run('dead', 'buyer', 'died', '4'), run('abandoned', 'buyer', 'abandoned', '5'), run('expired', 'buyer', 'expired', '6'),
      run('void', 'buyer', 'void', '50'), run('self', 'maker', 'extracted', '2'),
      {...run('unrelated', 'stranger', 'active', '99'), edition: 'unrelated'}, run('free', 'buyer', 'extracted', '0')];
    const maker = walletView(state, db, 'maker');
    assert.equal(maker.pendingMakerFees, '9007199254740993');
    assert.equal(walletView(state, db, 'buyer').pendingMakerFees, '0');
    assert.equal(walletView(state, db, 'stranger').pendingMakerFees, '99');
    assert.deepEqual(maker.runFeeHistory.filter(e => e.role === 'maker').map(e => [e.runId, e.amount, e.status]), [
      ['active', '9007199254740993', 'active'], ['done', '30', 'extracted'], ['dead', '4', 'died'],
      ['abandoned', '5', 'abandoned'], ['expired', '6', 'expired'], ['self', '2', 'extracted'], ['free', '0', 'extracted'],
    ]);
    assert.deepEqual(maker.runFeeHistory.filter(e => e.runId === 'self').map(e => e.role), ['player', 'maker']);
    const buyer = walletView(state, db, 'buyer');
    assert.ok(buyer.runFeeHistory.every(e => e.role === 'player'));
    assert.deepEqual(buyer.runFeeHistory.map(e => e.runId), ['active', 'done', 'dead', 'abandoned', 'expired', 'free']);
    assert.equal(buyer.runFeeHistory[0].amount, '9007199254740993');
    assert.equal(buyer.runFeeHistory[1].amount, '30');
    assert.deepEqual(maker.receipts, []); // Incoming fees do not require a local actor operation.
    assert.deepEqual(walletView(state, db, 'absent').runFeeHistory, []);
    state.runs[0].status = 'void';
    assert.equal(walletView(state, db, 'maker').pendingMakerFees, '0');
    assert.ok(!walletView(state, db, 'maker').runFeeHistory.some(e => e.runId === 'active'));
  } finally { db.close(); rmSync(dir, {recursive: true, force: true}); }
});
