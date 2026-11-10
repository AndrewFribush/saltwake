import {createHash, randomBytes} from 'node:crypto';
import {CRAFT_STEP_MS, CRAFT_TARGET, CRAFT_STEPS} from '../../../packages/game/src/craft';
import type {Command, CraftTier, EconomySnapshot, FinishReason} from '../../../packages/shared/src/types';
import {Store} from './db';
import {Outbox} from './outbox';

export const CRAFT_DEADLINE_MS = 120_000;
export const MAX_CRAFT_REQUESTS = 64;
export type CraftView = {
  id: string; profile: string; recovery: boolean;
  status: 'pending' | 'rejected' | 'active' | 'finishing' | 'finished';
  beginOp: string; finishOp: string | null;
  operationStatus: string; error: string | null;
  seq: number; step: number; startedAtMs: number | null;
  deadlineMs: number; stepMs: number; target: {startMs: number; endMs: number};
  inputs: number[]; tier: CraftTier | null; reason: FinishReason | null; outputIds: string[];
};
type SavedCraft = {
  id: string; profile: string; requestHash: string; inputIds: string[]; recovery: boolean;
  challenge: {nonce: string; stepMs: number; target: {startMs: number; endMs: number}; steps: number};
  commitment: string; deadlineMs: number; beginOp: string; finishOp: string | null;
  confirmed: boolean; finished: boolean; seq: number; startedAtMs: number | null;
  inputs: number[]; tier: CraftTier | null; reason: FinishReason | null; outputIds: string[];
  events: Record<string, {hash: string; view: CraftView}>;
};
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const validId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value);

/** Single Store/Outbox instance; profile always comes from the authenticated session.
 * materialize accepts only an authoritative chain snapshot. No network I/O happens
 * here: the parent processes outbox operations and calls materialize/expire regularly.
 * Clock is server wall time in epoch ms (injectable for tests), never client elapsed time.
 */
export class Craft {
  constructor(readonly db: Store, readonly outbox: Outbox, readonly clock: () => number = Date.now) {}

  begin(profile: string, requestId: string, inputIds: readonly string[], recovery = false): CraftView {
    if (typeof profile !== 'string' || !profile.length || profile.length > 128 || !validId(requestId)
      || typeof recovery !== 'boolean' || !Array.isArray(inputIds) || inputIds.length !== 4
      || inputIds.some(id => typeof id !== 'string' || !id.length || id.length > 128)
      || new Set(inputIds).size !== 4) throw Error('Invalid craft request');
    const id = 'c-' + hash([profile, requestId]).slice(0, 48);
    const requestHash = hash([profile, inputIds, recovery]);
    return this.db.transaction(() => {
      const prior = this.db.get<SavedCraft>('craft', id);
      if (prior) {
        if (prior.requestHash !== requestHash) throw Error('Craft request payload conflict');
        return this.present(prior);
      }
      const records = this.db.all<SavedCraft>('craft');
      if (records.some(r => r.profile === profile && !['rejected', 'finished'].includes(this.present(r).status))) throw Error('Profile has active craft');
      if (records.length >= MAX_CRAFT_REQUESTS) throw Error('Craft storage capacity reached');
      const challenge = {nonce: randomBytes(32).toString('hex'), stepMs: CRAFT_STEP_MS, target: {...CRAFT_TARGET}, steps: CRAFT_STEPS};
      const row: SavedCraft = {
        id, profile, requestHash, inputIds: [...inputIds], recovery, challenge, commitment: hash(challenge),
        deadlineMs: this.now() + CRAFT_DEADLINE_MS, beginOp: 'begin-' + id, finishOp: null,
        confirmed: false, finished: false, seq: 0, startedAtMs: null, inputs: [], tier: null, reason: null, outputIds: [], events: {},
      };
      // Both writes commit before a signer can see the operation; enqueue failure rolls back the challenge.
      this.save(row);
      const common = {batch_id: id, challenge_commitment: row.commitment, deadline_ms: String(row.deadlineMs)};
      const action: Command['action'] = recovery
        ? {type: 'begin_recovery', ...common, bank_input_ids: row.inputIds}
        : {type: 'begin_craft', ...common, input_ids: row.inputIds};
      this.outbox.enqueue(row.beginOp, {actor: profile, action});
      return this.present(row);
    });
  }

  materialize(snapshot: Pick<EconomySnapshot, 'batches'>): void {
    this.db.transaction(() => {
      for (const row of this.db.all<SavedCraft>('craft')) {
        const op = this.db.operation(row.beginOp);
        if (op?.status !== 'Applied') continue;
        const batch = snapshot.batches.find(b => b.id === row.id);
        if (!batch) continue;
        if (batch.actor !== row.profile || batch.recovery !== row.recovery || batch.challenge_commitment !== row.commitment
          || batch.deadline_ms !== String(row.deadlineMs) || hash(batch.input_ids) !== hash(row.inputIds)) throw Error('Confirmed craft batch mismatch');
        row.confirmed = true;
        if (batch.status === 'finished') {
          row.finished = true; row.tier = batch.tier; row.reason = batch.reason; row.outputIds = [...batch.output_ids];
        }
        this.save(row);
      }
    });
  }

  startStep(profile: string, batchId: string, actionId: string, expectedSeq: number, step: number): CraftView {
    return this.event('start', profile, batchId, actionId, expectedSeq, step);
  }

  input(profile: string, batchId: string, actionId: string, expectedSeq: number, step: number): CraftView {
    return this.event('input', profile, batchId, actionId, expectedSeq, step);
  }

  view(profile: string): CraftView | null {
    const row = this.db.all<SavedCraft>('craft').filter(r => r.profile === profile).at(-1);
    return row ? this.present(row) : null;
  }

  expire(): void {
    const now = this.now();
    this.db.transaction(() => {
      for (const row of this.db.all<SavedCraft>('craft')) {
        if (row.confirmed && !row.finished && !row.finishOp && now >= row.deadlineMs) {
          this.finish(row, 'normal', 'expired');
          this.save(row);
        }
      }
    });
  }

  /** Only pass confirmed chain time, never a request timestamp. One bounded retry
   * handles server/chain clock skew without reopening play or changing the outcome. */
  retryExpiry(chainNow: number): void {
    if (!Number.isSafeInteger(chainNow) || chainNow < 0) throw Error('Invalid chain clock');
    this.db.transaction(() => {
      for (const row of this.db.all<SavedCraft>('craft')) {
        if (row.finished || row.reason !== 'expired' || row.finishOp !== 'finish-' + row.id || chainNow < row.deadlineMs) continue;
        const prior = this.db.operation(row.finishOp);
        if (prior?.status !== 'Rejected' || prior.receipt?.status !== 'Rejected' || prior.receipt.result !== 'PrematureExpiry') continue;
        row.finishOp = 'retry-' + row.id;
        this.outbox.enqueue(row.finishOp, prior.command);
        this.save(row);
      }
    });
  }

  private event(kind: 'start' | 'input', profile: string, batchId: string, actionId: string, expectedSeq: number, step: number): CraftView {
    if (!validId(actionId) || !Number.isSafeInteger(expectedSeq) || expectedSeq < 0
      || !Number.isInteger(step) || step < 0 || step >= CRAFT_STEPS) throw Error('Invalid craft event');
    const eventHash = hash([kind, expectedSeq, step]);
    return this.db.transaction(() => {
      const row = this.db.get<SavedCraft>('craft', batchId);
      if (!row || row.profile !== profile) throw Error('Craft owner mismatch');
      // Prefix keys so __proto__/constructor are ordinary persisted keys too.
      const key = 'event:' + actionId;
      const prior = row.events[key];
      if (prior) {
        if (prior.hash !== eventHash) throw Error('Craft action payload conflict');
        return prior.view;
      }
      if (!row.confirmed) throw Error('Craft batch not confirmed');
      if (row.finishOp || row.finished) throw Error('Craft terminal');
      if (expectedSeq !== row.seq || step !== row.inputs.length) throw Error('Stale craft sequence or step');
      if (Object.keys(row.events).length >= CRAFT_STEPS * 2) throw Error('Craft event capacity reached');
      const now = this.now();
      if (now >= row.deadlineMs) this.finish(row, 'normal', 'expired');
      else if (kind === 'start') {
        if (row.startedAtMs !== null) throw Error('Craft step already started');
        row.startedAtMs = now;
      } else {
        if (row.startedAtMs === null) throw Error('Craft step not started');
        if (now < row.startedAtMs) throw Error('Craft server clock moved backwards');
        row.inputs.push(Math.min(now - row.startedAtMs, row.challenge.stepMs));
        row.startedAtMs = null;
        if (row.inputs.length === row.challenge.steps) {
          const tier = row.inputs.every(ms => ms >= row.challenge.target.startMs && ms <= row.challenge.target.endMs) ? 'fine' : 'normal';
          this.finish(row, tier, 'completed');
        }
      }
      row.seq++;
      const view = this.present(row);
      row.events[key] = {hash: eventHash, view};
      this.save(row);
      return view;
    });
  }

  private finish(row: SavedCraft, tier: CraftTier, reason: FinishReason): void {
    if (row.finishOp || row.finished) return;
    row.finishOp = 'finish-' + row.id; row.tier = tier; row.reason = reason;
    this.outbox.enqueue(row.finishOp, {actor: row.profile, action: {
      type: row.recovery ? 'finish_recovery' : 'finish_craft', batch_id: row.id, tier, reason,
    }});
  }

  private present(row: SavedCraft): CraftView {
    const op = this.db.operation(row.finishOp ?? row.beginOp);
    const error = op?.receipt?.status === 'Rejected' ? op.receipt.result : op?.reason ?? null;
    return {
      id: row.id, profile: row.profile, recovery: row.recovery,
      status: row.finished ? 'finished' : row.finishOp ? 'finishing' : op?.status === 'Rejected' ? 'rejected' : row.confirmed ? 'active' : 'pending',
      beginOp: row.beginOp, finishOp: row.finishOp, operationStatus: op?.status ?? 'Pending', error,
      seq: row.seq, step: row.inputs.length, startedAtMs: row.startedAtMs, deadlineMs: row.deadlineMs,
      stepMs: row.challenge.stepMs, target: {...row.challenge.target}, inputs: [...row.inputs],
      tier: row.tier, reason: row.reason, outputIds: [...row.outputIds],
    };
  }

  private save(row: SavedCraft): void {this.db.put('craft', row.id, row);}
  private now(): number {
    const now = this.clock();
    if (!Number.isSafeInteger(now) || now < 0 || now > Number.MAX_SAFE_INTEGER - CRAFT_DEADLINE_MS) throw Error('Invalid server clock');
    return now;
  }
}
