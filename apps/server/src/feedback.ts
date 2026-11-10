import {Store} from './db';
import type {SavedRun} from './runs';

export type FeedbackChoice = 'fun' | 'confusing' | 'too-hard';
export type SavedFeedback = {readonly runId: string; readonly profile: string; readonly editionId: string; readonly choice: FeedbackChoice};
export type FeedbackCounts = Record<FeedbackChoice, number>;

export class Feedback {
  constructor(readonly db: Store) {}
  /** Optional feedback only; never enqueues a settlement, payment, or reward. */
  submit(runId: string, profile: string, choice: FeedbackChoice): SavedFeedback {
    if (choice !== 'fun' && choice !== 'confusing' && choice !== 'too-hard') throw Error('Invalid feedback choice');
    return this.db.transaction(() => {
      const run = this.db.get<SavedRun>('run', runId);
      if (!run || run.profile !== profile) throw Error('Run owner mismatch');
      if (!run.terminal) throw Error('Feedback requires a terminal run');
      const prior = this.db.get<SavedFeedback>('feedback', runId);
      if (prior) {
        if (prior.profile !== profile) throw Error('Feedback owner mismatch');
        if (prior.choice !== choice) throw Error('Feedback choice is immutable');
        return prior;
      }
      const row: SavedFeedback = {runId, profile, editionId: run.economic.edition, choice};
      this.db.put('feedback', runId, row);
      return row;
    });
  }
  /** Aggregate only: no respondent identities are exposed to a public endpoint. */
  counts(editionId: string): FeedbackCounts {
    const counts: FeedbackCounts = {fun: 0, confusing: 0, 'too-hard': 0};
    for (const row of this.db.all<SavedFeedback>('feedback')) {
      if (row.editionId === editionId) counts[row.choice]++;
    }
    return counts;
  }
}
