# Dungeon depth (rules v12) — notes

Goal: make runs play like a roguelike while keeping every new thing a player-authorable catalog component.

## What changed

**Rules v12 / `custom12:` modules.** A floor may now declare `features` (required array, may be empty) and an optional `tide`. Sockets may use four new enemy kinds. Shared definitions live in `packages/shared/src/depth-components.ts` (catalog, defaults, costs, validation). The same definition drives the builder, rehearsal, the server's authoritative play and the contract's validation. v1–v11 editions are untouched: no new field or enemy is read unless the module is `custom12:`, and the contract rejects new enemies below v12.

**Enemies** (all telegraphed, tunable health/damage/alert):
- Crossbow sentry: keeps distance; when you share a row/column within 6 it aims (bolt line shown), fires next turn at the first creature or keg on the line, then reloads.
- Powder crab: lights its fuse when adjacent (3×3 shown), bursts next turn. A plain melee blow before it lights is safe; anything else that drops it (blast, fire, bolt, a blow while lit) sets it off.
- Drowned brute: acts every other turn; winds up a 3-tile sweep; cannot be shoved.
- Rat nest: stationary; hatches rats every 4 turns on a marked tile (≤3 alive, ≤6 total).

**Features**: powder keg (bump/blast/fire lights it; bursts after the next turn, chains), cracked wall (on an inner wall; bump to chip, blasts break it; hides rooms: validation lets floor be reachable only through cracks), oil slick (burns 3 turns, spreads, lights kegs), chasm (blocks walking not sight; shoved creatures fall), salt spring (limited heals), blood altar (pay health for might/ward/sight), supply cache (bombs, darts, flash powder: run-only tools, never economic goods).

**Tide**: per-floor turn budget; afterwards fixed damage per turn until you leave. The push-your-luck lever.

**Player verbs (v12 runs)**: shove with any weapon (target loses its next action), interact [E] on springs/altars, throw bomb/dart at a target tile, use flash powder.

**Builder**: Features inspector (place/configure/remove, tide), six enemy kinds in Encounters with summaries, costs include features, guide pages generated from the catalog, "Generate starting floors" (seeded rooms + hidden stash + hazards + mixed enemies, fully editable, undoable). Drafts that use no v12 component still publish as rules v11, so they work on the currently deployed testnet contract.

**Run UI**: CSS sprites for the new enemies and features, lit kegs/burning oil animate, blast flash, hatch markers, stun marks, supplies/aiming, spring/altar buttons, tide countdown and boons in the status line, readable log names ("powder crab #1").

## Contract

`contracts/economy`: Enemy enum gains Archer/Bomber/Brute/Nest (appended, Borsh-safe), rules_version 12 accepted with `custom12:` modules (≤6144 bytes), feature schema/range/placement/connectivity checks, feature costs (1, or 2 for spring/altar/cache), ≤24 features/floor and ≤128 total. **The testnet contract (saltwake-20261110.testnet) needs a redeploy before v12 editions can be published there.** v11 publishing and all older editions keep working without it.

## Tests

`packages/game/test/depth.test.ts` (mechanics, validation, blueprint, generator), `tests/contract/depth.test.ts` (WASM v12 validation and costs), `apps/server/test/depth.test.ts` (paid v12 run: hidden stash, tide, extract/die settlement).

## Next

- Enemies should avoid burning oil and lit kegs when pathing (now they walk through; exploitable but dumb-looking).
- Charge into a keg should light it; brute smash should chip cracked walls.
- Economic consumables (bombs crafted from iron+flask) so "use it now or sell it" becomes a real decision; needs ItemType/contract/bank-price changes and coordination with the crafting work.
- Per-kind tuning (sentry range, nest period), keyed doors/keys, more altar boons, enemy variety per floor depth.
- Sight radius is 4 tiles (BFS); consider a light-radius feature (braziers).
