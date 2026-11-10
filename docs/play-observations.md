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
