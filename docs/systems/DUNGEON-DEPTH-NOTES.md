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

**Builder**: generator seed and a Treasure toggle (no-treasure drafts publish without funding). Features inspector (place/configure/remove, tide), six enemy kinds in Encounters with summaries, costs include features, guide pages generated from the catalog, "Generate starting floors" (seeded rooms + hidden stash + hazards + mixed enemies, fully editable, undoable). Drafts that use no v12 component still publish as rules v11, so they work on the currently deployed testnet contract.

**Run UI**: CSS sprites for the new enemies and features, lit kegs/burning oil animate, blast flash, hatch markers, stun marks, supplies/aiming, spring/altar buttons, tide countdown and boons in the status line, readable log names ("powder crab #1").

## Contract

`contracts/economy`: Enemy enum gains Archer/Bomber/Brute/Nest (appended, Borsh-safe), rules_version 12 accepted with `custom12:` modules (≤6144 bytes), feature schema/range/placement/connectivity checks, feature costs (1, or 2 for spring/altar/cache), ≤24 features/floor and ≤128 total. **The testnet contract (saltwake-20261110.testnet) needs a redeploy before v12 editions can be published there.** v11 publishing and all older editions keep working without it.

## Tests

`packages/game/test/depth.test.ts` (mechanics, validation, blueprint, generator), `tests/contract/depth.test.ts` (WASM v12 validation and costs), `apps/server/test/depth.test.ts` (paid v12 run: hidden stash, tide, extract/die settlement).

## Play observations (agent playtests, not human evidence)

- Browser, local sandbox: the proprietor generated seed 3, published it as rules v12 (66 coins charged, wallet 89 → 23); the delver paid 1 coin, entered, broke the cracked wall into the hidden stash, collected bombs and bombed the pursuer that followed. Screenshots in `docs/evidence/dungeon-depth/`.
- Text replays of generated seeds produced the intended emergent moments: stepping away from a lit powder crab let the pursuer walk into the burst; the burst lit a keg and oil, whose telegraphed blast then punished standing still. Two pursuers in the open are deadly for careless play; doorways, shoves and supplies matter.
- A naive scripted bot that runs at the exit dies on most generated floors; that measures the bot more than the game. Human difficulty tuning is still open.
- Fixed during play: raw socket IDs in logs ("floor-0-slot-1 blast hits") replaced by readable names; large v12 offers showed 37 rule pages, now grouped by kind; the aim prompt lingered after a throw.

## Second pass (after merge da42e28)

- Builder shows real art: enemy sprites, spikes, features and a loot mark on the map tiles; Encounters and Features show a preview tile with stats and plain-language behavior; Tuning placeholders show each kind's actual defaults.
- Tuning from play: powder crab burst 5 → 4 (it halved the player too often); depth runs see 6 tiles instead of 4 (open rooms were unreadable); a sentry only aims from a tile the player can see (no shots from darkness). Oil art no longer looks like a chasm. Threat tiles are coloured by kind: gold bolt lines, red blast zones, orange brute sweeps. Defaults only changed before any v12 edition exists outside the local sandbox.
- Hand-built test: a one-room "keg gallery" made through the builder UI (kegs, oil line, cache, chasm, sentry, crab, pursuer) rehearsed fine.
- Economic bombs/darts: not started. They need ItemType, bank prices and a crafting recipe, which sit in the playtest agent's town/crafting area.

## Third pass (after merge b54ced9)

- Run screen: the turn log lists the last 8 events, newest first and highlighted (it used to page 2 lines at a time). A run-end summary says what killed you (tracked as `killedBy`: enemy, blast, fire, spikes or the tide), the floor and turn, and lists goods by outcome with the reason: carried out, gear kept, gear lost to the bank, left in the dungeon, used up. Paid runs use the confirmed settlement, with unseen items counted; rehearsal says nothing really moves.
- Generator: rooms up to 8×5 and up to six rooms; pillared halls and notched rooms in the middle; one themed room per floor most of the time (a keg gallery guarded by a crossbow sentry, or an oil-slicked hall with a keg at the edge). Rewards per floor grow with depth (1, 2, 3 plus the hidden stash). Tide timing scales with the floor's open area (about 0.45 turns per tile, less on deeper floors, at least 25). 300 seeds generate without failure.
- Generator presets (from the playtest lane's flag that the old button made an 84-coin, 7-goods dungeon): Small (default, 1 floor, 2 enemies, 1 treasure spot, cracked wall + one feature, no tide: 9–11 coins, median 10), Medium (2 floors, ~31–38 coins, ~2 goods) and Large (3 floors, ~78–111 coins, ~8 goods). The size menu shows the estimated coins and goods for the pending seed; a line compares them with the player's coins and owned goods. Fit my budget picks the largest preset (then without treasure) that fits, or explains that even Small is too expensive. Trimming always keeps cracked walls so hidden rooms stay reachable.
- Dev note: the merged vite config ignores `**/.claude/**`, so a dev server started from this worktree does not hot-reload; restart it after edits.

## Balance harness (`npm run sim:depth -- [seeds] [kit]`)

`scripts/depth-sim.ts` plays generated drafts per preset with three bots through the real rules engine (rehearsal state, club + tonic kit, random rewards sampled as tonics): **cautious** (leaves with the first find, at 6 health, after 60 turns on a floor, or when the tide is close), **greedy** (loots everything visible, explores, descends while above 6 health, leaves on low health or tide), **reckless** (rushes stairs, always descends, ignores telegraphs). Bots fight melee intents, dodge area threats toward their goal, press through when dodging makes no progress, bomb visible enemies, drink at low health, and bump cracked walls.

What the harness found and changed:
- A generator bug: kegs (and chasms) could seal the only corridor, stranding players behind a keg they had to blow up next to themselves. Kegs that are needed for connectivity are now dropped. Stalled runs fell from 20–30% to 0–10%.
- Tide was the top killer for greedy play. Tide turns are now about 0.8 per open tile (at least 35), and the log warns at 10 and 5 turns before the flood as well as the final turn.

Results, 60 seeds each:
```
Saltwake depth simulation · 60 seeds per preset × policy · kit club
small  cautious died   2% out  93% stalled   5% · loot out 0.75 + drunk 0.03 of 1.0 funded · turns 53 · floor 1.0 · tide 0 · causes sentry 1
small  greedy   died   2% out  95% stalled   3% · loot out 0.85 + drunk 0.07 of 1.0 funded · turns 47 · floor 1.0 · tide 0 · causes sentry 1
small  reckless died   8% out  90% stalled   2% · loot out 0.23 + drunk 0.00 of 1.0 funded · turns 26 · floor 1.0 · tide 0 · causes sentry 4, powder crab (blast) 1
medium cautious died  10% out  90% stalled   0% · loot out 0.55 + drunk 0.17 of 2.0 funded · turns 34 · floor 1.0 · tide 0 · causes sentry 4, pursuer 1, Spikes 1
medium greedy   died  30% out  70% stalled   0% · loot out 0.40 + drunk 0.78 of 2.0 funded · turns 69 · floor 1.8 · tide 3 · causes sentry 5, pursuer 4, the rising tide 3, Spikes 2
medium reckless died  75% out  23% stalled   2% · loot out 0.00 + drunk 0.20 of 2.0 funded · turns 42 · floor 1.8 · tide 0 · causes sentry 12, powder crab (blast) 9, pursuer 9, charger 7
large  cautious died   5% out  90% stalled   5% · loot out 0.73 + drunk 0.20 of 8.2 funded · turns 69 · floor 1.0 · tide 0 · causes pursuer 1, powder crab 1, Keg (blast) 1
large  greedy   died  60% out  30% stalled  10% · loot out 0.43 + drunk 2.65 of 8.2 funded · turns 166 · floor 2.2 · tide 7 · causes charger 8, the rising tide 7, brute 6, pursuer 5
large  reckless died  98% out   0% stalled   2% · loot out 0.00 + drunk 0.22 of 8.2 funded · turns 45 · floor 1.7 · tide 0 · causes sentry 15, pursuer 13, charger 11, powder crab (blast) 8
```
Reading: Small is survivable for careful play (2% deaths) and still nicks reckless play; Medium punishes greed (30%) and recklessness (75%); Large kills most greedy (60%) and nearly all reckless runs, while cautious players can still take floor-one loot home. Crossbow sentries are the top killer on Small/Medium, chargers and brutes on deep Large floors. "Drunk" counts found tonics the bot used; it is not loot loss.

## Next

- Done: walking enemies avoid burning oil and lit-keg blast zones; a charge that ends against a keg lights it. A brute's sweep also breaks cracked walls it covers.
- Economic consumables (bombs crafted from iron+flask) so "use it now or sell it" becomes a real decision; needs ItemType/contract/bank-price changes and coordination with the crafting work.
- Per-kind tuning (sentry range, nest period), keyed doors/keys, more altar boons, enemy variety per floor depth.
- Sight radius is 4 tiles (BFS); consider a light-radius feature (braziers).

**Next step:** watch a human play Small and Medium; if sentries still dominate deaths, lower their alert range or damage on floor one of generated drafts.
