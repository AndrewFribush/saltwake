import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../src/db';
import {Feedback, type FeedbackChoice} from '../src/feedback';
import type {SavedRun} from '../src/runs';
import {createRun} from '../../../packages/game/src/state';

function fixture(t: {after: (fn: () => void) => void}) {
  const dir = mkdtempSync(join(tmpdir(), 'feedback-'));
  const path = join(dir, 'db');
  let db = new Store(path);
  t.after(() => {db.close(); rmSync(dir, {recursive: true, force: true});});
  return {
    get db() {return db;},
    get service() {return new Feedback(db);},
    restart() {db.close(); db = new Store(path);},
    run(id = 'run-1', terminal: SavedRun['terminal'] = 'extracted', edition = 'edition-1') {
      const row: SavedRun = {id, profile: 'buyer', terminal, seq: 3, state: createRun(),
        economic: {id, edition, player: 'buyer', fee: '2', deadline_ms: '999999', seed: '42',
          loadout_ids: [], assignments: [], status: 'active', terminal_reason: null}};
      db.put('run', id, row);
      return row;
    },
  };
}

test('requires a stored run owned by the caller and a local terminal outcome', t => {
  const f = fixture(t);
  assert.throws(() => f.service.submit('missing', 'buyer', 'fun'), /owner/i);
  f.run('active');
  const active = f.db.get<SavedRun>('run', 'active')!;
  delete active.terminal;
  active.economic.status = 'extracted'; // Chain state alone cannot replace the saved terminal gate.
  f.db.put('run', 'active', active);
  assert.throws(() => f.service.submit('active', 'buyer', 'fun'), /terminal/i);
  f.run();
  assert.throws(() => f.service.submit('run-1', 'other', 'fun'), /owner/i);
  assert.equal(f.db.all('feedback').length, 0);
});

test('accepts each terminal outcome and all three feedback choices', t => {
  const f = fixture(t);
  const outcomes = ['extracted', 'died', 'expired', 'abandoned', 'void'] as const;
  const choices: FeedbackChoice[] = ['fun', 'confusing', 'too-hard', 'fun', 'fun'];
  outcomes.forEach((outcome, index) => {
    f.run(outcome, outcome);
    assert.deepEqual(f.service.submit(outcome, 'buyer', choices[index]), {
      runId: outcome, profile: 'buyer', editionId: 'edition-1', choice: choices[index],
    });
  });
  assert.deepEqual(f.service.counts('edition-1'), {fun: 3, confusing: 1, 'too-hard': 1});
});

test('same-choice retries persist across restart; changing choice or owner cannot rewrite it', t => {
  const f = fixture(t);
  f.run();
  const first = f.service.submit('run-1', 'buyer', 'fun');
  f.restart();
  assert.deepEqual(f.service.submit('run-1', 'buyer', 'fun'), first);
  assert.throws(() => f.service.submit('run-1', 'buyer', 'confusing'), /immutable/i);
  assert.throws(() => f.service.submit('run-1', 'other', 'fun'), /owner/i);
  assert.deepEqual(f.db.all('feedback'), [first]);
  assert.deepEqual(f.service.counts('edition-1'), {fun: 1, confusing: 0, 'too-hard': 0});
});

test('runtime rejects unsupported choices without saving any feedback', t => {
  const f = fixture(t);
  f.run();
  for (const value of ['', 'hard', 'FUN', '__proto__', null, {}, ['fun']]) {
    assert.throws(() => f.service.submit('run-1', 'buyer', value as FeedbackChoice), /choice/i);
  }
  assert.deepEqual(f.db.all('feedback'), []);
});

test('counts are edition-scoped; feedback has no run or economic effects', t => {
  const f = fixture(t);
  const first = f.run();
  const second = f.run('run-2', 'died', 'edition-2');
  f.service.submit('run-1', 'buyer', 'too-hard');
  f.service.submit('run-1', 'buyer', 'too-hard');
  f.service.submit('run-2', 'buyer', 'confusing');
  assert.deepEqual(f.service.counts('edition-1'), {fun: 0, confusing: 0, 'too-hard': 1});
  assert.deepEqual(f.service.counts('edition-2'), {fun: 0, confusing: 1, 'too-hard': 0});
  assert.deepEqual(f.service.counts('missing'), {fun: 0, confusing: 0, 'too-hard': 0});
  assert.deepEqual(f.db.all('run'), [first, second]);
  assert.deepEqual(f.db.operations(), []);
  assert.deepEqual(f.db.sql.prepare('SELECT DISTINCT kind FROM records ORDER BY kind').all().map(row => row.kind), ['feedback', 'run']);
});
