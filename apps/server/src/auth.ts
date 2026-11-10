import { randomBytes } from 'node:crypto';
import type { Command } from '../../../packages/shared/src/types';

export const DEMO_CUSTODY_LABEL = 'Demo custody: the operator controls these profiles. This is not wallet authentication.';
export const SESSION_COOKIE_NAME = 'dungeon_session';
export type SessionView = Readonly<{profileId: string | null; expiresAtMs: number}>;
export type SessionErrorCode = 'UNAUTHENTICATED' | 'PROFILE_REQUIRED' | 'FORBIDDEN' | 'UNKNOWN_PROFILE' | 'PROFILE_IN_USE' | 'NO_PROFILE_AVAILABLE' | 'SESSION_CAPACITY';
export class SessionError extends Error {
  readonly status: number;
  constructor(readonly code: SessionErrorCode) {
    super(code);
    this.name = 'SessionError';
    this.status = code === 'UNAUTHENTICATED' ? 401
      : code === 'FORBIDDEN' || code === 'PROFILE_REQUIRED' ? 403
      : code === 'UNKNOWN_PROFILE' ? 400
      : code === 'SESSION_CAPACITY' ? 503 : 409;
  }
}
export interface DemoSessionOptions {
  /** Server-configured, initialized demo profiles; never populate from request data. */
  profiles: readonly string[];
  ttlMs?: number;
  maxSessions?: number;
  /** Set false only for local HTTP development. */
  secureCookies?: boolean;
  now?: () => number;
}
type RecordValue = {profileId: string | null; expiresAtMs: number};

/** Single-process custody leases. Restart invalidates all cookies. Share one instance
 * across routes; multiple workers need a shared atomic store before use.
 * HTTP integration must enforce same-origin mutations and validate action payloads.
 * Pass only validated action data to bindCommand, never spread a request actor over it.
 */
export class DemoSessions {
  readonly #sessions = new Map<string, RecordValue>();
  readonly #claims = new Map<string, string>();
  readonly #profiles: readonly string[];
  readonly #ttlMs: number;
  readonly #maxSessions: number;
  readonly #secure: boolean;
  readonly #now: () => number;

  constructor(options: DemoSessionOptions) {
    if (!options.profiles.length || options.profiles.some(p => typeof p !== 'string' || !p.trim())
      || new Set(options.profiles).size !== options.profiles.length) throw new Error('Unique nonempty demo profiles required');
    this.#profiles = [...options.profiles];
    this.#ttlMs = options.ttlMs ?? 30 * 60 * 1_000;
    this.#maxSessions = options.maxSessions ?? 1_000;
    if (!Number.isSafeInteger(this.#ttlMs) || this.#ttlMs < 1_000
      || !Number.isSafeInteger(this.#maxSessions) || this.#maxSessions < 1) throw new Error('Invalid session limits');
    this.#secure = options.secureCookies ?? true;
    this.#now = options.now ?? Date.now;
  }

  create(): {session: SessionView; setCookie: string} {
    const now = this.#now();
    this.#prune(now);
    if (this.#sessions.size >= this.#maxSessions) throw new SessionError('SESSION_CAPACITY');
    const profileId = this.#profiles.find(p => !this.#claims.has(p));
    if (profileId === undefined) throw new SessionError('NO_PROFILE_AVAILABLE');
    let token: string;
    do { token = randomBytes(32).toString('base64url'); } while (this.#sessions.has(token));
    const session = {profileId, expiresAtMs: now + this.#ttlMs};
    this.#sessions.set(token, session);
    this.#claims.set(profileId, token);
    return {session: this.#view(session), setCookie: this.#cookie(token, Math.floor(this.#ttlMs / 1_000))};
  }

  get(cookieHeader: string | undefined): SessionView {
    return this.#view(this.#lookup(cookieHeader).session);
  }

  requireProfile(cookieHeader: string | undefined): string {
    const {profileId} = this.#lookup(cookieHeader).session;
    if (profileId === null) throw new SessionError('PROFILE_REQUIRED');
    return profileId;
  }

  /** ownerProfileId must come from authoritative resource state, not the request. */
  assertOwner(cookieHeader: string | undefined, ownerProfileId: string): void {
    if (this.requireProfile(cookieHeader) !== ownerProfileId) throw new SessionError('FORBIDDEN');
  }

  bindCommand(cookieHeader: string | undefined, action: Command['action']): Command {
    return {actor: this.requireProfile(cookieHeader), action};
  }

  /** Only this explicitly labeled demo-switch endpoint accepts a profile choice. */
  claim(cookieHeader: string | undefined, profileId: string): SessionView {
    const {token, session} = this.#lookup(cookieHeader);
    if (!this.#profiles.includes(profileId)) throw new SessionError('UNKNOWN_PROFILE');
    const holder = this.#claims.get(profileId);
    if (holder !== undefined && holder !== token) throw new SessionError('PROFILE_IN_USE');
    // Check first: a failed switch must preserve the current claim.
    this.#release(session);
    session.profileId = profileId;
    this.#claims.set(profileId, token);
    return this.#view(session);
  }

  release(cookieHeader: string | undefined): SessionView {
    const {session} = this.#lookup(cookieHeader);
    this.#release(session);
    return this.#view(session);
  }

  destroy(cookieHeader: string | undefined): string {
    const {token, session} = this.#lookup(cookieHeader);
    this.#release(session);
    this.#sessions.delete(token);
    return this.#cookie('', 0);
  }

  #lookup(cookieHeader: string | undefined): {token: string; session: RecordValue} {
    this.#prune(this.#now());
    if (typeof cookieHeader !== 'string' || cookieHeader.length > 8_192) throw new SessionError('UNAUTHENTICATED');
    const cookies = cookieHeader.split(';').map(part => part.trim()).filter(part => part.split('=')[0] === SESSION_COOKIE_NAME);
    if (cookies.length !== 1) throw new SessionError('UNAUTHENTICATED');
    const token = cookies[0].slice(SESSION_COOKIE_NAME.length + 1);
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new SessionError('UNAUTHENTICATED');
    const session = this.#sessions.get(token);
    if (!session) throw new SessionError('UNAUTHENTICATED');
    return {token, session};
  }

  #release(session: RecordValue): void {
    if (session.profileId !== null) this.#claims.delete(session.profileId);
    session.profileId = null;
  }

  #prune(now: number): void {
    for (const [token, session] of this.#sessions) {
      if (session.expiresAtMs <= now) {
        this.#release(session);
        this.#sessions.delete(token);
      }
    }
  }

  #view(session: RecordValue): SessionView { return Object.freeze({...session}); }
  #cookie(token: string, maxAge: number): string {
    return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${this.#secure ? '; Secure' : ''}`;
  }
}
