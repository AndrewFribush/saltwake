import React, {useEffect, useRef, useState} from 'react';
import {
  CRAFT_STEP_MS, CRAFT_STEPS, CRAFT_TARGET,
  createCraftPractice, recordCraftInput, restartCraftPractice,
} from '../../../packages/game/src/craft';

/** Standalone local practice; deliberately accepts no inventory or authority callbacks. */
export function Workbench() {
  const [batch, setBatch] = useState(createCraftPractice);
  const [clock, setClock] = useState<{attempt: number; step: number; startedAt: number} | null>(null);
  const active = useRef<typeof clock>(null);
  const [elapsed, setElapsed] = useState(0);
  const mixButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!clock) return;
    let frame = 0;
    const tick = () => {
      if (active.current !== clock) return;
      const ms = Math.min(CRAFT_STEP_MS, performance.now() - clock.startedAt);
      setElapsed(ms);
      if (ms < CRAFT_STEP_MS) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [clock]);

  const start = () => {
    if (active.current || batch.tier) return;
    const next = {attempt: batch.attempt, step: batch.inputs.length, startedAt: performance.now()};
    active.current = next;
    setElapsed(0);
    setClock(next);
    // Focus after React enables the native keyboard-accessible button.
  };
  useEffect(() => { if (clock) mixButton.current?.focus(); }, [clock]);

  const mix = () => {
    const current = active.current;
    if (!current) return;
    const elapsedMs = performance.now() - current.startedAt;
    active.current = null;
    setClock(null);
    setElapsed(Math.min(elapsedMs, CRAFT_STEP_MS));
    setBatch(previous => recordCraftInput(previous, {...current, elapsedMs}));
  };
  const restart = () => {
    active.current = null;
    setClock(null);
    setElapsed(0);
    setBatch(restartCraftPractice);
  };
  const hit = (ms: number) => ms >= CRAFT_TARGET.startMs && ms <= CRAFT_TARGET.endMs;
  const percent = (ms: number) => `${ms / CRAFT_STEP_MS * 100}%`;

  return <section aria-label="Alchemy crafting practice">
    <h2>Alchemy workbench · Local practice</h2>
    <p>No herbs or flasks are spent. No tonics, credits, or inventory changes are awarded.
      This challenge is not bound to an authoritative paid batch.</p>
    <p>Recipe preview: 2 herbs + 2 flasks → 2 tonics. Land all three inputs in the target
      band for fine quality; any miss gives normal quality. Practice restarts are free.</p>
    <p>Start each step, then press Mix once as the marker enters the outlined band
      ({CRAFT_TARGET.startMs / 1000}–{CRAFT_TARGET.endMs / 1000} seconds).
      You can click Mix or use Enter/Space on its focused button. Each sweep lasts seven seconds;
      a late input counts as a miss. Aim for about 15–25 seconds per batch.</p>
    <p>Practice attempt {batch.attempt} · {batch.inputs.length}/{CRAFT_STEPS} inputs recorded</p>
    <div aria-hidden="true" style={{position: 'relative', height: 44, margin: '16px 0',
      border: '1px solid currentColor', borderRadius: 6, overflow: 'hidden'}}>
      <div style={{position: 'absolute', top: 0, bottom: 0,
        left: percent(CRAFT_TARGET.startMs), width: percent(CRAFT_TARGET.endMs - CRAFT_TARGET.startMs),
        background: '#337d54', border: '2px dashed white', boxSizing: 'border-box'}} />
      <div style={{position: 'absolute', top: 0, bottom: 0, width: 4,
        left: `calc(${percent(elapsed)} - ${elapsed / CRAFT_STEP_MS * 4}px)`, background: 'currentColor'}} />
    </div>
    <p>{clock ? elapsed >= CRAFT_STEP_MS ? 'Too late — press Mix to record this miss.' : 'Mixing…'
      : batch.tier ? 'Batch complete.' : `Ready for step ${batch.inputs.length + 1}.`}</p>
    <button type="button" disabled={!!clock || !!batch.tier} onClick={start}>Start step {Math.min(batch.inputs.length + 1, CRAFT_STEPS)}</button>{' '}
    <button type="button" ref={mixButton} disabled={!clock} onClick={mix}
      onKeyDown={event => { if (event.repeat) event.preventDefault(); }}>Mix</button>{' '}
    <button type="button" onClick={restart}>Restart practice batch</button>
    <div role="status" aria-live="polite">
      {batch.inputs.length > 0 && <p>Step {batch.inputs.length}: {hit(batch.inputs[batch.inputs.length - 1]) ? 'target hit' : 'miss'}.</p>}
      {batch.tier && <p><strong>Practice result: {batch.tier}</strong> — preview of 2 {batch.tier} tonics. No items created.</p>}
    </div>
    <ol aria-label="Recorded practice timings">
      {batch.inputs.map((ms, index) => <li key={index}>Step {index + 1}: {Math.round(ms)} ms — {hit(ms) ? 'hit' : 'miss'}{ms === CRAFT_STEP_MS ? ' (end of sweep or later)' : ''}</li>)}
    </ol>
  </section>;
}
