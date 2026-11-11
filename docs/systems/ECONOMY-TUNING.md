# Economy tuning from the simulated week (2026-11-11)

Method: `npm run simulate -- --days 7 --seed <n> --levers <list>` on a fresh local sandbox with the demonstration town. Bots act through the real API and contract; coins were conserved every day in every run (purses + bank + escrowed fees + wage budget/reserves + NPC order budget, no issuance). One lever was added at a time on seed 2, then baseline vs all levers was repeated on seeds 1 and 3. Simulation, not organic play; small samples (3 delvers, 2 artisans, 2 makers, 7 rounds).

## What the baseline showed

- Delvers go broke by day 3–5: entry fees and tonics cost more than they bring back; their only income is the bank's half-price buyback of finds.
- Coins pool with makers (the proprietor starts with 100 and collects fees) and are not spent back into the town.
- The proprietor's treasure dungeon runs out of complete reward copies by day 2–3 and stays empty.
- Artisans stall after one batch: the bank's finite herbs/flasks are used up by recovery jobs and one batch, while the proprietor's pantry still has ingredients on its shelves that the artisans never look at.

## Levers (all within the fixed rules: no faucets, no new issuance, no contract change)

| Lever | Change | In-game support |
|---|---|---|
| L1 `refresh` | Makers restock a treasure dungeon that has no complete copy left, buying exactly the missing reward goods from players' shelves and calling the existing `refresh` action. | Business ledger → Dungeons shows "Restock needed: one more complete reward copy lacks …" with where to buy. |
| L2 `shelfsource` | Artisans buy missing herbs/flasks from players' shelves when the bank has none. | Market counter says "The bank is out of herbs/flasks; its stock is finite. Look under Player offers." |
| L3 `bankrestock` | If shelves cannot supply a restock, makers buy the reward goods from the bank's stock at catalog price. | Same ledger prompt (bank named as a source). |
| L4 `resale` | Delvers offer spare finds to players at 80 % of catalog value instead of selling to the bank at 50 %. Makers buying them for restocks moves entry fees back to delvers. | Run summary after an escape: "Dungeon makers buy finds like these to restock their treasure…" |

## Results, seed 2 (one lever at a time)

| Metric (7 days) | Baseline | +L1 | +L1+L2 | +L1+L2+L3 | +L1–L4 |
|---|---|---|---|---|---|
| Runs | 15 | 15 | 16 | 16 | 18 |
| Runs/day, last 3 days | 1.0 | 1.0 | 2.0 | 2.0 | 2.67 |
| Player trades | 3 | 4 | 14 | 14 | 17 |
| Batches brewed | 1 | 1 | 2 | 2 | 2 |
| Treasure value taken out | 48 | 42 | 48 | 54 | 84 |
| Unsold items at end | 15 | 14 | 6 | 6 | 8 |
| Delvers' coins at end | 0 | 0 | 5 | 8 | 33 |
| Makers' coins at end | 93 | 87 | 91 | 85 | 59 |
| Days a delver could not afford any dungeon | 3 | 3 | 3 | 3 | 2 |

With L1 alone the proprietor wanted tonics every day and found none on offer: the binding constraint was ingredient supply, which L2 opened. L4 closed the loop: makers' fee income bought delvers' found swords for restocks.

## Repeat on other seeds (baseline → all levers)

| Metric | Seed 1 | Seed 3 |
|---|---|---|
| Player trades | 4 → 14 | 4 → 13 |
| Treasure value taken out | 12 → 60 | 18 → 30 |
| Unsold items at end | 14 → 8 | 14 → 9 |
| Runs/day, last 3 days | 2.0 → 2.33 | 0.67 → 1.67 |
| Delvers' coins at end | 0 → 1 | 0 → 0 |
| Makers' coins at end | 85 → 88 | 88 → 98 |

## Conclusions and what is still open

- Trade volume, treasure circulation and stock turnover improve on every seed; the supply chain (ingredients → tonics → restocks) now works.
- Delver solvency improved strongly on one seed only. On seeds 1 and 3 makers still accumulate coins: the proprietor's starting 100 coins plus fees outweigh what it spends on restocks. The remaining structural issue is maker accumulation, not a missing faucet.
- Candidate next levers (not applied): a cheaper entry tier when delvers are broke (makers already cut fees on zero entries, but only one step a day), and smaller artisan batches (1 herb + 1 flask → 1 tonic) to lower the cash needed to brew; the latter needs a contract recipe change.
- The four levers are now the simulation's default strategies (`--levers none` reproduces the baseline).

## Round 2: maker accumulation and broke delvers (2026-11-11, later)

New levers, added one at a time on seed 2 on top of L1–L4:

| Lever | Change | Where it lives |
|---|---|---|
| L5 `fastfee` | When a dungeon gets no entries and delvers are broke, or its fee exceeds the poorest delver's purse, makers halve the fee down to what the poorest delver can pay (a "happy hour"); they raise it again only after 3+ entries. | Maker strategy (fees are already adjustable with `set_fee`). |
| L6 `smallbatch` | A small batch, 1 herb + 1 flask → 1 tonic, so an artisan with 4 coins can brew. | **Contract recipe change** (`craft.rs`): non-recovery batches of 2 inputs make 1 output; the full 2 + 2 → 2 recipe and recovery jobs are unchanged; server craft validation and the workbench (Small batch button) accept it. |
| L7 `commission` | Escrowed commissions: a player posts an order for N goods at a price, coins leave the purse into escrow, other players deliver goods and are paid from the escrow; cancel refunds the rest. Makers with idle coins commission tonics for future restocks and use commissions instead of the bank when a restock lacks goods; artisans and delvers deliver into open commissions first. | **New contract actions** `post_commission` / `fill_commission` / `cancel_commission` (Borsh indices 25–27, own storage key `commissions.v1`, so old state loads; snapshot `commissions` with escrow). Notice board → Commissions tab to post, fill and cancel. |

The bank-restock lever (L3) is switched off when commissions are on, so restock money goes to players rather than the operator's bank.

### Seed 2, cumulative

| Metric (7 days) | L1–L4 | +L5 fastfee | +L6 smallbatch | +L7 commission |
|---|---|---|---|---|
| Runs | 18 | 21 | 21 | 21 |
| Runs/day, last 3 days | 2.67 | 3.0 | 3.0 | 3.0 |
| Days a delver could not afford any dungeon | 2 | 0 | 0 | 0 |
| Player trades | 17 | 14 | 13 | 18 |
| Batches brewed | 2 | 2 | 3 | 3 |
| Treasure value taken out | 84 | 48 | 42 | 66 |
| Delvers' coins at end | 33 | 6 | 1 | 33 |
| Makers' coins at end | 59 | 86 | 96 | 38 |
| Artisans' coins at end | 12 | 12 | 4 | 18 |

L5 ended broke days but, alone, kept makers rich (fees just dropped toward zero). L6 added one brew. L7 is the lever that moved makers' coins into players' pockets: the proprietor commissioned tonics every day, the scavenger and the newcomer delivered them (6 coins each), and the proprietor restocked its dungeon with them.

### All levers vs baseline, three seeds

| Metric (7 days) | Seed 1 | Seed 2 | Seed 3 |
|---|---|---|---|
| Runs/day, last 3 days | 2.0 → 3.0 | 1.0 → 3.0 | 0.67 → 3.0 |
| Days a delver could not afford any dungeon | 2 → 0 | 3 → 0 | 4 → 0 |
| Player trades | 4 → 17 | 3 → 18 | 4 → 20 |
| Batches brewed | 1 → 3 | 1 → 3 | 1 → 3 |
| Treasure value taken out | 12 → 30 | 48 → 66 | 18 → 78 |
| Delvers' coins at end | 0 → 25 | 0 → 33 | 0 → 57 |
| Makers' coins at end | 85 → 53 | 93 → 38 | 88 → 24 |
| Unsold items at end | 14 → 7 | 15 → 8 | 14 → 8 |

Coins were conserved every day in every run (the check now also counts commission escrow). No faucet, no new issuance.

### Still open

- Treasure taken out varies a lot by seed because delvers' bot policies and dungeon generation are random; 7 rounds with 3 delvers is a small sample.
- Commission prices in the simulation are fixed at catalog value; no price discovery yet.
- All seven levers are the simulation default; `--levers none` is the baseline, and any subset can be named.
