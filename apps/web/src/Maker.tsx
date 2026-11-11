import {randomPoolSelection,replenishmentAction} from '../../../packages/shared/src/replenishment';
import type {EditionCostReport} from '../../../packages/shared/src/cost-ledger';
import {Pages,Reading} from './GamePanels';
import React, {useRef, useState} from 'react';
import type {Command, EditionTerms, Item, RandomTable} from '../../../packages/shared/src/types';
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
  randomTables?:RandomTable[];id: string; maker: string; terms: EditionTerms; fee: string;
  costs?:EditionCostReport;
  version: string; closed: boolean; active: number;placementPaid?:string;settledRevenue?:number;pendingFees?:number;completedRuns?:number;feedback?:Record<string,number>;
};

/** Parent supplies the authenticated command wrapper and current world snapshot. */
export function Maker({world, busy, selected, command, refresh,onBusyChange}: MakerProps) {
  const [view,setView]=useState('Manage');
  const [pools,setPools]=useState<Record<string,string>>({});
  const [fees, setFees] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const [working, setWorking] = useState(false);
  const inflight = useRef(false);
  const editions = (world.editions as EditionView[]).filter(e => e.maker === world.profile);
  const items = world.items as Item[];
  const ids = [...new Set(selected)];
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
<label>Edition view <select value={view} onChange={e=>setView(e.target.value)}><option>Manage</option><option>Stock</option><option>Results</option><option>Accounts</option><option>Account rules</option></select></label>
    {(view==='Manage'||view==='Stock')&&<p>{ids.length} selected goods · unused stock goes to bank at closure.</p>}
    <button type="button" disabled={busy || working} onClick={() => void execute()}>Refresh maker view</button>
    <Reading text={notice || (working ? 'Waiting for confirmation…' : unresolved ? 'An operation is unresolved. Refresh before submitting another.' : '')}/>
    {!editions.length && <p>You have no editions to manage.</p>}
    <Pages items={editions} label="Your editions" render={edition => {
      const cutoff = Number(edition.terms.closes_at_ms);
      const pastCutoff = Number.isFinite(cutoff) && Date.now() >= cutoff;
      const open = !edition.closed && Number.isFinite(cutoff) && !pastCutoff;
      const fee = fees[edition.id] ?? edition.fee;
      const validFee = /^\d{1,7}$/.test(fee) && Number(fee) <= 1_000_000;
      const pool=pools[edition.id]??'fixed';
      const fundingAction=replenishmentAction(edition,pool,ids,items,world.profile);
      return <article key={edition.id}>
        <h3>{edition.terms.title}</h3>
        {view!=='Accounts'&&view!=='Account rules'&&<p>{edition.id} · Version {edition.version} · Entry {edition.fee} credits · {edition.active} active runs</p>}
        {view==='Accounts'&&<>{edition.costs?<><p>Settled fees {edition.costs.settledFees} · Pending {edition.costs.pendingFees} coins.</p><p>Placement {edition.costs.placementCost} · Known treasure cost {edition.costs.knownTreasureCost} · {edition.costs.unknownTreasureItems} goods with unknown cost.</p><p>Recorded contribution: {edition.costs.contribution===null?'Unknown':edition.costs.contribution+' coins'}. See Account rules for coverage.</p></>:<p>Cost observations unavailable.</p>}</>}
        {view==='Account rules'&&<Reading limit={150} text="Contribution is settled fees minus placement and all committed treasure costs. Pending fees are not income. Unknown treasure costs make contribution unknown. Closure leftovers go to the bank; they are never refunded. This excludes your time and external costs. Old funding is unknown until supported by an observation; catalog values are not purchase costs."/>}
        {view==='Results'&&<><p>Settled entry fees: {edition.settledRevenue??0} · Pending fee escrow: {edition.pendingFees??0} · Placement paid: {edition.placementPaid??'unknown'} · Finished attempts: {edition.completedRuns??0}. These figures exclude the acquisition cost of funded goods and are not net profit.</p><p>Player feedback: {Object.entries(edition.feedback??{}).map(([choice,n])=>`${choice}: ${n}`).join(' · ')||'None'}</p></>}
        {view!=='Accounts'&&view!=='Account rules'&&<p>{edition.closed ? 'Closed' : pastCutoff ? 'Cutoff reached' : 'Accepting changes'} · Cutoff {Number.isFinite(cutoff) ? new Date(cutoff).toLocaleString() : 'unavailable'}</p>}
        {view==='Manage'&&<><label>New entry fee (0–1,000,000 credits) <input type="number" min="0" max="1000000" step="1"
          value={fee} disabled={disabled || !open}
          onChange={event => setFees(previous => ({...previous, [edition.id]: event.target.value}))} /></label>{' '}
        <button type="button" disabled={disabled || !open || !validFee}
          onClick={() => void execute({type: 'set_fee', edition_id: edition.id, new_fee: String(Number(fee))})}>Set entry fee</button>
        <p>Closure is available after cutoff when all active runs have settled. Unused funding is not returned to you.</p>
        <button type="button" disabled={disabled || edition.closed || !pastCutoff || edition.active !== 0}
          onClick={() => void execute({type: 'finalize_close', edition_id: edition.id})}>Finalize closure · send unused stock to bank</button></>}
        {view==='Stock'&&<><label>Replenish pool <select aria-label="Replenish pool" value={pool} disabled={disabled} onChange={e=>setPools(p=>({...p,[edition.id]:e.target.value}))}><option value="fixed">Fixed rewards</option>{(edition.randomTables??[]).map(t=><option key={t.table_id} value={randomPoolSelection(t.table_id)}>Random · {t.table_id} ({t.socket_ids.length} draws / attempt)</option>)}</select></label><p>{pool==='fixed'?`Fixed types: ${[...new Set(edition.terms.sockets.flatMap(s=>s.reward?[catalog[s.reward].name]:[]))].join(', ')||'None'}`:'Random pool accepts any owned item type. Each physical good is one draw candidate.'}</p><button type="button" disabled={disabled||!open||!fundingAction} onClick={()=>{if(fundingAction)void execute(fundingAction);}}>Fund with {ids.length} selected items</button>{!fundingAction&&ids.length>0&&<p>Choose 1–128 owned goods compatible with this pool.</p>}<p>Use Choose stored goods to select inventory. Refresh adds stock; it never reallocates goods reserved for active runs.</p></>}
      </article>;
    }}/>
  </section>;
}
