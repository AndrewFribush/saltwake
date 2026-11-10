import React, {useRef, useState} from 'react';
import type {Command, EditionTerms, Item} from '../../../packages/shared/src/types';
import {catalog} from '../../../packages/shared/src/catalog';

export type MakerProps = {
  onBusyChange?: (busy:boolean)=>void;
  world: any;
  busy: boolean;
  selected: string[];
  command: (action: any) => Promise<void>;
  refresh: () => Promise<void>;
};
type EditionView = {
  id: string; maker: string; terms: EditionTerms; fee: string;
  version: string; closed: boolean; active: number;placementPaid?:string;settledRevenue?:number;pendingFees?:number;completedRuns?:number;feedback?:Record<string,number>;
};

/** Parent supplies the authenticated command wrapper and current world snapshot. */
export function Maker({world, busy, selected, command, refresh,onBusyChange}: MakerProps) {
  const [fees, setFees] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const [working, setWorking] = useState(false);
  const inflight = useRef(false);
  const editions = (world.editions as EditionView[]).filter(e => e.maker === world.profile);
  const items = world.items as Item[];
  const ids = [...new Set(selected)];
  const owned = ids.map(id => items.find(item => item.id === id &&
    item.location.kind === 'owned' && item.location.profile === world.profile));
  const validSelection = ids.length > 0 && ids.length <= 128 && owned.every(Boolean);
  const unresolved = (world.operations ?? []).some((op: {status: string}) =>
    op.status === 'Pending' || op.status === 'Unknown');
  const disabled = busy || working || unresolved;
  const execute = async (action?: Command['action']) => {
    if (busy || inflight.current || (action && unresolved)) return;
    inflight.current = true;
    setWorking(true);onBusyChange?.(true);
    setNotice('');
    try {
      if (action) await command(action);
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      inflight.current = false;
      setWorking(false);onBusyChange?.(false);
    }
  };

  return <section aria-label="Manage your dungeon editions">
    <h2>Maker · Your editions</h2>
    <p>Funding transfers the selected town items into an edition. This panel adds only fixed rewards.
      Fee changes apply to future admissions. Final closure sends unused stock to the bank.</p>
    <button type="button" disabled={busy || working} onClick={() => void execute()}>Refresh maker view</button>
    <p role="status">{notice || (working ? 'Waiting for confirmation…' : unresolved ? 'An operation is unresolved. Refresh before submitting another.' : '')}</p>
    <p>Selected funding: {ids.length ? ids.map(id => {
      const item = items.find(i => i.id === id);
      return `${item ? catalog[item.item_type].name : 'Unavailable item'} (${id})`;
    }).join(', ') : 'Select owned items in town.'}</p>
    {!editions.length && <p>You have no editions to manage.</p>}
    {editions.map(edition => {
      const cutoff = Number(edition.terms.closes_at_ms);
      const pastCutoff = Number.isFinite(cutoff) && Date.now() >= cutoff;
      const open = !edition.closed && Number.isFinite(cutoff) && !pastCutoff;
      const fee = fees[edition.id] ?? edition.fee;
      const validFee = /^\d{1,7}$/.test(fee) && Number(fee) <= 1_000_000;
      const compatible = validSelection && owned.every(item => item &&
        edition.terms.sockets.some(socket => socket.reward === item.item_type));
      return <article key={edition.id}>
        <h3>{edition.terms.title}</h3>
        <p>{edition.id} · Version {edition.version} · Entry {edition.fee} credits · {edition.active} active runs</p>
        <p>Settled entry fees: {edition.settledRevenue??0} · Pending fee escrow: {edition.pendingFees??0} · Placement paid: {edition.placementPaid??'unknown'} · Finished attempts: {edition.completedRuns??0}. These figures exclude the acquisition cost of funded goods and are not net profit.</p><p>Player feedback: {Object.entries(edition.feedback??{}).map(([choice,n])=>`${choice}: ${n}`).join(' · ')||'None'}</p>
        <p>{edition.closed ? 'Closed' : pastCutoff ? 'Cutoff reached' : 'Accepting changes'} · Cutoff {Number.isFinite(cutoff) ? new Date(cutoff).toLocaleString() : 'unavailable'}</p>
        <label>New entry fee (0–1,000,000 credits) <input type="number" min="0" max="1000000" step="1"
          value={fee} disabled={disabled || !open}
          onChange={event => setFees(previous => ({...previous, [edition.id]: event.target.value}))} /></label>{' '}
        <button type="button" disabled={disabled || !open || !validFee}
          onClick={() => void execute({type: 'set_fee', edition_id: edition.id, new_fee: String(Number(fee))})}>Set entry fee</button>
        <p>Fixed reward types: {[...new Set(edition.terms.sockets.flatMap(socket => socket.reward ? [catalog[socket.reward].name] : []))].join(', ') || 'None'}.</p>
        <button type="button" disabled={disabled || !open || !compatible}
          onClick={() => void execute({type: 'refresh', edition_id: edition.id, fixed_funding: ids, random_funding: []})}>Fund with {ids.length} selected items</button>
        {!compatible && ids.length > 0 && <p>Select 1–128 available owned items matching this edition’s fixed reward types.</p>}
        <p>Closure is available after cutoff when all active runs have settled. Unused funding is not returned to you.</p>
        <button type="button" disabled={disabled || edition.closed || !pastCutoff || edition.active !== 0}
          onClick={() => void execute({type: 'finalize_close', edition_id: edition.id})}>Finalize closure · send unused stock to bank</button>
      </article>;
    })}
  </section>;
}
