# First two-room gate — M08

Builder-directed scripted play only; zero independent players tested this version. The user's earlier "works as basic" described the preceding one-room build, not this one.

Observed three deterministic policies, not a playtest sample:

| Policy | Health at first exit | After second fight |
|---|---:|---:|
| Rush, club only, skip gear/potions, attack directly | 6 | 2 |
| Same rush with starting armor | 8 | 5 |
| Collect sword/armor; avoid charge; exploit spike position | 9 | 9 |

The third route was replayed through actual Aside clicks (32 accepted actions, extracted). The first two were engine simulations. Saved commands/traces: scripts/play-trace.ts, scripts/compare-loadouts.ts, docs/play-trace.json, docs/loadout-comparison.json. No claim these policies are optimal or representative of humans.

Concrete decisions: at the first exit, the club-only player can keep surviving town stock by extracting, use a tonic before risking the hall, or continue with 6 HP and no armor. The prepared route gains 3-damage sword and damage reduction, but carries those provisional finds onward. In the hall, drawing the boar onto spikes saved an attack; attacking it before its turn when it had 3 HP was better than repeatedly dodging. The first trace policy failed to recognize that kill opportunity and oscillated safely; corrected the policy, not the game.

Tuning defaults: rat 4 HP / 3 hit; boar 6 HP / 4 charge, one recovery turn; spikes 3 damage, alternate armed/safe after accepted turns. Armor before guard. Charges stop at the first creature, including other enemies. Spikes resolve after enemy movement. No balance change justified yet.

Gate decision: REPAIR / OBSERVE before expanding to four modules (M25). Two rooms demonstrate tactical consequences, but the first-room free sword/armor detour is an obvious choice, there is little time pressure, and stocked potions may make the risk decision too forgiving. Need manual novice observation and encounter tuning before saying this is fun. Independent contract smoke work can proceed. M08 remains in progress; this report does not claim its human-play requirement complete.

## November 10 repair gate

Andrew's assessment of the preceding two-room build: **“No, it feels very basic, no roguelike.”** M08 stays open; this overrides any inference of success from accounting tests.

Repair implemented without claiming four-room content acceptance: 13×9 seeded connected maps; seeded treasure/encounter placement; limited visibility and remembered terrain; dormant distant enemies; tonic-versus-armor starting kits; one first-floor shrine choice (heal 4, or sacrifice 3 health for +1 damage); same-seed retry and fresh-seed descent. Automated generation checks validate all floor/exit reachability across 100 seeds. Browser check: 117 tiles, 95 initially unexplored in the observed seed; movement revealed tiles and spent one turn; armor kit visibly equipped armor with no starting tonic. No independent player has yet evaluated this revision. Economic paid runs still use the fixed maker-funded layouts; do not present practice generation as the paid edition generator.

Craft practice builder-directed browser observations (scripted clicks, not an independent human fatigue sample): first batch recorded 6236/6230/6230 ms, all misses; early batch 1732/1737/1740 ms, all misses; third batch 5441/5430/5953 ms, two hits then one miss. All three correctly yielded normal quality. Aside bridge latency added roughly 0.8 seconds and varied; these samples establish visible timing feedback and correct miss handling, not human difficulty. The 700 ms target band and three-input batch need actual player assessment. Six deterministic score tests cover exact fine/normal boundaries; server tests ignore client-reported timing/tier.

## Saltwake world iteration

The newer paid version-2 game now shares seeded exploration with the economy. It has connected chambers/corridors, fog, persisted funded loot and a town return. The preceding statement that all paid play is fixed-layout is historical; V1 remains fixed for compatibility. See [world-gameplay-verification.md](world-gameplay-verification.md) for actual browser play, recovery-work observations and limitations. No new independent human verdict has been received; M08 remains open.
