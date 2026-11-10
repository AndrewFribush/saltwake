# Dungeon economy — local prototype

A roguelike practice mode and a custodial dungeon/shop/crafting economy on an isolated local NEAR sandbox. No public deployment or real-money game is configured.

## Play

Requires Node **22.23.1** / npm **10.9.8**. The economy additionally needs the pinned Rust **1.93.0** toolchain and `wasm32-unknown-unknown` target. Node's built-in SQLite currently prints an experimental warning.

```sh
npm ci
npm run dev -- --port 18930 --strictPort
```

Open http://127.0.0.1:18930. Practice has seeded connected maps, limited visibility, waking enemies, varying treasure, armor/tonic starting kits, and a one-use health/damage shrine. This is a gameplay repair iteration; player feedback has **not** accepted it as a finished roguelike.

Arrow keys/WASD or adjacent tile clicks move; bumping an enemy attacks. G guards; space waits. Read marked attack lanes and spike states. Stand on loot to take, equip or drink it. Clear enemies and reach E to extract or continue. Death loses town gear; unconsumed dungeon finds return to their pool. Practice outcomes are simulated.

## Local economic demo

Build once, then keep these three terminals running:

```sh
npm run build:contract
npm run sandbox
```

```sh
npm run server
```

```sh
npm run dev -- --port 18930 --strictPort
```

Choose **Local economy demo**. API listens only on 127.0.0.1:18931. The sandbox process creates an ephemeral chain and a git-ignored `.state/sandbox.json` with its local-only signing key. Never publish that file. Server restart uses the existing chain and SQLite epoch; restarting the sandbox intentionally creates a fresh economy and preserves prior SQLite epoch directories. Stop the sandbox cleanly with Ctrl-C before starting a new one. An existing configuration is refused, not silently overwritten.

- Start as buyer; the labeled demo switcher can claim maker, other players, or zero-capital workers. Another active session cannot claim your currently held profile. These are custody leases, **not wallet authentication**; server restart invalidates sessions.
- Maker: select one sword and two tonics, enter a title/fee, and publish the fixed two-room edition. Select more complete bundles to fund concurrent attempts. Publication/placements cost 11 test credits.
- Buyer: select town loadout, inspect the fee/risk, enter, play, and wait for confirmed settlement. Refresh/reconnect resumes saved play. Used goods stay consumed; death sends town gear to bank; surviving dungeon goods return to their pool.
- Shop: select owned stock to list; another profile can buy exact items. Bank sales/buybacks have finite stock and cash. Shop-bought potions can be taken into a run and used.
- Craft: select two herbs and two flasks. Three timed inputs determine normal/fine output; the server measures timing. Bank recovery jobs provide inputs and pay wage 2 to eligible low-holdings workers, at most three jobs per profile and within a six-credit labor budget.
- Makers can refresh stock, change future admission fees, and finalize closure after cutoff and resolution of active runs. Leftovers go to bank. Public stock values are catalog reference values, not cash appraisal or guaranteed profit.

The economic demo currently uses the fixed cellar/gauntlet layouts. The new seeded roguelike practice is not yet the maker's paid dungeon generator. Four-module editor/preview and a complete game feel pass remain open.

## Verify

```sh
npm run verify
```

Includes typecheck, WASM build, game tests, actual-WASM contract tests, server/recovery/HTTP economy-loop tests, and web build. Individual suites: `npm run test:game`, `npm run test:contract`, `npm run test:server`. Contract capacity/deadline tests take longer and start only ephemeral local nodes. `npm run test:e2e` runs the integrated HTTP gameplay/economy proofs; these do not replace browser or human playtests.

[Checklist](../design/dungeon-economy/CHECKLIST.md) · [Progress](docs/progress.md) · [Trust and limitations](docs/trust.md) · [Gameplay observations](docs/play-observations.md)
