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

## Next step

Candidates: a land price or upkeep paid to the bank (needs contract + economic review), building art per kind from the look-feel lane, a visitor count on signs.
