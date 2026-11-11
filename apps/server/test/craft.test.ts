import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Craft, MAX_CRAFT_REQUESTS} from '../src/craft';
import {Store} from '../src/db';
import {Outbox, type Chain} from '../src/outbox';
import type {CraftBatch, EconomySnapshot} from '../../../packages/shared/src/types';

const ids = ['herb1', 'herb2', 'flask1', 'flask2'];
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'craft-controller-'));
  let db = new Store(join(dir, 'db'));
  let now = 1_000;
  let outbox = new Outbox(db, {} as Chain);
  let craft = new Craft(db, outbox, () => now);
  function confirm(id: string, status: 'Applied' | 'Rejected' = 'Applied') {
    const op = db.operation(id)!;
    op.status = status;
    op.receipt = {status, op_id: id, payload_hash: op.hash, result: status === 'Rejected' ? 'InvalidRecipe' : 'ok', run: null};
    db.putOperation(op);
  }
  function batch(beginOp: string): CraftBatch {
    const action = db.operation(beginOp)!.command.action;
    if (action.type !== 'begin_craft' && action.type !== 'begin_recovery') throw Error('Not begin');
    return {id: action.batch_id, actor: 'artisan', input_ids: [...ids], challenge_commitment: action.challenge_commitment,
      deadline_ms: action.deadline_ms, recovery: action.type === 'begin_recovery', wage_reserved: '0', status: 'active', tier: null, reason: null, output_ids: []};
  }
  const snapshot = (b: CraftBatch) => ({batches: [b]} as EconomySnapshot);
  return {
    get db() {return db;}, get craft() {return craft;}, get outbox() {return outbox;},
    setTime(value: number) {now = value;}, confirm, batch, snapshot,
    begin(recovery = false) {
      const v = craft.begin('artisan', 'request1', ids, recovery);
      confirm(v.beginOp);
      craft.materialize(snapshot(batch(v.beginOp)));
      return craft.view('artisan')!;
    },
    restart() {db.close(); db = new Store(join(dir, 'db')); outbox = new Outbox(db, {} as Chain); craft = new Craft(db, outbox, () => now);},
    close() {db.close(); rmSync(dir, {recursive: true, force: true});},
  };
}

test('persist challenge and begin atomically; require matching confirmed batch before play', () => {
  const f = fixture();
  try {
    const v = f.craft.begin('artisan', 'request1', ids);
    assert.equal(v.status, 'pending');
    const commitment = f.batch(v.beginOp).challenge_commitment;
    assert.match(commitment, /^[a-f0-9]{64}$/);
    assert.throws(() => f.craft.startStep('artisan', v.id, 'start0', 0, 0), /confirmed/);
    f.craft.materialize(f.snapshot(f.batch(v.beginOp)));
    assert.equal(f.craft.view('artisan')!.status, 'pending');
    f.confirm(v.beginOp);
    assert.throws(() => f.craft.materialize(f.snapshot({...f.batch(v.beginOp), actor: 'intruder'})), /mismatch/);
    f.craft.materialize(f.snapshot(f.batch(v.beginOp)));
    assert.equal(f.craft.view('artisan')!.status, 'active');
    assert.throws(() => f.craft.begin('artisan', 'request2', ids), /active/);
    f.restart();
    assert.equal(f.batch(v.beginOp).challenge_commitment, commitment);
    assert.equal(f.craft.begin('artisan', 'request1', ids).id, v.id);
  } finally {f.close();}
});

test('three server-timed inputs finish fine exactly once and stay pending until confirmation', () => {
  const f = fixture();
  try {
    const v = f.begin();
    let seq = 0;
    for (let step = 0; step < 3; step++) {
      f.setTime(1_000 + step * 10_000);
      const started = f.craft.startStep('artisan', v.id, `start${step}`, seq++, step);
      f.setTime(6_500 + step * 10_000);
      const result = f.craft.input('artisan', v.id, `input${step}`, seq++, step);
      assert.equal(result.inputs[step], 5_500);
      assert.deepEqual(f.craft.startStep('artisan', v.id, `start${step}`, seq - 2, step), started);
      assert.deepEqual(f.craft.input('artisan', v.id, `input${step}`, seq - 1, step), result);
    }
    const end = f.craft.view('artisan')!;
    assert.equal(end.tier, 'fine');
    assert.equal(end.status, 'finishing');
    assert.equal(f.db.operation(end.finishOp!)!.command.action.type, 'finish_craft');
    assert.equal(f.db.operations().length, 2);
    assert.throws(() => f.craft.begin('artisan', 'new', ids), /active/);
    f.craft.materialize(f.snapshot({...f.batch(v.beginOp), status: 'finished', tier: 'fine', reason: 'completed', output_ids: ['out1', 'out2']}));
    assert.equal(f.craft.view('artisan')!.status, 'finished');
    assert.deepEqual(f.craft.view('artisan')!.outputIds, ['out1', 'out2']);
  } finally {f.close();}
});

test('restart preserves explicit start; spoofed timings cannot improve tier; IDs and ownership enforced', () => {
  const f = fixture();
  try {
    const v = f.begin();
    assert.throws(() => f.craft.input('artisan', v.id, 'input0', 0, 0), /started/);
    f.craft.startStep('artisan', v.id, 'start0', 0, 0);
    f.restart();
    f.setTime(2_000);
    assert.equal(f.craft.view('artisan')!.startedAtMs, 1_000);
    assert.throws(() => f.craft.startStep('artisan', v.id, 'reroll', 1, 0), /started/);
    assert.throws(() => f.craft.input('other', v.id, 'input0', 1, 0), /owner/);
    assert.throws(() => f.craft.input('artisan', v.id, 'input0', 0, 0), /sequence/);
    const result = (f.craft.input as Function)('artisan', v.id, 'input0', 1, 0, {elapsedMs: 5_500, tier: 'fine'});
    assert.equal(result.inputs[0], 1_000);
    assert.throws(() => f.craft.input('artisan', v.id, 'input0', 2, 1), /conflict/);
    assert.throws(() => f.craft.input('artisan', v.id, 'start0', 0, 0), /conflict/);
  } finally {f.close();}
});

test('deadline expires to normal once across restart, including a retry of the triggering input', () => {
  const f = fixture();
  try {
    const v = f.begin(true);
    f.craft.startStep('artisan', v.id, 'start0', 0, 0);
    f.setTime(v.deadlineMs);
    const expired = f.craft.input('artisan', v.id, 'late', 1, 0);
    f.restart();
    assert.deepEqual(f.craft.input('artisan', v.id, 'late', 1, 0), expired);
    f.craft.expire(); f.craft.expire();
    const action = f.db.operation(expired.finishOp!)!.command.action;
    assert.deepEqual(action, {type: 'finish_recovery', batch_id: v.id, tier: 'normal', reason: 'expired'});
    assert.equal(f.db.operations().length, 2);
  } finally {f.close();}
});

test('worker expires an untouched batch after restart and late admission confirmation', () => {
  const f = fixture();
  try {
    const v = f.craft.begin('artisan', 'request1', ids);
    f.setTime(v.deadlineMs);
    f.craft.expire();
    assert.equal(f.db.operations().length, 1);
    f.confirm(v.beginOp); f.restart();
    f.craft.materialize(f.snapshot(f.batch(v.beginOp)));
    f.craft.expire(); f.craft.expire();
    assert.equal(f.craft.view('artisan')!.tier, 'normal');
    assert.equal(f.db.operations().length, 2);
  } finally {f.close();}
});

test('rejected begins release profile but same request never rerolls or re-enqueues', () => {
  const f = fixture();
  try {
    const v = f.craft.begin('artisan', 'request1', ids);
    const commitment = f.batch(v.beginOp).challenge_commitment;
    f.confirm(v.beginOp, 'Rejected'); f.restart();
    assert.equal(f.craft.begin('artisan', 'request1', ids).status, 'rejected');
    assert.equal(f.batch(v.beginOp).challenge_commitment, commitment);
    assert.throws(() => f.craft.begin('artisan', 'request1', [...ids].reverse()), /conflict/);
    assert.notEqual(f.craft.begin('artisan', 'request2', ids).id, v.id);
    assert.equal(f.db.operations().length, 2);
  } finally {f.close();}
});

test('enqueue failures roll back both challenge creation and final input', () => {
  const f = fixture();
  try {
    const enqueue = f.outbox.enqueue.bind(f.outbox);
    f.outbox.enqueue = () => {throw Error('capacity');};
    assert.throws(() => f.craft.begin('artisan', 'request1', ids), /capacity/);
    assert.equal(f.craft.view('artisan'), null);
    assert.equal(f.db.all('craft').length, 0);
    f.outbox.enqueue = enqueue;
    const v = f.begin();
    f.craft.startStep('artisan', v.id, 'start0', 0, 0);
    f.setTime(v.deadlineMs);
    f.outbox.enqueue = () => {throw Error('capacity');};
    assert.throws(() => f.craft.input('artisan', v.id, 'late', 1, 0), /capacity/);
    assert.equal(f.craft.view('artisan')!.status, 'active');
    assert.equal(f.craft.view('artisan')!.seq, 1);
    f.outbox.enqueue = enqueue;
    assert.equal(f.craft.input('artisan', v.id, 'late', 1, 0).status, 'finishing');
  } finally {f.close();}
});

test('normal tier is derived from early and late server timings; final input rollback is atomic', () => {
  const f = fixture();
  try {
    const v = f.begin();
    f.craft.startStep('artisan', v.id, 's0', 0, 0);
    f.setTime(2_000); f.craft.input('artisan', v.id, 'i0', 1, 0);
    f.craft.startStep('artisan', v.id, 's1', 2, 1);
    f.setTime(12_000); f.craft.input('artisan', v.id, 'i1', 3, 1);
    f.craft.startStep('artisan', v.id, 's2', 4, 2);
    f.setTime(17_500);
    const enqueue = f.outbox.enqueue.bind(f.outbox);
    f.outbox.enqueue = () => {throw Error('capacity');};
    assert.throws(() => f.craft.input('artisan', v.id, 'i2', 5, 2), /capacity/);
    assert.deepEqual(f.craft.view('artisan')!.inputs, [1_000, 7_000]);
    assert.equal(f.craft.view('artisan')!.startedAtMs, 12_000);
    f.outbox.enqueue = enqueue;
    const end = f.craft.input('artisan', v.id, 'i2', 5, 2);
    assert.equal(end.tier, 'normal');
    assert.equal(end.reason, 'completed');
    assert.equal(f.db.operations().length, 2);
  } finally {f.close();}
});

test('premature expiry retries once only after confirmed chain deadline without reopening play', () => {
  const f = fixture();
  try {
    const v = f.begin(); f.setTime(v.deadlineMs); f.craft.expire();
    const first = f.craft.view('artisan')!.finishOp!;
    f.confirm(first, 'Rejected');
    const op = f.db.operation(first)!;
    if (op.receipt?.status === 'Rejected') op.receipt.result = 'PrematureExpiry';
    f.db.putOperation(op); f.restart();
    f.craft.retryExpiry(v.deadlineMs - 1);
    assert.equal(f.db.operations().length, 2);
    f.craft.retryExpiry(v.deadlineMs); f.craft.retryExpiry(v.deadlineMs); f.craft.expire();
    const end = f.craft.view('artisan')!;
    assert.equal(f.db.operations().length, 3);
    assert.equal(end.status, 'finishing');
    assert.deepEqual(f.db.operation(end.finishOp!)!.command, op.command);
    assert.throws(() => f.craft.startStep('artisan', v.id, 'reroll', 0, 0), /terminal/);
  } finally {f.close();}
});

test('open craft requests are bounded, terminal ones never block new crafting, and profiles stay independent', () => {
  const f = fixture();
  try {
    const a = f.craft.begin('artisan', 'first', ids);
    const b = f.craft.begin('other', 'first', ids, true);
    assert.notEqual(a.id, b.id);
    assert.equal(f.craft.view('artisan')!.id, a.id);
    f.confirm(a.beginOp, 'Rejected'); f.confirm(b.beginOp, 'Rejected');
    // Far past the old lifetime cap: finished and rejected requests never fill the store.
    for (let i = 2; i < MAX_CRAFT_REQUESTS + 8; i++) {
      const v = f.craft.begin('artisan', `r${i}`, ids);
      f.confirm(v.beginOp, 'Rejected');
    }
    assert.equal(f.craft.begin('artisan', 'first', ids).id, a.id);
    // Open (unresolved) requests are what the cap bounds.
    const open = [];
    for (let i = 0; i < MAX_CRAFT_REQUESTS; i++) open.push(f.craft.begin(`open-${i}`, 'req', ids));
    assert.throws(() => f.craft.begin('artisan', 'overflow', ids), /storage capacity/);
    f.confirm(open[0].beginOp, 'Rejected');
    assert.doesNotThrow(() => f.craft.begin('artisan', 'after-one-closes', ids));
  } finally {f.close();}
});
