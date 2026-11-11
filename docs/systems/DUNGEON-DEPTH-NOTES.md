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

## Fourth pass

- Readable enemy names in every rule version: log lines and attack buttons now say "pursuer #0" (authored dungeons) or "pursuer (sword)" (older socket IDs) instead of raw IDs. Rules are unchanged; only text.
- Floor-one sentries softened: crossbow sentry alert distance 6 → 5. Harness, 60 seeds, cautious bot: deaths Small 2%, Medium 5%, Large 13%, with no sentry deaths on Small or Medium (Medium had 4 before); spikes and pursuers now cause most careful-play deaths.

## Rules v13: keys, locked doors, pressure plates

- **Key** (colour): step on it to pick it up; keys persist across floors for the run. **Locked door** (colour): blocks movement and sight; bump it holding a matching key to unlock it for good (the key is used). Every lock colour needs a key of that colour somewhere in the dungeon (shared validation and contract). Locks count as passable for reachability, like cracked walls. **Pressure plate** (channel): the channel is on while any creature stands on it. Plates count as signal sources for door and exit wiring, so a gate can be held open by luring an enemy onto its plate. Levers/gates and one-way passages already exist (switches + doors in v10, directed connections in v6), so v13 adds only what was missing.
- Versioning: `custom13:` modules, rules_version 13 (v12 rejects these kinds, older editions unchanged). Builder publishes the lowest version that can express a design (11, 12 or 13). Costs: 1 coin each. Contract: schema, colour/channel names, lock-key network, plate wiring, costs; **needs a testnet redeploy like v12**.
- Builder: Features panel lists Key ⚷, Locked door ⊠ and Pressure plate ▭ with explanations and a text field for colour/channel; simple CSS art on map and board; run status shows keys held.
- Generator: Medium and Large put a locked vault (brass lock + key elsewhere) on deeper floors in place of the cracked-wall stash (45/50 Large drafts have one). Harness bots collect keys and open locks.
- Tests: game (keys/locks/plates, v12 rejection), contract (v13 acceptance, costs, rejections), server (paid run: key opens a vault, funded tonic extracts).

Harness after v13, 60 seeds:
```
Saltwake depth simulation · 60 seeds per preset × policy · kit club
small  cautious died   2% out  97% stalled   2% · loot out 0.75 + drunk 0.07 of 1.0 funded · turns 33 · floor 1.0 · tide 0 · causes pursuer 1
small  greedy   died   2% out  95% stalled   3% · loot out 0.85 + drunk 0.10 of 1.0 funded · turns 46 · floor 1.0 · tide 0 · causes pursuer 1
small  reckless died   5% out  93% stalled   2% · loot out 0.20 + drunk 0.02 of 1.0 funded · turns 26 · floor 1.0 · tide 0 · causes powder crab (blast) 2, Keg (blast) 1
medium cautious died   5% out  92% stalled   3% · loot out 0.65 + drunk 0.13 of 2.0 funded · turns 54 · floor 1.1 · tide 0 · causes charger 1, Spikes 1, pursuer 1
medium greedy   died  27% out  72% stalled   2% · loot out 0.53 + drunk 0.78 of 2.0 funded · turns 79 · floor 1.8 · tide 1 · causes charger 8, pursuer 5, Spikes 1, rat 1
medium reckless died  78% out  22% stalled   0% · loot out 0.02 + drunk 0.10 of 2.0 funded · turns 31 · floor 1.8 · tide 0 · causes charger 12, pursuer 10, powder crab (blast) 9, sentry 8
large  cautious died  15% out  78% stalled   7% · loot out 0.65 + drunk 0.13 of 8.3 funded · turns 76 · floor 1.0 · tide 0 · causes Spikes 4, pursuer 3, sentry 2
large  greedy   died  52% out  42% stalled   7% · loot out 0.40 + drunk 2.22 of 8.3 funded · turns 135 · floor 2.1 · tide 2 · causes pursuer 7, sentry 6, charger 4, Spikes 4
large  reckless died  98% out   2% stalled   0% · loot out 0.00 + drunk 0.23 of 8.3 funded · turns 36 · floor 1.8 · tide 1 · causes pursuer 15, sentry 15, charger 9, Keg (blast) 8
```

## v13 hand-build and themes

- Browser: built a floor by hand in the builder (wall line with a doorway, brass key, brass lock in the doorway, pressure plate wired to a gate on channel `gate`) and rehearsed it: the key is picked up (status shows "Keys: brass"), bumping the lock without a key does nothing, with the key it unlocks and the next step walks through; the gate panel reads closed until the plate is occupied. Awkward part found: the look-feel feature layer had no art for keys, locks and plates (they were invisible); they now fall back to simple CSS shapes until look-feel skins them.
- Generator: deeper Medium/Large floors now pick between a locked vault (key elsewhere) and an **ambush stash**: the hidden room has an open gate; the first step inside trips a switch that slams it shut, a pursuer (brute on floor 3) guards the treasure, and a lever at the back reopens the gate. Built from existing switches/doors, so it publishes at whatever version the rest needs. Large: 42/60 drafts have a vault, 18/60 an ambush. Harness bots use levers when trapped.
- Way-out cue (QA: a delver wandered 300 turns on a cleared floor): whenever no enemy is in sight, the run panel says where the stairs are ("The way out: stairs 3 south, 5 east"), that you are on them, or that they are not found yet; once seen, the stairs tile pulses green.
- Not yet: a plate-held puzzle gate in the generator (luring reliably is hard to guarantee solvable), and a publish-and-play-as-another-profile pass for v13.

Harness, 60 seeds:
```
Saltwake depth simulation · 60 seeds per preset × policy · kit club
small  cautious died   2% out  97% stalled   2% · loot out 0.75 + drunk 0.07 of 1.0 funded · turns 33 · floor 1.0 · tide 0 · causes pursuer 1
small  greedy   died   2% out  95% stalled   3% · loot out 0.85 + drunk 0.10 of 1.0 funded · turns 46 · floor 1.0 · tide 0 · causes pursuer 1
small  reckless died   5% out  93% stalled   2% · loot out 0.20 + drunk 0.02 of 1.0 funded · turns 26 · floor 1.0 · tide 0 · causes powder crab (blast) 2, Keg (blast) 1
medium cautious died   5% out  92% stalled   3% · loot out 0.63 + drunk 0.17 of 2.0 funded · turns 53 · floor 1.1 · tide 0 · causes Spikes 1, rat 1, pursuer 1
medium greedy   died  33% out  65% stalled   2% · loot out 0.30 + drunk 1.03 of 2.0 funded · turns 86 · floor 1.8 · tide 8 · causes the rising tide 8, rat 3, pursuer 3, charger 2
medium reckless died  75% out  25% stalled   0% · loot out 0.03 + drunk 0.13 of 2.0 funded · turns 35 · floor 1.8 · tide 1 · causes powder crab (blast) 10, pursuer 9, charger 8, sentry 8
large  cautious died  15% out  78% stalled   7% · loot out 0.67 + drunk 0.12 of 8.4 funded · turns 75 · floor 1.0 · tide 0 · causes Spikes 4, pursuer 3, sentry 2
large  greedy   died  62% out  32% stalled   7% · loot out 0.18 + drunk 2.23 of 8.4 funded · turns 131 · floor 2.0 · tide 6 · causes pursuer 6, the rising tide 6, sentry 5, charger 5
large  reckless died 100% out   0% stalled   0% · loot out 0.00 + drunk 0.23 of 8.4 funded · turns 35 · floor 1.8 · tide 0 · causes pursuer 18, sentry 11, charger 11, powder crab (blast) 9
```
Greedy deaths rose a little (Medium 27→33%, Large 52→62%), mostly from tide while trapped in ambushes; still in the intended range.

## Ambush fix and smarter bots

- Real design bug found by the harness: the ambush trip switch sat on the entry tile, so walking back out re-tripped it and slammed the gate again — the room could never be left. The trip now sits one step inside (rooms are at least 2 wide, so the way out can step around it) and the entry tile is kept clear.
- Bots now pull a reachable lever when a gate is closed and nothing else is worth doing, and careful bots avoid stepping on trip switches.
- Removed the temporary v13 CSS fallback inside the shared feature layer: look-feel's sprites (b46ed1c) now draw keys, locks and plates on the board. The builder's own preview tiles keep the simple shapes.

Harness, 60 seeds:
```
Saltwake depth simulation · 60 seeds per preset × policy · kit club
small  cautious died   2% out  97% stalled   2% · loot out 0.75 + drunk 0.07 of 1.0 funded · turns 33 · floor 1.0 · tide 0 · causes pursuer 1
small  greedy   died   2% out  95% stalled   3% · loot out 0.85 + drunk 0.10 of 1.0 funded · turns 46 · floor 1.0 · tide 0 · causes pursuer 1
small  reckless died   5% out  93% stalled   2% · loot out 0.20 + drunk 0.02 of 1.0 funded · turns 26 · floor 1.0 · tide 0 · causes powder crab (blast) 2, Keg (blast) 1
medium cautious died   5% out  92% stalled   3% · loot out 0.63 + drunk 0.15 of 2.0 funded · turns 54 · floor 1.1 · tide 0 · causes Spikes 1, rat 1, pursuer 1
medium greedy   died  22% out  77% stalled   2% · loot out 0.45 + drunk 0.88 of 2.0 funded · turns 82 · floor 1.8 · tide 0 · causes pursuer 5, sentry 3, rat 3, Spikes 1
medium reckless died  75% out  25% stalled   0% · loot out 0.05 + drunk 0.13 of 2.0 funded · turns 35 · floor 1.8 · tide 0 · causes sentry 10, powder crab (blast) 10, pursuer 9, charger 8
large  cautious died  15% out  78% stalled   7% · loot out 0.67 + drunk 0.12 of 8.4 funded · turns 75 · floor 1.0 · tide 0 · causes Spikes 4, pursuer 3, sentry 2
large  greedy   died  57% out  37% stalled   7% · loot out 0.23 + drunk 2.05 of 8.4 funded · turns 130 · floor 2.0 · tide 3 · causes brute 6, charger 5, pursuer 5, Spikes 5
large  reckless died 100% out   0% stalled   0% · loot out 0.00 + drunk 0.23 of 8.4 funded · turns 35 · floor 1.8 · tide 0 · causes pursuer 17, charger 12, sentry 11, powder crab (blast) 10
```
Greedy tide deaths on Medium went from 8 to 0 (they were ambush traps); greedy deaths Medium 22%, Large 57%.

## v13 published and played (local sandbox, browser)

- The delver hand-built "Brass and the gate" in the builder (wall with a brass-locked doorway, a brass key, a pressure plate on channel `gate` wired to a gate) and opened it: 5 coins (base 2 + key, lock, plate), rules v13.
- Another profile (the wayfarer) paid 1 coin and entered. Standing on the plate turned channel `gate` on and the gate read open ("Door gate: open", portcullis raised); keys, locks and plates drew with look-feel's sprites. Screenshot: `docs/evidence/dungeon-depth/v13-paid-plate-holds-gate-open.jpg`.
- Friction seen while testing (not my lane, reported): opening the offers pager is easy to confuse with each offer's own detail pager (both say "Next →"), and a mis-click can pay into the wrong dungeon.

## Route solver and the lure puzzle

- `packages/game/src/solver.ts`: bounded breadth-first search over real game states (the same deterministic engine as play) using moves, waits and shoves; enemies, hazards, plates, doors and keys resolve exactly as in play. It returns a shortest action list, or proves a goal unreachable when the search space is exhausted, or reports that it was truncated.
- Lure puzzle proven: a vault behind a gate wired to a plate placed two tiles out from the gate's approach. Standing at the approach and shoving the pursuer onto the plate pins it for one turn, long enough to step into the gate; the solver finds this (the solution contains a shove), and proves the same room without the plate unsolvable. Test in `packages/game/test/depth.test.ts`.
- Builder Check tab: "Check route to the stairs" runs the solver on the selected floor with the chosen test kit and reports turns needed (and whether a shove is required), a proof of no route, or that the floor was too big to check exhaustively.
- Not yet: the generator does not emit lure rooms (needs geometry with the plate in line with the approach and a separate way out of the vault), and the one-way drop into a sealed arena.

## Route check in the browser

- Clicked "Check route to the stairs" on a generated Small floor (seed 3: reachable in 15 turns, about 1.5 s) and on a hand-built floor whose only doorway is a gate held shut by a clear-switch (proven unreachable, 96 positions).
- Awkward bits fixed: a stale result stayed on screen after edits (now cleared on any edit); the full search is too slow to run automatically on floors with enemies, so opening the Check step now runs a quick structural check with enemies removed (capped at 4,000 positions): it says the stairs are reachable "if the enemies are dealt with", or proves them unreachable because of gates, plates, switches or locks. The button still runs the full search with enemies.

## Next

- Done: walking enemies avoid burning oil and lit-keg blast zones; a charge that ends against a keg lights it. A brute's sweep also breaks cracked walls it covers.
- Economic consumables (bombs crafted from iron+flask) so "use it now or sell it" becomes a real decision; needs ItemType/contract/bank-price changes and coordination with the crafting work.
- Per-kind tuning (sentry range, nest period), keyed doors/keys, more altar boons, enemy variety per floor depth.
- Sight radius is 4 tiles (BFS); consider a light-radius feature (braziers).

**Next step:** generator lure room filtered by the solver (and a separate vault exit), then the one-way drop into a sealed arena.
