/** Local practice only: no inventory, currency, persistence, or authority binding. */
export const CRAFT_STEP_MS = 7000;
export const CRAFT_TARGET = Object.freeze({startMs: 5150, endMs: 5850});
export const CRAFT_STEPS = 3;
export type CraftTier = 'normal' | 'fine';
export interface CraftPractice {
  readonly attempt: number;
  readonly inputs: readonly number[];
  readonly tier: CraftTier | null;
}
export interface CraftInput {
  readonly attempt: number;
  readonly step: number;
  /** Monotonic elapsed time since this step was explicitly started. */
  readonly elapsedMs: number;
}

export function scoreCraft(inputs: readonly number[]): CraftTier | null {
  if (inputs.length > CRAFT_STEPS || Array.from(inputs).some(ms =>
    !Number.isFinite(ms) || ms < 0 || ms > CRAFT_STEP_MS)) {
    throw new RangeError('Expected up to three finite step timings between 0 and 7000 ms');
  }
  if (inputs.length < CRAFT_STEPS) return null;
  return inputs.every(ms => ms >= CRAFT_TARGET.startMs && ms <= CRAFT_TARGET.endMs)
    ? 'fine' : 'normal';
}

export function createCraftPractice(): CraftPractice {
  return {attempt: 1, inputs: [], tier: null};
}

export function restartCraftPractice(state: CraftPractice): CraftPractice {
  return {attempt: state.attempt + 1, inputs: [], tier: null};
}

export function recordCraftInput(state: CraftPractice, input: CraftInput): CraftPractice {
  if (state.tier !== null || input.attempt !== state.attempt || input.step !== state.inputs.length ||
    !Number.isFinite(input.elapsedMs) || input.elapsedMs < 0) return state;
  const inputs = [...state.inputs, Math.min(input.elapsedMs, CRAFT_STEP_MS)];
  return {...state, inputs, tier: scoreCraft(inputs)};
}
