/** Edition history, not a prediction or a cash return. */
export type EditionRecord = {
  attempts: number; completed: number; active: number; voided: number;
  extracted: number; died: number; abandoned: number; expired: number;
  participants: number;
  lootSamples: number; averageLoot: number | null; medianLoot: number | null;
  durationSamples: number; averageSeconds: number | null; medianSeconds: number | null;
  /** Up to five most recent confirmed outcomes, newest first. Outcome and time only: no players. */
  recent?: {outcome: 'extracted'|'died'|'abandoned'|'expired'; finishedAtMs: number|null}[];
};
