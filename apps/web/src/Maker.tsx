import {randomPoolSelection,replenishmentAction} from '../../../packages/shared/src/replenishment';
import type {EditionCostReport} from '../../../packages/shared/src/cost-ledger';
import {Pages,Reading} from './GamePanels';
import React, {useRef, useState} from 'react';
import type {Command, EditionTerms, Item, RandomTable} from '../../../packages/shared/src/types';
import {catalog} from '../../../packages/shared/src/catalog';

export type MakerProps = {
  onRevise?: (edition: any) => void;
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
  retired?:boolean;runMarks?:{floor:number;x:number;y:number;outcome:string;turn:number;killer?:string}[];record?:import('../../../packages/shared/src/edition-record').EditionRecord;bundles?:number;remainingValue?:number;status?:string;version: string; closed: boolean; active: number;placementPaid?:string;settledRevenue?:number;pendingFees?:number;completedRuns?:number;feedback?:Record<string,number>;
};

/** Parent supplies the authenticated command wrapper and current world snapshot. */
export function Maker({world, busy, selected, command, refresh,onBusyChange,onRevise}: MakerProps) {
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
        <h3>{edition.terms.title}{edition.retired&&!edition.closed?' · retired':''}</h3>
        {view==='Manage'&&<div className="studio-row revise-row">{onRevise&&<button type="button" className="primary" disabled={disabled} onClick={()=>onRevise(edition)}>Revise in the builder</button>}{!edition.closed&&!edition.retired&&<button type="button" disabled={disabled} onClick={()=>void execute({type:'retire',edition_id:edition.id})}>Retire (stop new delvers)</button>}</div>}
        {view==='Manage'&&(()=>{const r=edition.record;return <div className="maker-headline"><p><b>{r?.attempts??0}</b> {r?.attempts===1?'delver has':'delvers have'} entered{r&&r.attempts>0?`: ${r.extracted} escaped, ${r.died} died${r.abandoned?`, ${r.abandoned} gave up`:''}${r.active?`, ${r.active} still inside`:''}`:'.'}</p><p>You earned <b>{edition.settledRevenue??0} coins</b> in entry fees{edition.pendingFees?` (+${edition.pendingFees} held until runs finish)`:''}.</p><p>{edition.status==='open'?`Open · ${edition.bundles??0} funded ${edition.bundles===1?'attempt':'attempts'} left · treasure worth ${edition.remainingValue??0} below.`:edition.closed?'Closed. Leftover treasure went to the bank.':edition.status==='depleted'?'Every funded attempt has been used, so no one can enter. Add treasure under Edition view → Stock to reopen.':edition.status==='retired'?'Retired: no new delvers. Finalize closure below to send unused treasure to the bank.':edition.status==='retiring'?'Retired: no new delvers; waiting for runs still inside.':edition.status==='scheduled'?'Scheduled: opens soon.':`Status: ${edition.status??'unknown'}.`}</p></div>;})()}
        {view!=='Accounts'&&view!=='Account rules'&&<p className="maker-meta">Version {edition.version} · Entry {edition.fee} coins · {edition.active} active {edition.active===1?'run':'runs'}</p>}
        {view==='Accounts'&&<>{edition.costs?<><p>Settled fees {edition.costs.settledFees} · Pending {edition.costs.pendingFees} coins.</p><p>Placement {edition.costs.placementCost} · Known treasure cost {edition.costs.knownTreasureCost} · {edition.costs.unknownTreasureItems} goods with unknown cost.</p><p>Recorded contribution: {edition.costs.contribution===null?'Unknown':edition.costs.contribution+' coins'}. See Account rules for coverage.</p></>:<p>Cost observations unavailable.</p>}</>}
        {view==='Account rules'&&<Reading limit={150} text="Contribution is settled fees minus placement and all committed treasure costs. Pending fees are not income. Unknown treasure costs make contribution unknown. Closure leftovers go to the bank; they are never refunded. This excludes your time and external costs. Old funding is unknown until supported by an observation; catalog values are not purchase costs."/>}
        {view==='Results'&&<><p>Settled entry fees: {edition.settledRevenue??0} · Pending fee escrow: {edition.pendingFees??0} · Placement paid: {edition.placementPaid??'unknown'} · Finished attempts: {edition.completedRuns??0}. These figures exclude the acquisition cost of funded goods and are not net profit.</p><p>Player feedback: {Object.entries(edition.feedback??{}).map(([choice,n])=>`${choice}: ${n}`).join(' · ')||'None'}</p></>}
        {view!=='Accounts'&&view!=='Account rules'&&<p>{edition.closed ? 'Closed' : pastCutoff ? 'Cutoff reached' : 'Accepting changes'} · Cutoff {Number.isFinite(cutoff) ? new Date(cutoff).toLocaleString() : 'unavailable'}</p>}
        {view==='Manage'&&<><label>New entry fee (coins) <input type="number" min="0" max="1000000" step="1"
          value={fee} disabled={disabled || !open}
          onChange={event => setFees(previous => ({...previous, [edition.id]: event.target.value}))} /></label>{' '}
        <button type="button" disabled={disabled || !open || !validFee}
          onClick={() => void execute({type: 'set_fee', edition_id: edition.id, new_fee: String(Number(fee))})}>Set entry fee</button>
        <p>Closure is available after cutoff, or once retired, when all active runs have settled. Unused funding is not returned to you.</p>
        <button type="button" disabled={disabled || edition.closed || (!pastCutoff && !edition.retired) || edition.active !== 0}
          onClick={() => void execute({type: 'finalize_close', edition_id: edition.id})}>Finalize closure · send unused stock to bank</button></>}
        {view==='Stock'&&<><label>Replenish pool <select aria-label="Replenish pool" value={pool} disabled={disabled} onChange={e=>setPools(p=>({...p,[edition.id]:e.target.value}))}><option value="fixed">Fixed rewards</option>{(edition.randomTables??[]).map(t=><option key={t.table_id} value={randomPoolSelection(t.table_id)}>Random · {t.table_id} ({t.socket_ids.length} draws / attempt)</option>)}</select></label><p>{pool==='fixed'?`Fixed types: ${[...new Set(edition.terms.sockets.flatMap(s=>s.reward?[catalog[s.reward].name]:[]))].join(', ')||'None'}`:'Random pool accepts any owned item type. Each physical good is one draw candidate.'}</p><button type="button" disabled={disabled||!open||!fundingAction} onClick={()=>{if(fundingAction)void execute(fundingAction);}}>Fund with {ids.length} selected items</button>{!fundingAction&&ids.length>0&&<p>Choose 1–128 owned goods compatible with this pool.</p>}<p>Use Choose stored goods to select inventory. Refresh adds stock; it never reallocates goods reserved for active runs.</p></>}
      </article>;
    }}/>
  </section>;
}
