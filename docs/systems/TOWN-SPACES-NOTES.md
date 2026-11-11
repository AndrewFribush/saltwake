# Town spaces notes (feat/town-spaces)

Goal: towns and interiors are player-built spaces. Players create, place, relocate, open, stock, furnish and demolish their own buildings; the buildings and their rooms come from contract state, so every player sees the same town and the same room.

## What already existed (before this lane)

- Contract `Shopfront` records: owner, title, district, 3×2 footprint, validated 11×9 interior JSON, version, open flag, listing ids. Create/update (move)/stock, buy blocked when closed. Town renders them, collision and door entry use them.
- Starter NPC buildings (inn, market, kettle, guild, catacombs) with interiors editable per browser only (localStorage).

## Land rules land-v1 (contract change, logic only)

`contracts/economy/src/shops.rs`, mirrored in `packages/shared/src/land.ts`, exposed by the `land_rules` view.

- At most 32 buildings in town and **3 plots per owner** (`PlotLimit`). Only creation counts; moving/editing an existing building never does. Worlds that already exceed the limit still load and edit.
- Building use lives inside the stored interior JSON as optional `kind`/`edition` (absent = shop), so **no state layout change and no migration**. Old interiors parse exactly as before.
- `kind:"dungeon"` = dungeon entrance: must link an edition that exists, whose maker is the actor, and is not closed at save time (`MissingEdition`, `WrongEditionMaker`, `EditionClosed`). Requires exactly one `portal` fixture; `portal` is rejected in shops. The link grants nothing: admission still goes through `admit` with its exact version/fee checks.
- Fixtures may carry `text` (≤160 UTF-16 units): authored notices visitors read.
- New action `remove_shop {shop_id, expected_version}` (Borsh index 22, after `stock_shop`): owner + version checked; refused with `ShopHasStock` while any of its listings is active. Frees the plot. New ids use the next free `shop-<n>`.
- Merge note: if another lane also appends an `Action` variant, keep `RemoveShop` at index 22 in both `model.rs` and `packages/shared/src/protocol.ts`, or renumber both together. Testnet needs a contract redeploy to get land-v1 (coordinator's job).

## Tests

- `tests/contract/town-spaces.test.ts`: land_rules view, plot limit, dungeon entrance binding, stray/missing portal, notice length, demolition owner/version/stock checks, id reuse, items unchanged by demolition.
- `packages/game/test/town-spaces.test.ts`: building use round-trip, TS validation mirrors contract, dungeon entrances in `districtPlaces`.
- Existing shop and player-authority contract tests still pass (including the "pre-identity upgrade without migration" test).

## Web (player-facing)

- **Build here** → placement studio: building use (Shop / Dungeon entrance + which of your open editions), district, sign, open flag, plot counter "n of 3 used". Furnish → interior builder with new **Notice** tool (readable text, or click furniture to label it) and **Stairway to your dungeon** (dungeon entrances only). Build on chain.
- Town draws dungeon entrances with a dark roof and stair mark; sign reads Dungeon entrance / Closed entrance.
- Inside a player building: readable notices (walk up, Enter/click), the stairway and the counter open the linked edition's offer + satchel packing; admission is the ordinary `admit` command with exact version/fee. Owners get Manage (open/close, demolish with stock check) and Edit interior (refurnish/move/relink). A demolished building's visitors step back to the street.
- Shared rooms: presence accepts `room: shop-<n>`; visitors in the same player building see each other's avatars on the room tiles and share a room chat ("Visitors" tab). The town's single SSE stream carries it (small store in `TownPresence.tsx`, hook in `RoomPresence.tsx`).
- Inventory → **Buildings** lists your plots (information only, no travel).
- Starter NPC houses: the per-browser editor is relabelled **Sketch interior (only you)** so it does not pretend to be shared.

## Played in the browser (Aside, local sandbox on 18980/18981)

Maker placed a dungeon entrance for the starter edition with a notice "Bring a sword. The second room bites.", opened it from Manage entrance; p2 walked in, read the notice at the board, took the stairway, packed a club, paid 2 coins and the run started ("The catacombs / The candle cellars — floor 1"). No console errors.

Harness quirks: each `aside repl` script is a fresh cookie jar, so a dead script keeps its demo profile leased for 30 min (restart the API to free it); switch profiles in-page via `POST /api/profile`. Local sandboxes started from this worktree have twice exited during `npm run verify` (contract tests start their own nodes); restart `npm run sandbox` + the API afterwards.

Two live browsers (127.0.0.1 and localhost cookie jars, `SALTWAKE_PROXY_ORIGIN=http://127.0.0.1:18980`): the proprietor and the delver stood in the same dungeon entrance, each saw the other's avatar on the room tiles ("1 other visitor here: The proprietor") and both room-chat lines arrived; the street did not see them.

More harness quirks: `vite.config.ts` ignores `**/.claude/**`, so a dev server run inside a worktree never sees file edits; restart it after changes. Load average hit 70 with 11 sandboxes from parallel agents; `capacity` and two `economy-stress` contract tests time out under that load (also on a solo rerun) and touch no shop code. They need a rerun on a quiet machine. The detached-sandbox trick (spawn with `detached:true`) kept a sandbox alive where `npm run sandbox` in a background shell kept getting stopped.

## After merging main (88a1009) and discovery work

- Merged build/dungeon-loop (drafting table, stacked trade rows, pack panel, buy_coins). Entrances use the new pack panel.
- Discoverability while walking: crossing into a district announces the player buildings standing there ("Built here: The smugglers' hollow entrance (The proprietor, dungeon entrance)") or invites you to claim a plot; standing at a player building's door adds a doorstep line; every player building flies a banner in its owner's colour; your own signs are outlined. Logic in `packages/game/src/town-discovery.ts` (tested).
- Relocation: Manage → "Move, refurnish or relink" opens placement directly. Browser-checked: moved the entrance from Harbor Square to Market Ward (5,10); contract record became district e, version 2, plot count unchanged.
- The worktree sandbox keeps receiving a clean shutdown signal even when spawned detached; something outside this lane stops `demo-sandbox` processes. Restart it plus the API before browser checks.

## Round 3 (after merging main again)

- **Harbor notice board** (Harbor Square quay, tile 3,7; shops cannot be placed west of x=4 so it is never built over). Walk onto it (or click its sign to walk there) to read player dungeons and shops: owner, district, open/closed, entry fee, funded attempts, settled runs with escaped/died counts (edition records), shop stock count and price range, plus spoken directions. "Mark on my map" pins the door (pin drawn in that district; the prompt keeps saying which way to go). No teleport or auto-walk to the destination. `packages/game/src/town-board.ts` (tested). Browser-checked.
- **Display shelves** (`decor-display-<8 hex>` fixtures, valid on the current contract without changes): owners place them in the shop interior builder; active listings spread over the shelves, each shelf tile shows an item icon, and walking up shows the goods with "Buy one" (ordinary `buy` at the exact listed price). Browser-checked on chain: shop with 2 shelves, 2 listings; the delver bought a fine tonic from a shelf (10 → 4 coins, item transferred, shelf count dropped).
- **Claim-a-plot tour**: a player with no buildings sees a dashed "free plot" on the nearest land the contract would accept (`suggestPlot`/`footprintBlocked` mirror shops.rs; ShopBuilder now uses the same rule) and a one-time note pointing at Build here; "Got it" remembers per profile.

## Round 4

- **Public records on the board** (server side, `apps/server/src/edition-record.ts`, `shop-record.ts`): each edition record carries `recent` (up to five latest confirmed outcomes, newest first, outcome + time only); every shop in `/api/world` carries `publicRecord` {sold, buyers, coverage} derived from confirmed receipts (no buyer names, no revenue; the owner still gets the full `record`). The board shows "Latest: died · escaped …" and "n sold to m buyers". Browser-checked.
- **HTTP lifecycle test** `apps/server/test/town-spaces-http.test.ts`: publish → dungeon entrance → shelf shop → third plot → fourth refused (PlotLimit) → stock → visitor buys → public record visible to the visitor, owner receipts hidden → demolition refused while stocked / by non-owner → withdraw → demolish → plot reusable, stock back with the owner.
- Merged main after the look-feel landing (d085054); board, tour, banners, dungeon mark and pin still render; no console errors.
- Land lifecycle not changed: abandoning/reclaiming idle plots would need an activity timestamp in contract state (a migration) and an economic rule for who may reclaim; left as a proposal.

## Round 5: demonstration town

- `scripts/demo-town.ts`, run by `npm run sandbox` by default (`--plain` or `--empty` skip it). After the starter setup it starts an in-process copy of the API on the new epoch's own server database and drives it like separate browsers (one cookie jar per demo character): the proprietor publishes "The drowned stair" (drafting-table Medium preset, no treasure) and builds entrances for it and the starter edition plus "Proprietor's pantry" (3 display shelves; herbs, flasks, fine tonics); the wayfarer publishes "Rat warren" (Small preset, cost checked against its coins) and builds its entrance; the mercenary and scavenger open one-shelf shops with their own clubs; the delver and newcomer pay into the two preset dungeons bare-handed and abandon, so the board shows settled runs. Every building has an authored notice. Terms use the same floor shaping as the drafting table (`designFloor` copy in the script; FloorBuilder untouched).
- Test `apps/server/test/demo-town.test.ts`: no credit or item issuance, 6 buildings within the 3-plot limit, 3 entrances + 3 stocked shops on the board, 2 abandoned runs, notices present.
- The notice board says, in the local demo, that the first buildings, stock and runs are demonstration supply. README updated.
- Ran the real `npm run sandbox` end to end: board lists Rat warren / Hollow gate / The drowned stair with "Latest: abandoned", and the three shelf shops.

## Round 6: wording fixes and private trades

- Quayside sign counts only market stock (bank stock + listings not in a player shop). Treasure-free dungeons say "n places open now · no treasure" on the board and in the expedition offer; the catacombs sign says "n open places".
- **Private offers (contract change, no migration):** new action `list_for {item_ids, unit_price, buyer}` appended at Borsh index 23 (mirrored in `protocol.ts`). It is `list` plus a reservation stored under its own storage key `listing-buyer:<listing id>` (outside the state struct, written only after the command commits, so rejections reserve nothing; listing ids are never reused). `buy` refuses anyone else with `ReservedForAnotherBuyer`. Seller cancel returns unsold goods as before. Unknown or self buyer is rejected. The snapshot gains `reservations` (active listings only, omitted when empty so older snapshot comparisons stay equal); `/api/world` passes it through. No expiry: the seller withdraws to recover goods.
- UI: the trade panel offers privately by default ("Only the proprietor can buy", untick for public), announces in chat, and the buyer sees "Offered to you: only you can buy this". The market's player-offer list hides offers reserved for others and marks offers to you.
- Tests: `tests/contract/private-trades.test.ts` (refusal by others, idempotent replay, reserved buyer buys, cancel returns goods, rejected offers leave the next public listing open, credit/item conservation); HTTP check in `town-spaces-http.test.ts`. Browser: the delver offered a club privately to the proprietor; the proprietor saw "Offered to you" and bought it.
- Needs a contract redeploy on testnet for `list_for` (coordinator).

## Round 7: testnet redeploy script (prepared, not run on testnet)

- `scripts/testnet-redeploy.ts`: prepare (keys + proposal + approval template, no writes) → `--execute` with an approval naming the exact accounts, RPC, WASM hash, send budget and runtime budget. Faucet-creates the contract account and funders, tops up, checks the balance covers code storage, deploys, verifies the final code hash, calls `init_public_testnet`, writes `.state/testnet-<account>.json` + `-approval.json` for `npm run server -- --testnet`, smoke-reads snapshot/land_rules/coin_offer. Journal before every send; any earlier journal for the account refuses a rerun. Mainnet accounts/RPCs refused; `--rpc` only loopback.
- Rehearsed on the local sandbox: `rehearse2.sandbox` with two funders → DEPLOYED (hash 31890e0a…, 29.79 NEAR, land-v1, coin price 0.01 NEAR, recovery budget 160). The generated server files pass `checkTestnetApproval` once the RPC/account are substituted with testnet values. A first rehearsal exposed that the deploy is included before final; the code check now waits (bounded) and the leftover journal correctly blocked a rerun.
- README section "Redeploy the testnet contract" has the exact commands.

## Round 8: two live wallet players; browsing presence

- `--wallet-local-alias http://localhost:<port>` (local wallet mode only, loopback http only; refused otherwise and never with secure cookies): the API accepts that second origin for host/origin checks and `/api/config`, and `WalletSessions` signs a challenge bound to the origin the player used (finishing from the other origin is refused). Vite needs `SALTWAKE_KEEP_HOST=1` so the API sees the browser's Host. README section "Two local wallet players at once".
- Live session (127.0.0.1 = player1, localhost = player2, local wallet sandbox): both signed in; player2 registered and bought 10 coins with NEAR; they saw each other and chatted; player1 offered a herb privately (`reservations` = wallet:player2.sandbox), player2 saw "Offered to you" and bought it (coins 8→10 / 10→8); both paid into the same dungeon at once (edition active=2) and gave up (summary "You gave up and were led out.").
- Presence: the server announces room occupancy (`rooms` event, names only, ≤5 per room) to everyone when someone enters or leaves a player building. The notice board shows "X is browsing now" (or "in the entrance hall") per building; inside a shop, a visitor standing at a display shelf gets their name over the shelf. Checked live with the two wallet players.

## Round 9: business ledger (S14)

- Server `apps/server/src/business-ledger.ts` (served as `businessLedger` in the player's own `/api/world` only): cash by source from `businessAccount` receipts plus wages from finished recovery batches; owned goods with acquisition cost from the cost journal (`currentCostState`, exported from cost-ledger) or "unknown"; committed funding in open editions; pending maker fees, recovery wages and reserved run fees; per-edition (fees, placement, treasure cost, contribution or unknown, settled/active samples, funded goods still below) and per-shop (receipt revenue, matched cost, unknown-cost items, contribution or unknown, coverage, stock) results; notes that coins are synthetic and buy-ins/starting allocations are not itemized.
- UI `BusinessLedger.tsx`: Inventory → Business (Cash / Goods / Dungeons / Shops / Notes), and the account book inside your own building opens Business ledger + Purse. Visitors' account books show only their own purse; the public board keeps aggregate counts.
- Test: HTTP lifecycle test now checks the buyer's ledger (trade out 3, the bought tonic's cost 3, no shops, synthetic note) and the owner's (shop revenue 3 from 1 sale, complete coverage, trade in, placement out, edition open with 0 settled runs, 1 open edition committed). Browser: player1 (wallet) ledger showed +2 trade, −2 bank, −2 entry, the stall with no sales, and the same ledger from the account book in their stall.
- Limitation: NEAR buy-ins are not itemized (the contract keeps purchases by request id, not a per-player list).

## Round 10: buy-in reconciliation and the simulated week

- Contract: `buy_coins` also appends a per-player total under `coin_buyer.v1:<profile>`; view `coin_purchases_of`; snapshot `buy_ins` (wallet profiles, omitted when empty). Ledger itemizes "Bought with NEAR (labelled issuance)" and shows Purse = recorded net + unexplained (0 for wallet players; demo characters' starting allocation otherwise). Needs the testnet redeploy.
- `npm run simulate -- --days N` (`scripts/simulate.ts`): isolated sandbox + demo town, then per simulated day bots act through the real HTTP API (in-process server on the epoch's own DB) and contract: recovery jobs, bank ingredient buys, brewing, stocking shelves, buying tonics before descending, paying into dungeons and playing them with `scripts/depth-sim.ts` `choose` policies (cautious/greedy/reckless; full own run state), selling finds to the bank, merchant resale, makers adjusting fees from entries. Per-day report (purses, bank, issuance, fees, wages, trades, brews, run outcomes, treasure out, prices by type, unsold items, bank stock, dungeons with no entries, events) with a conservation check over purses + bank + escrowed fees + wage budget/reserves + NPC order budget; any drift aborts. 7 days ≈ 55 s. Written to `.state/<epoch>/town-history.json`; the sandbox stays up for `npm run server`, and the notice board's **Town history** tab (`/api/town-history`) shows it, labelled SIMULATION.
- Observed story in a 7-day run: delvers spend down to 0 coins by day 4–5, the proprietor cuts "The drowned stair" fee 3→0 on zero entries, then raises it when two delvers return; the smugglers' hollow sells out its funded treasure; artisans stall once ingredient costs exceed their cash. Coins conserved every day.
- Test `apps/server/test/simulate.test.ts` runs two days and checks conservation, history and that delvers played.

## Round 11: economy levers round 2

- Contract: commissions (`post_commission`/`fill_commission`/`cancel_commission`, indices 25–27, storage key `commissions.v1`, snapshot `commissions`), small craft batches (1 herb + 1 flask → 1 tonic, non-recovery). Needs the testnet redeploy. Tests: `tests/contract/commissions.test.ts`; extended fixture audit counts commission escrow and variable batch outputs.
- UI: notice board → Commissions tab (post/fill/cancel); workbench Small batch button; ledger counts commission coins.
- Simulation levers `fastfee`, `smallbatch`, `commission` (default on). Three seeds: broke days → 0, delvers end with 25–57 coins, makers 24–53 (from 85–93). Details in ECONOMY-TUNING.md.

## Round 12: price discovery, bigger towns, collapse, charts

- Simulation: `prices` lever (asks/bids from yesterday's fills), `--players N` (contract `init_simulation` seed: m-/a-/d- profiles, scaled record caps for that world only), `--scenario collapse` (delvers start at 0). Day reports add coins by role, prices paid and best bids.
- Town history: inline SVG charts (coins by role, runs/trades/unsold, average price paid), CSS classes for look-feel.
- Findings (ECONOMY-TUNING.md round 3): ingredients run out by day 5 in a 30-day 20-player town (no herb/flask source); collapse recovers via free entry + commissions (delvers 0 → 51 in 14 days). Lifetime record caps (64 runs/listings/batches, 256 receipts) flagged; capacity lane owns the fix — do not touch runs.rs/market.rs/craft.rs caps or outbox capacity.

## Next step

Candidates: a land price or upkeep paid to the bank (needs contract + economic review), building art per kind from the look-feel lane, a visitor count on signs.
