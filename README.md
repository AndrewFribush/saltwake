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

Open http://127.0.0.1:18930. **The game opens in Saltwake**, a walkable harbor town. Click a building to walk there, or use arrows/WASD and Enter at a door. Each building has a tile interior: walk to its service counter to trade, craft, or manage expeditions. Click a counter to walk there automatically. Walk through the south door to leave; Escape closes an interaction or leaves the room. Touch direction controls are available indoors. Click your purse, or approach an indoor account book, for balances, reserved fees, pending income, and receipts.

- **Quayside market:** buy finite stock, sell finds, or stock your own stall. Select goods from your satchel to sell; select a trader's goods to buy.
- **The Copper Kettle:** select two herbs and two flasks, then time three inputs to craft tonics. Low-asset characters can take bank-supplied recovery work. Supplies, wages and orders are bounded.
- **Delvers' guild:** fund a new expedition from owned treasure, set its fee, refresh stock and inspect receipts. The current charter uses two seeded floors; the full layout editor is not built.
- **The old catacombs:** pack selected equipment, inspect the fee and funded treasure, and pay for an attempt. New editions use server-seeded chambers/corridors and fog. Only actual funded items can be found. Older version-1 editions retain their fixed layout.
- **The Salt Lantern:** stored belongings, settled-run journal and free practice. Practice creates no economic rewards.

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
