Producing the P13a cost-provenance design pass now: schema, worked examples, gap analysis, TS interfaces, and 8 acceptance cases, no tools or edits.

# P13a Cost Provenance Design

## 1. Principles

Three quantities stay in separate tables and are never summed together:

- **Cash flow** is the signed change in a profile's credits caused by one Applied receipt.
- **Reference value** is `item_type.value()` from `bank_prices`. It is computed at report time and never stored in a lot.
- **Cost basis** is what a profile actually gave up to acquire a specific item id. It is either a decimal string or `null` for "unknown". Unknown is never replaced with zero or with reference value.

Profit exists only on disposal with proceeds. Each lot's cost leaves the ledger exactly once: matched against proceeds, transferred into craft outputs, or written off as an expense. This is the no-double-count rule.

Economic rules are untouched. Cost allocation policies below are reporting choices on top of contract behaviour.

## 2. Derivation source and ordering

The ledger is a pure function of the `operations` table: for each row with `status==='Applied'`, the stored `command` plus `receipt`. Pending and Unknown rows never produce ledger entries. Order is `rowid`, which equals chain application order because the Outbox serializes one signer stream and refuses to let higher nonces overtake.

Ledger rows are keyed `${op_id}:${seq}`. Writing them happens inside the same `db.transaction` that flips the row to Applied. Rebuild deletes every derived row and replays. Replaying an already-recorded op is a no-op by key. A `digest()` over all rows lets a restart assert the rebuilt ledger equals the pre-restart ledger.

## 3. Per-command treatment

| Command | Cash entries | Lot effect |
|---|---|---|
| `debit` | +amount to actor, kind `grant` | none |
| `buy` | buyer −n·price `purchase`; seller +n·price `sale` | buyer opens lots, basis `buy`, cost = price each; seller's lots close, disposal `sale`, proceeds price |
| `bank_buy` | actor −Σprices; bank +Σ | lots open, basis `bank_buy`, cost = each price |
| `bank_sell` | actor +Σ; bank −Σ | lots close, disposal `bank_sell`, proceeds each price |
| `fill_npc_order` | actor +n·price | lots close, disposal `npc_fill` |
| `list`/`cancel_listing`/`set_fee` | none | none; location only |
| `begin_craft` | none | inputs marked `in_batch`, cost retained |
| `finish_craft` | +wage_reserved on recovery only | inputs close `craft_input`; outputs `crafted-{batch}-0/1` open, basis `craft`, cost = Σinput cost ÷ 2 |
| `begin/finish_recovery` | +wage to actor | inputs are bank-owned; outputs land in bank, basis `recovery_output`, cost null, owner `bank`. No profile lot. |
| `publish`/`publish_random`/`refresh` | maker −placement (see gap 1) | funded lots close, disposal `funded`, expense = cost. Maker pays all committed treasure; no refund, so this is final. |
| `admit` | player −fee `run_fee_escrow` | none |
| `settle`/`void` | fee resolved per contract outcome (see gap 2) | `dungeon_extracted` ids open lots for player, basis `extract`; `town_consumed`, `town_forfeited`, `dungeon_consumed` close player lots as expense; `town_returned` no change; `dungeon_returned` no lot |
| `finalize_close` | none for profiles; leftovers to bank | edition items remaining move to bank, basis `unknown` to bank |

**Extract allocation policy.** The run fee is a cash outflow regardless of outcome. For extracted items the fee is allocated pro rata by reference value at settle time and stored as the lot cost, with `allocation:'fee_prorata'` recorded so reports can also show the fee as a run-level expense. If nothing is extracted the fee is a pure expense. This is a reporting policy, not a rule change, and is switchable to `'zero'` per lot.

**Craft allocation.** Both outputs get half of Σinput cost. If any input is `null`, output cost is `null` and `known_cost` carries the known portion. Tier does not change cost; fine tonic simply has a higher reference value.

## 4. Worked examples

**Buy then resell.** P1 `bank_buy` herb at 4. Lot `herb-7`: basis `bank_buy`, cost 4. P1 lists at 9. P2 `buy` 1 unit. P1 lot closes, proceeds 9, realized profit 5. P2 lot opens, basis `buy`, cost 9. Cash: P1 −4, +9; P2 −9; bank +4. Reference value of the herb is unchanged throughout.

**Craft.** P1 holds herbs at 4 and 4, flasks at 3 and `null` (seed gift). `finish_craft` tier fine. Inputs close as `craft_input`. Outputs `crafted-b1-0/1`: cost `null`, `known_cost` 5.5 each, `unknown_inputs` 1. Selling one at 12 reports proceeds 12, profit "≥6.5, unknown basis". Never 12.

**Funding.** Maker funds an edition with a sword bought at 20 and a club of unknown basis. Both lots close `funded`: expense 20 plus one unknown. The maker's later fee income is cash flow, not profit against these lots, because the contract gives no refund.

**Extract.** P2 pays fee 10, extracts a tonic (ref 8) and a club (ref 4). Lots: tonic cost 6.67, club 3.33, basis `extract`, allocation `fee_prorata`. Items consumed in the dungeon close with no cost because they were not acquired by P2; items from the loadout consumed close as expense at their own cost.

## 5. Are current receipts sufficient?

Mostly yes, with three gaps. Every item id, actual price, and outcome partition needed above is in the stored `command`, and the contract's `StalePrice` checks guarantee `expected_*` equals the real price. Output ids of crafts are deterministic.

1. **Placement cost on publish/refresh** is not in the command or receipt. It lives in `EconomicEdition.placement_paid`. Capture it at acceptance time by reading the edition record for `receipt.result` and storing a `CostEnrichment` keyed by `op_id` in `records` kind `cost_enrich`. On rebuild, a missing enrichment yields a cash entry with `amount:null, reason:'unenriched'`, not a guess.
2. **Fee routing at settle/void** depends on contract outcome rules not visible in the provided source. The ledger uses a `feeRoute(outcome)` table that mirrors the contract. The stated rule is captured: fee on normal loss is retained by the maker. Unmirrored outcomes produce `null` amounts flagged `unrouted`.
3. **Opening state.** Items owned and credits held before the first operation, seed grants, and listings created outside this outbox have no receipt. On first ledger build, snapshot current ownership and credits as `opening_balance` entries with basis `unknown`, cost `null`, and `observed_at_op` equal to the latest rowid. Historical cost is never invented.

## 6. Minimal TS interfaces

```ts
export type Basis='buy'|'bank_buy'|'craft'|'extract'|'recovery_output'|'unknown';
export type Disposal='sale'|'bank_sell'|'npc_fill'|'craft_input'|'funded'|'consumed'|'forfeited'|'to_bank';
export interface CostLot{
 item_id:string;item_type:ItemType;owner:string;
 acquired_op:string;basis:Basis;cost:string|null;known_cost:string;unknown_inputs:number;
 allocation:'direct'|'craft_half'|'fee_prorata'|'zero'|'none';parents:string[];
 disposed_op:string|null;disposal:Disposal|null;proceeds:string|null;
}
export interface CashEntry{
 key:string;op_id:string;seq:number;profile:string;
 delta:string|null;kind:'grant'|'purchase'|'sale'|'bank_buy'|'bank_sell'|'npc_fill'|'wage'|'placement'|'run_fee_escrow'|'run_fee_route'|'opening_balance';
 ref:string;reason?:'unenriched'|'unrouted';
}
export interface CostEnrichment{op_id:string;placement_paid?:string;fee_route?:{payee:string;amount:string}[]}
export interface CostLedger{
 applyApplied(row:StoredOperation,enrich?:CostEnrichment):void;
 rebuild(rows:StoredOperation[],enrich:Map<string,CostEnrichment>,opening:EconomySnapshot|null):void;
 digest():string;
 profit(profile:string):{realized:string;unknown_lots:number;cash_net:string};
}
```

Storage: three `records` kinds, `cost_lot` keyed by item id, `cash_entry` keyed by `key`, `cost_enrich` keyed by op id.

## 7. Acceptance cases

1. **Idempotent apply.** Calling `applyApplied` twice with the same Applied row produces identical row counts and digest.
2. **Pending never writes.** A row with `status:'Pending'` or `'Unknown'` produces zero ledger rows; after it becomes Applied, rows appear once.
3. **Rebuild equals live.** After 20 mixed ops, `digest()` before shutdown equals `digest()` after `rebuild` from the operations table.
4. **Resale profit.** `bank_buy` at 4 then `buy` by another profile at 9 yields seller realized profit 5, buyer lot cost 9, and no lot with cost 4 still open.
5. **Craft with unknown input.** Three inputs with cost and one `null` yield two outputs with `cost:null`, `known_cost` equal to half the known sum, `unknown_inputs:1`, and four inputs closed `craft_input`.
6. **Funding is final.** Funding two lots then receiving fees from settled runs leaves both lots `disposal:'funded'` and the maker's `realized` profit unchanged by the fees; fees appear only as `run_fee_route` cash entries.
7. **Extract allocation.** Fee 10 and extracted items with reference 8 and 4 yield lot costs summing to exactly 10 and `allocation:'fee_prorata'`; with no extraction, no lot opens and the fee stays as cash outflow.
8. **No invented history.** Opening snapshot with 3 owned items and credits 50 yields 3 lots with `basis:'unknown'`, `cost:null`, one `opening_balance` entry of 50, and a publish op with no enrichment yields a `placement` entry with `delta:null, reason:'unenriched'`.

Recap: the ledger derives entirely from Applied operation rows in rowid order, keyed by op id for idempotent apply and deterministic rebuild. Existing receipts carry every item id and real price except placement cost and settle fee routing, which are captured by a per-op enrichment record at acceptance time rather than guessed. Unknown-origin items and opening balances stay explicitly unknown. Next step is the implementation pass against the 8 cases above.