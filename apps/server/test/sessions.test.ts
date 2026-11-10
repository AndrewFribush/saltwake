import assert from 'node:assert/strict';
import test from 'node:test';
import { DemoSessions, SessionError } from '../src/auth';

const cookie = (value: {setCookie: string}) => value.setCookie.split(';')[0];
const fails = (code: string) => (error: unknown) => error instanceof SessionError && error.code === code;

test('independent sessions get random cookies and exclusive server-assigned profiles', () => {
  const store = new DemoSessions({profiles: ['maker', 'player']});
  const a = store.create(), b = store.create();
  assert.notEqual(cookie(a), cookie(b));
  assert.match(cookie(a), /^dungeon_session=[A-Za-z0-9_-]{43}$/);
  assert.equal(store.requireProfile(cookie(a)), 'maker');
  assert.equal(store.requireProfile(cookie(b)), 'player');
  assert.match(a.setCookie, /HttpOnly; SameSite=Strict/);
  assert.match(a.setCookie, /Secure/);
  assert.throws(() => store.claim(cookie(b), 'maker'), fails('PROFILE_IN_USE'));
  assert.equal(store.requireProfile(cookie(b)), 'player');
  assert.throws(() => store.create(), fails('NO_PROFILE_AVAILABLE'));
});

test('spoofed actor fields cannot authorize commands or access another owner', () => {
  const store = new DemoSessions({profiles: ['maker', 'player']});
  const a = cookie(store.create()), b = cookie(store.create());
  const request = {actor: 'maker', profileId: 'maker', action: {type: 'debit' as const, amount: '1'}};
  assert.deepEqual(store.bindCommand(b, request.action), {actor: 'player', action: request.action});
  assert.throws(() => store.assertOwner(b, 'maker'), fails('FORBIDDEN'));
  store.assertOwner(a, 'maker');
  for (const forged of [undefined, 'actor=maker', 'dungeon_session=maker', `dungeon_session=${'x'.repeat(43)}`, `${a}; ${b}`]) {
    assert.throws(() => store.requireProfile(forged), fails('UNAUTHENTICATED'));
  }
  assert.throws(() => store.claim(b, 'operator'), fails('UNKNOWN_PROFILE'));
  const view = store.get(b);
  assert.throws(() => { (view as {profileId: string}).profileId = 'maker'; });
  assert.equal(store.requireProfile(b), 'player');
});

test('release permits an exclusive claim and logout invalidates the token', () => {
  const store = new DemoSessions({profiles: ['maker', 'player']});
  const a = cookie(store.create()), b = cookie(store.create());
  store.release(a);
  assert.throws(() => store.requireProfile(a), fails('PROFILE_REQUIRED'));
  assert.equal(store.claim(b, 'maker').profileId, 'maker');
  assert.equal(store.claim(b, 'maker').profileId, 'maker');
  assert.equal(store.claim(a, 'player').profileId, 'player');
  assert.match(store.destroy(b), /Max-Age=0/);
  assert.throws(() => store.requireProfile(b), fails('UNAUTHENTICATED'));
  assert.equal(store.create().session.profileId, 'maker');
});

test('expiration is absolute, enforced at the boundary and releases claims', () => {
  let now = 1_000;
  const store = new DemoSessions({profiles: ['maker', 'player'], ttlMs: 1_000, now: () => now});
  const a = cookie(store.create());
  now = 1_500;
  const b = cookie(store.create());
  now = 1_999;
  assert.equal(store.get(a).expiresAtMs, 2_000);
  now = 2_000;
  assert.throws(() => store.bindCommand(a, {type: 'debit', amount: '1'}), fails('UNAUTHENTICATED'));
  assert.equal(store.claim(b, 'maker').profileId, 'maker');
  now = 2_500;
  assert.equal(store.create().session.profileId, 'maker');
  assert.throws(() => store.claim(b, 'player'), fails('UNAUTHENTICATED'));
});

test('session capacity is bounded even when clients release profiles', () => {
  const store = new DemoSessions({profiles: ['maker'], maxSessions: 1, secureCookies: false});
  const created = store.create();
  assert.doesNotMatch(created.setCookie, /Secure/);
  store.release(cookie(created));
  assert.throws(() => store.create(), fails('SESSION_CAPACITY'));
  store.destroy(cookie(created));
  assert.equal(store.create().session.profileId, 'maker');
});
