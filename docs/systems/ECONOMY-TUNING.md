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

## Round 3: price discovery, larger towns, and a demand collapse

### Price discovery (lever `prices`, now default)

Artisans move their tonic ask from yesterday's sales: +1 after a sale, −1 (taking back and relisting unsold shelf stock) after a day with none, never below 3. Makers move their standing commission bid the other way: +1 (withdraw and repost) after a day unfilled, −1 after a fill, capped at 9 and at what they can afford. Each day's report now records the prices actually paid (listing sales and commission deliveries, read from contract state) and the best open bid, and the notice board's Town history shows them with charts.

7 days, all levers including prices:

| Metric | Seed 1 | Seed 2 | Seed 3 |
|---|---|---|---|
| Runs/day, last 3 days | 3.0 | 3.0 | 3.0 |
| Days a delver could not afford any dungeon | 2 | 1 | 1 |
| Player trades | 18 | 16 | 20 |
| Treasure value taken out | 60 | 42 | 60 |
| Delvers' / makers' / artisans' coins at end | 24 / 68 / 12 | 9 / 67 / 10 | 28 / 52 / 10 |

Compared with round 2 (fixed catalog prices), tonics now trade at 3–5 instead of 6, which leaves makers a little richer and delvers a little poorer on these short runs; volumes are similar.

### 30 days with 12 more players (`--players 12 --days 30 --seed 4`)

The contract's `init_simulation` seed adds makers m-0..1 (60 coins, 2 swords, 4 tonics each; each opens a funded generated dungeon), artisans a-0..3 (10 coins, 2 herbs + 2 flasks; the bank gets 6 + 6 more per artisan) and delvers d-0..5 (10 coins and a club), alongside the demo cast. It also scales the prototype record caps for this world only (see the capacity note below). 30 days took 23 minutes.

| Day | Makers | Artisans | Delvers | Runs | Trades | Batches | Tonic prices paid | Best tonic bid |
|---|---|---|---|---|---|---|---|---|
| 1 | 145 | 89 | 57 | 9 | 11 | 5 | 3–5 | 5 |
| 3 | 143 | 72 | 38 | 9 | 5 | 5 | 4–5 | 3 |
| 5 | 138 | 67 | 23 | 2 | 3 | 0 | 3–5 | 5 |
| 10 | 74 | 85 | 59 | 9 | 0 | 0 | – | 9 |
| 20 | 80 | 85 | 21 | 9 | 0 | 0 | – | 9 |
| 30 | 101 | 85 | 0 | 9 | 0 | 0 | – | 9 |

Totals: 181 runs, 151 coins of entry fees, 53 trades, 19 batches, treasure value 210 taken out; coins conserved all 30 days.

What it shows:
- **Ingredients run out.** All 19 batches happen in the first 5 days; after that the bank and the shelves have no herbs or flasks left, artisans sit on 85 coins with nothing to brew, and makers' tonic bids climb to the cap of 9 and stay unfilled. Nothing in the game produces new herbs or flasks. This is the binding constraint at scale, not coins.
- **Price discovery works while there is supply:** tonics fall from 5 to 3 as artisans compete, and bids rise as supply disappears.
- Delvers keep playing at fee 0 (9 runs/day), but with no tonics to buy and fees drifting back up, they end the month broke again; makers' coins recover from 61 to 101.

### Demand collapse (`--players 12 --days 14 --scenario collapse`)

All delvers start with 0 coins (only the d-* delvers play).

| Day | Makers | Artisans | Delvers | Runs | Trades | Entry fees |
|---|---|---|---|---|---|---|
| 1 | 134 | 44 | 0 | 0 | 0 | 0 |
| 2 | 113 | 42 | 6 | 6 | 4 | 0 |
| 4 | 81 | 44 | 17 | 6 | 7 | 1 |
| 8 | 55 | 64 | 38 | 6 | 6 | 1 |
| 14 | 51 | 64 | 51 | 3 | 0 | 4 |

Recovery path, in order: on day 1 nobody can pay, so every maker halves its fee to what the poorest delver can pay (0); from day 2 delvers enter free, bring out treasure and deliver found tonics and swords into makers' commissions; by day 8 delvers hold 38 coins and fees start creeping back up. Over 14 days coins move from makers (134 → 51) to delvers (0 → 51) and artisans (44 → 64). Coins conserved every day.

### Still open after round 3

- **Ingredient supply** (above) is the next lever: a labelled, scheduled operator restock of herbs and flasks at catalog price (central issuance, which the brief allows the operator), or herbs/flasks as fundable dungeon treasure so delvers bring them back. Not implemented here.
- **Record capacity** (found by the 30-day run): the contract caps runs, listings and craft batches at 64 over a world's whole life, and receipts at 256. The live game would stall at those totals. The simulation seed scales them for its own world only; a proper fix (pruning settled records) is now the capacity lane's job.

## Round 4: the ingredient bottleneck

Both runs: `--players 12 --days 15 --seed 4`, all no-issuance levers on. Coins conserved every day in both.

### No-issuance path (default levers + `herbloot`)

- Herbs and flasks are already valid dungeon treasure under the existing rules: any good can go into a random reward pool, and fixed sockets can name herb or flask. The new `herbloot` behaviour has makers refill an emptied random pool with herbs and flasks they hold, and lets delvers resell found herbs and flasks to players.
- The rules have no way to recover ingredients: a batch consumes its inputs for good, and the bank buying tonics back cannot turn them into herbs (that would create goods), so neither was added.
- Result: **brewing still stops after day 4** (19 batches, then 0 from day 5 to 15). No maker ever refilled a dungeon with herbs: by then nobody holds any. Moving ingredients between players cannot outlast the stock that exists.
- Stock arithmetic for this world: 48 herbs and 48 flasks exist at the start (proprietor 8 + 8, bank 8 + 8, four sim artisans 2 + 2 each, plus 6 + 6 per artisan in the bank). That is at most 24 full batches (or 48 small ones), and recovery jobs consume bank ingredients too. 19 batches plus 3 recovery jobs used essentially all of it. **Without issuance, ingredient-based crafting is finite by construction.**

### Proposal for Andrew: scheduled operator restock (implemented OFF by default, lever `restock`)

What it does: whenever the bank holds fewer than 2 herbs or 2 flasks, the operator adds 4 of each to the bank's stock (contract `operator_restock`, callable only by the contract account; it creates goods, never coins, and keeps a running total visible through the `item_issuance` view). Players buy them from the bank at catalog price (2 coins each), as today.

| 15 days, 20 players | No issuance | With operator restock |
|---|---|---|
| Batches brewed (after day 5) | 19 (0) | 45 (25) |
| Player trades | 63 | 88 |
| Goods issued by the operator | 0 | 96 herbs and flasks (8 a day from day 4) |
| Bank coins at end (start 54) | 108 | 233 |
| Coins in players' purses at end | 210 | 133 |
| Artisans' coins at end | 85 | 32 |
| Tonic prices paid, days 5–15 | none traded | 3–5 |

What it shows:
- Restocking keeps the artisan trade alive (2–4 batches a day indefinitely, tonics keep trading).
- **It is also a coin sink into the bank:** every restocked herb or flask is sold for coins the bank does not spend back, so players' purses fell from 290 to 133 in 15 days while the bank rose to 233. A restock policy would need a matching bank outflow (for example bank-funded NPC tonic orders or replenished recovery wages from bank revenue) to avoid draining players.
- Artisans lost money in this run because price discovery let tonic asks fall to 3, below the cost of ingredients (4 per tonic). The simulation's ask floor is now the ingredient cost (4); not yet rerun.

Decision needed from Andrew: whether the operator issues goods at all, at what rate and price, and what the bank does with the coins it collects. Until then the lever stays off and the default world has no goods issuance.
