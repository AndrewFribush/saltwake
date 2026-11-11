# Dungeon economy — local prototype

A walkable town, seeded paid dungeons and a custodial shop/crafting economy on an isolated local NEAR sandbox. No public deployment or real-money game is configured.

## Play Saltwake

Requires Node **22.23.1** / npm **10.9.8**, pinned Rust **1.93.0** and the `wasm32-unknown-unknown` target. Node's built-in SQLite prints an experimental warning.

Build once, then keep these three terminals running:

```sh
npm ci
npm run build:contract
npm run sandbox
```

```sh
npm run server
```

```sh
npm run dev -- --port 18930 --strictPort
```

Open http://127.0.0.1:18930. **The game opens in Saltwake**, a walkable harbor town. Click a building to walk there, or use arrows/WASD to walk into its doorway. Entering is automatic. Each building has a tile interior: walk to its service counter to trade, craft, or manage expeditions. Click a counter to walk there automatically. Walk through the south door to leave; Escape closes an interaction or leaves the room. Touch direction controls are available indoors. Click your purse, or approach an indoor account book, for balances, reserved fees, pending income, and receipts.

- **Quayside market:** buy finite stock, sell finds, or stock your own stall. Select goods from your satchel to sell; select a trader's goods to buy.
- **The Copper Kettle:** select two herbs and two flasks, then time three inputs to craft tonics. Low-asset characters can take bank-supplied recovery work. Supplies, wages and orders are bounded.
- **Delvers' guild:** draw 2–4 dungeon floors, place walls, arrival/stairs and four encounter sockets per floor, configure enemies/traps/rewards, save drafts and play a free rehearsal. Publishing charges the displayed placement cost and funds rewards from selected owned goods. Existing editions retain their immutable layouts; refresh stock and inspect receipts below the builder.
- **The old catacombs:** pack selected equipment, inspect the fee and funded treasure, and pay for an attempt. New editions use server-seeded chambers/corridors and fog. Only actual funded items can be found. Older version-1 editions retain their fixed layout; maker-built version-3 editions use their published authored tiles.
- **The Salt Lantern:** stored belongings, settled-run journal and free practice. Practice creates no economic rewards.

Saltwake has nine connected districts. Walk or click toward an open map edge to cross into the neighboring district; the direction signs walk you there too. Cross back to return. The harbor’s west crossing follows the middle road over the water; the outer town walls are closed. Neighboring buildings access the same existing town services and stocks.

**Player buildings.** Choose **Build here** in any district to place a 3×2 building: a shop (stock and price your goods) or a dungeon entrance whose stairway opens one of your own published, still-open dungeons. Furnish its 11×9 interior (counters, furniture, readable notices, the stairway), then build it on chain. Buildings and their rooms are contract state, so every player sees the same building and room, and visitors inside the same building see each other and can talk. Owners can refurnish, move, relink, open/close and demolish (after withdrawing stock). Land rules `land-v1`: 32 buildings in town, 3 plots per player, no land price yet. Inventory → Buildings lists your plots.

Inside a starter house, **Sketch interior (only you)** rearranges that room in this browser only; it changes no ownership or balances and other players never see it. Dungeon drafts are saved separately per character. Invalid/unreachable layouts cannot be installed or published.

**Demonstration town (default for `npm run sandbox`).** After the starter setup, demo characters use the ordinary player API to claim plots and build: three dungeon entrances (the starter edition plus two editions generated from the drafting table's Medium and Small presets), three shops with display shelves stocked from goods they already own, and two settled (abandoned) runs so the harbor notice board shows real records. It mints nothing and respects plot limits. This is demonstration supply, not organic activity; the notice board says so. `npm run sandbox -- --plain` skips it.

Fresh worlds include a proprietor-funded expedition with two reward bundles and two finite tonic listings. These consume existing seeded inventory and the proprietor's placement fee; they do not add assets. Use `npm run sandbox -- --empty` for the old unconfigured seed. Starting stock is demo supply, not organic market activity.

In a dungeon, arrows/WASD or adjacent tile clicks move; bumping an enemy attacks. G guards; space waits. Read attack lanes and spike states. Stand on loot to take, equip or drink it. Clear threats and reach the stairs to extract or continue. A first-floor shrine offers healing or a health-for-damage tradeoff. On death, town gear goes to the bank and unconsumed dungeon finds return to their pool. Your run persists across reloads. Results wait for confirmed settlement before goods become spendable.

**Session** lets you change between operator-controlled characters: the delver, proprietor, mercenary and low-capital artisans. These are custody leases, not wallet authentication. Another active browser session cannot take your held profile. The API listens only on 127.0.0.1:18931. The sandbox writes its local-only signing key into ignored `.state/sandbox.json`; never publish it. Server restart preserves chain/SQLite but invalidates session cookies. Sandbox restart creates a fresh economy and preserves prior epoch databases. Stop it cleanly before starting another.

This is a local gameplay slice, not a finished ARPG, multiplayer town or simulation of shipping/armies. Human gameplay acceptance remains open. See [world gameplay evidence](docs/world-gameplay-verification.md).

## Verify

```sh
npm run verify
```

Includes typecheck, WASM build, game tests, actual-WASM contract tests, server/recovery/HTTP economy-loop tests, and web build. Individual suites: `npm run test:game`, `npm run test:contract`, `npm run test:server`. Contract capacity/deadline tests take longer and start only ephemeral local nodes. `npm run test:e2e` runs the integrated HTTP gameplay/economy proofs; these do not replace browser or human playtests.

[Checklist](../design/dungeon-economy/CHECKLIST.md) · [Progress](docs/progress.md) · [Trust and limitations](docs/trust.md) · [Gameplay observations](docs/play-observations.md)

## Update an already-running local sandbox

After rebuilding the contract, stop only the API process (keep the sandbox running), then run `npx tsx scripts/upgrade-local.ts` and restart `npm run server`. This helper requires loopback RPC, takes the existing database writer lock, refuses unresolved operations, deploys code without reinitializing, and verifies the entire economy snapshot is unchanged. It is only for this isolated local prototype.

## Redeploy the testnet contract (needs Andrew's approval)

`scripts/testnet-redeploy.ts` puts the current contract on a **fresh** testnet account in one bounded run: it creates the account and one or two funder accounts through the testnet faucet, tops up the contract account (the 1.3 MB contract needs about 13 NEAR of storage), deploys the built WASM, checks the deployed code hash, calls `init_public_testnet`, writes the server's `--testnet` config and runtime approval, and runs a read-only smoke check (`snapshot`, `land_rules`, `coin_offer`). Testnet only; mainnet accounts and RPCs are refused. Keys stay in git-ignored `.state/redeploy/<account>/` and are never printed.

1. Build and prepare (no network writes; prints the proposal, public keys and the approval template):

   ```sh
   npm run build:contract
   npx tsx scripts/testnet-redeploy.ts --account saltwake-YYYYMMDD.testnet --funder saltwake-YYYYMMDD-f1.testnet --funder saltwake-YYYYMMDD-f2.testnet
   ```

2. Approve: copy `approvalTemplate` from that output into `.state/redeploy/<account>/approval.json`, set `expiresAt` (no later than 2026-11-16T23:59:59Z) and keep `approvedBy: "Andrew"`. The approval pins the exact accounts, RPC, WASM hash and send budget (3 faucet requests + 4 transactions for two funders) plus the server's runtime budget.

3. Execute (the one command to approve):

   ```sh
   npx tsx scripts/testnet-redeploy.ts --account saltwake-YYYYMMDD.testnet --funder saltwake-YYYYMMDD-f1.testnet --funder saltwake-YYYYMMDD-f2.testnet --execute
   ```

   Every send is journaled in `.state/redeploy/<account>/journal.jsonl` before it is made. If any step fails, the script stops; a second `--execute` for the same account refuses until someone checks the chain and journal (no blind retries). On success it prints the smoke results and the two files to start the server with:

   ```sh
   npm run server -- --testnet --config .state/testnet-<account>.json --approval .state/testnet-<account>-approval.json --rpc-cache-ms 20000
   ```

   The web client reads the contract id from the server, so it follows the new account automatically. Existing testnet players start fresh on the new contract (new state).

Rehearsal against a local sandbox (loopback only; the sandbox root emulates the faucet and accounts are named `<name>.<root>`): `npx tsx scripts/testnet-redeploy.ts --rpc http://127.0.0.1:<port> --account r1.sandbox --funder f1.sandbox` then `--execute` with an approval whose `approvedBy` is `local-rehearsal`.

## Two local wallet players at once

Wallet sign-in is bound to one origin, and one browser keeps one cookie jar per host. For a second simultaneous local wallet player, give the API a loopback alias and let Vite keep the Host header (local wallet mode only; testnet ignores both):

```sh
npx tsx scripts/wallet-sandbox.ts 2
npx tsx apps/server/src/main.ts --wallet-local --wallet-local-alias http://localhost:18972 --config .state/wallet-sandbox.json --port 18973 --web-origin http://127.0.0.1:18972
SALTWAKE_KEEP_HOST=1 SALTWAKE_API_PORT=18973 npx vite apps/web --host 127.0.0.1 --port 18972 --strictPort
```

Open `http://127.0.0.1:18972/?devSigner=player1.<contract>` and `http://localhost:18972/?devSigner=player2.<contract>`. Each signs in with its own message bound to the origin it used.

## Watch a simulated week (fast-forward)

```sh
npm run build:contract
npm run simulate -- --days 7
```

Starts an isolated local sandbox with the demonstration town, then bot players act through the real API and contract, one round per simulated day: newcomers take recovery jobs, artisans buy ingredients and brew, shop owners stock shelves, delvers buy tonics, pay into dungeons and play them with the dungeon bot policies (escape, die), sell their finds to the bank, merchants resell, and makers cut or raise entry fees from observed demand. Each day prints coins in purses and the bank, fees, wages, trades, brews, run outcomes, unsold stock and a conservation check (coins only move; any issuance is a separate labelled line). A week takes about a minute. The sandbox then stays up: start `npm run server` and `npm run dev -- --port 18930 --strictPort`, open the harbor notice board and choose **Town history** to read the day-by-day report, labelled SIMULATION. Chain time does not jump, and bots read their own full run state to pick moves.
