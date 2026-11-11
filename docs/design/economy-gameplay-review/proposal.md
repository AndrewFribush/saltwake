# Saltwake: making the expedition and town worth returning to

Design proposal, 10 November 2026. Research and review only; not approved implementation or a claim of fun. User-established economic rules remain binding. This supplements the reviewed GDD, rather than replacing its settlement rules.

## The experience to aim for

A player sees that a maker's flooded vault has rich metal stock and charging enemies. They buy a potion from another player and choose a cheap push-capable club rather than risk their expensive sword. Inside, they maneuver a charger into spikes, find a useful weapon, and decide whether to use it now or bring it home for a waiting buyer. An optional cache tempts them away from a safe exit. They escape wounded, sell the metal into a funded order, and commission equipment for a different dungeon. The artisan sees a reason to make a particular batch. The maker sees where visitors enjoyed themselves, where they quit, and whether the edition covered its costs.

That is the target: decisions in town change decisions underground, and events underground create the next town visit. A loss should produce a specific lesson and a feasible next attempt. A successful business should reflect serving players, not exploiting a subsidy or confusing price display.

## What exists, and what is missing

Source inspection on this date; no new gameplay acceptance claimed.

- `packages/game/src/actions.ts`, `combat.ts`: explicit attack/guard/move/use turns, committed charger lanes, enemy-on-enemy/hazard damage, club damage 2 versus sword 3, armor reduction, one rest/blood-edge decision. Positioning exists, but weapon and run identities are narrow.
- `generation.ts`: extraction/continuation requires every enemy dead and reaching the exit. This prevents a genuine evade-and-extract strategy. Existing behavior is not a defect; changing it requires a deliberate rules version.
- `funded-layout.ts`: seeded connected chambers and chokepoints. Builder also supports authored layouts. Connectivity is useful but not evidence of interesting routes, readable difficulty or enjoyable layouts.
- `catalog.ts`: eight item types. Potions mainly differ in healing. `craft.ts` has three timing steps and a normal/fine result. Contract crafts two tonics from four inputs. The authoritative system exists; strategic production choices are thin.
- `starter-town.ts`: seeded player-maker fixture, fixed example stock/listings; not organic player demand. `matcher.ts` prioritizes fee within filters and returns three offers. No behavioral recommendation or reliable difficulty model.
- `Maker.tsx`: settled/pending fees, placement spend, attempts and feedback; explicitly excludes acquisition costs and is not net profit. Bank prices are reference sale prices and half-price buyback, subject to stock/budget, not a free liquid market.
- Existing authoritative inventory IDs, origin partition, reservations, restart recovery, escrow and fixed windows are foundations to preserve.

## Approaches considered

1. Action/Diablo direction: immediate spectacle and reflex mastery; requires animation, collision, input buffering and network reconciliation work. Too much replacement before discovering whether our economy makes play better.
2. Tactical expedition + merchant town (recommended): deterministic readable threats, combinatorial tools, authored challenges, choices about inventory and routes. Builds on current engine. Risk: becomes a solved puzzle unless encounters and tools interact.
3. Recettear/shopkeeper-first: negotiation, customers and retail growth carry the experience; dungeons mostly supply goods. Strong alternative, but would underinvest in the dungeon-making experience Andrew has emphasized.

This is my recommendation, not Andrew's selected final design. Do not implement before discussing the review.

## Modern design lessons worth borrowing

Use a mixture of recent exemplars and older best-in-class mechanics; newest does not mean best for this game. These are design interpretations, not evidence that borrowed mechanics will succeed here.

- Hades II: repeated attempts should reveal new situations and advance the player's relationship with the world. Borrow short in-run combinations and a return-to-town response. Avoid importing persistent damage upgrades that make wealthy incumbents categorically stronger. Official FAQ updated October 22, 2026 confirms repeated setbacks/accomplishments, new challenges and upgrade systems; it does not prove a particular retention effect.
- Caves of Qud: a small vocabulary with shared rules produces stories. Our first step is push + charger + spikes, not dozens of status systems. Its official page describes hybrid authored/procedural worlds and shared simulation.
- Albion Online: equipment is a playstyle and player-made supplies support expedition demand. Borrow functional specialization and replenishment, not guild territory, compulsory gathering, or its entire MMO economy.
- Meet Your Maker: makers need observed visitor behavior and replays to improve authored content. Explicitly reject its advertised reward-for-raider-death mechanic. Our incentive is attendance and repeat attendance.
- Into the Breach (established reference; official page blocked during this research): readable intent and repositioning create depth without hidden hit rolls. Proposed transfer, not a claim of current patch research.
- Moonlighter/Recettear (established reference; newer Moonlighter II source verification recorded separately): prepare → expedition → price/stock → reinvest. Do not turn inventory into a price-only optimization puzzle.

## Dungeon loop: first deepen decisions

### Combat vocabulary

Keep one action per turn and telegraphed deterministic outcomes. Proposed first equipment identities: club can shove into hazards but is poor raw damage; sword favors committed close combat. Start with only one new ability, shove, before adding reach weapons or shields. Exact distance, cooldown and boss resistance need fixture tuning; never allow endless cost-free stun loops. A larger next slice could add one telegraphed ranged enemy, forcing movement and line-of-sight decisions. Don't add it until current two enemies produce interesting encounters with shove.

Show committed threat tiles, action cost, guard scope, enemy recovery and why a hit occurred. No surprise rule changes between practice and paid editions. A concise action replay/death explanation should identify the decisive mistake. Threat visibility must not reveal unexplored enemies.

### Exploration and escape

Replace random walls as the main source of variety with authored encounter patterns combined under constraints: a safe approach, optional risky cache, a controllable chokepoint and an exit decision. Use a small branch within the existing tile floor; do not immediately build a huge overworld or room graph.

Prototype a designated extraction tile usable without exterminating the room. Proposal: one visibly telegraphed escape action that takes a turn, with success only if the player survives the response. Resolve player action → enemy/hazards → terminal extraction, so it cannot evade an already-committed hit for free. Old paid runs retain old rules. Clearing all enemies can remain an optional achievement. No forced pursuit timer initially: add pressure only if tests show indefinite safe farming or tedious kiting.

Offer at most two coherent run modifiers early (e.g. push gains range versus guarding improves next strike), with costs/tradeoffs. These are temporary abilities, not tradeable assets or unfunded reward generation. Equipment choices and modifications must not erase each other's identity. Every economically owned find is funded/reserved before admission, including consumables used during the run. No extra loot may be minted by procedural generation.

### Loot has competing uses

Goods should be worth carrying for use, sale, manufacture or commissioning a dungeon. Retain six slots for the first experiment; pressure comes from useful alternatives, not clicking stacks endlessly. Show actual current buy offers separately from reference value. A potion consumed to survive is a meaningful loss of sellable stock. Reveal aggregate advertised treasure publicly, not undiscovered item locations or future random assignments.

### Loss and mastery

Death keeps established gear forfeiture. Knowledge, recipe familiarity, discovered lore and maker relationships can persist without granting passive combat power. Return directly to storage/re-equipping in the fixed inspector. Show the exact fee, consumed goods, lost gear and causes. Existing bounded NPC work can help a broke player; its finite subsidy must be shown. Don't call three subsidized jobs a sustainable recovery economy. Unlimited free practice remains separate from transferable rewards.

## Economy: reasons to supply each other

### Start with demand, not a larger catalog

Make existing healing useful across different tactical plans; then add one functional consumable only if the combat prototype supports it. Add a second useful recipe (candidate: a shove tool or tactical consumable) only after observing demand. Artisan choice should include what batch to make, quality target, costs, stock and buyer, while keeping Andrew's per-batch minigame. Improve the current three nearly identical waits with a short deterministic recipe-specific sequence and legible feedback. A timing game is automatable; do not sell it as proof of human labor or anti-bot security.

Player buy orders/commissions are a high-value next economy feature: buyer escrows a maximum unit price and quantity; artisan can see committed demand before committing inputs. Exact quality/type, partial fill, remaining escrow, expiration, cancellation, double-fill protection and restart recovery must be specified and tested. Start with one item type and immediate delivery; defer open-ended promises and delayed contracts.

Low population needs a bounded NPC backstop: finite posted orders and stock, with replenishment rules visible. Do not fake human customers. Seed/demo accounts must stay labeled. Separate coin transfers, item consumption/transformation, inventory accumulation and actual coin issuance. Goods going to the bank are transfers, not destruction; reselling them can crowd out artisans. Bank should provide baseline recovery/supplies with visible limits; specialist player goods should have a reason to exist. Do not add arbitrary constant durability attrition to manufacture demand before checking potion consumption and actual player choices.

### Maker business

Before funding, show fee, opening period, available complete attempts and cost exposure. At results, distinguish original funding, refreshes, reserved stock, available stock, extracted, consumed and banked goods. Existing public original/current value should gain these distinctions, not disappear.

Accounting proposal:

- Closed-edition maker cash contribution = settled fees minus placement/publication charges minus actual acquisition cost of all committed treasure/refreshes minus other explicit edition expenses. Full committed treasure is expensed because residual stock goes to the bank, never back to the maker. Pending fees are not realized income. Do not also expense extraction or bank transfer of the same funded goods.
- For self-crafted stock, disclose material cost and allocated fees separately from labor time. For gifted/seeded/unknown-cost goods show unknown or zero-cash-cost provenance plus a separate replacement-value scenario; never silently call reference value cost basis.
- Open-edition result is provisional. Show outstanding fees/operations and exclude unresolved events from realized profit.
- Adventurer cash delta and inventory delta are separate. Unrealized finds are not cash earnings. Merchant margin uses actual sale receipts and recorded lot cost; no double counting of purchases plus consumed cost in the same profit metric.

Cheap prices alone should not determine discovery. Show verified starts, finishes, depth, deaths, voluntary returns, ratings with sample counts, and opening/capacity status. Do not label tiny samples as reliable difficulty. Player-selected tags remain self-reported. Offer exploration space for new makers and zero-treasure attractions; don't make treasure value the ranking objective. Version layouts; fees and terms accepted at admission remain fixed for that run.

The death incentive is not solved by ownership rules: death returns unconsumed dungeon treasure to stock, enabling more admission income. Also, the bank owns death forfeitures and leftovers. Publish rules, outcome evidence and edition versions; forbid changing active difficulty or secretly manipulating matchmaking to raise forfeitures. No universal 'kill-rate success' dashboard. Test whether players choose to return, not just whether the maker can profit. A replay cannot certify fairness or prevent collusive ratings; maintain these limits explicitly.

## Concrete first experiment, not an everything backlog

A. One compelling practice expedition: two floors, a genuine optional route, shove/charger/spike interaction and escape without a full clear. Compare two loadouts and two encounter arrangements. No economic mutations. Record causes of damage, decisions and repeat attempts. Andrew's old gameplay rejection remains open until new play evidence.

B. One connected trade cycle: maker purchases artisan goods, funds an edition, adventurer prepares and plays, extracted stock is sold/used/crafted, maker gets fees and a cost-aware result. Use multiple clearly labeled local profiles. One filled player order is enough to prove the missing demand path; not enough to prove a market. Carry the same authoritative item IDs throughout.

C. Maker iteration: an action replay or small room-level summary shows one frustrating choke; maker creates a new version and tests it. Show repeat attendance and sample sizes without a 'kills are revenue' incentive. Keep one no-treasure edition in playtests so enjoyment is tested separately from payout.

D. Only after A–C: second recipe, extra enemy, shop identity/provenance, small collection goals and event/social ambitions. Houses/luxuries/dances remain valid longer-term desires, but won't rescue a weak expedition.

Do not claim these all fit the original contest deadline. First implementation decision should choose A's exact slice, then estimate B from its actual protocol changes. No real money, deployment or testnet action is part of this proposal.

## Validation that could prove us wrong

Instrument turns and transactions without changing their authority. Tests establish correctness; humans establish interest.

- Combat fixtures: predicted threat matches resolution; shove collisions and guard are consistent; extraction cannot avoid response; replay/reconnect cannot duplicate actions or loot; existing source-origin settlement remains exact.
- Procedural/authoring checks: paths, threat-free spawn, bounded encounter budget, optional route, exit access, funded rewards and deterministic seed reproduction. Connectivity is insufficient to certify difficulty or fun.
- Local economic scenarios: 1/5/20 active profiles; no-new-user period; high/low extraction and potion use; demand slump; drained bank budgets; maker stock depletion; concurrent fills and retries. Check coin conservation except explicit grants, item lifecycle, capacity reservations and restart recovery. Bots model scenarios, not demand.
- First formative human test: 5–8 people, roughly three attempts each, record coaching and prior familiarity. Ask why they bought a loadout, how they died, why they extracted/continued, and whether they freely want another attempt. Compare the new prototype against the current one with order varied. This is directional evidence, not statistically reliable retention.
- Proposed pass signals: most can explain a tactical change between runs; loss feels predictable after explanation; several voluntarily request another attempt without payout prompting; at least two viable preparation choices are observed; participants can complete the trade cycle without developer intervention. Log contrary cases, not just success clips.
- If buyers only care about payouts, the game is failing as entertainment. If everyone always buys the same kit, item differentiation failed. If every maker optimizes slaughter, discovery/fairness failed. If artisans can only sell to subsidies, player demand is unproven. If recovery dominates all earnings, the labor faucet is poorly bounded.

## Current sources, read through Aside

Accessed 2026-11-10:
- https://www.supergiantgames.com/blog/hades2-faq/ — live FAQ updated 2026-10-22; launch/platform facts and replay framing.
- https://cavesofqud.com/ — simulation/authoring details. Page also contains stale release wording; do not derive newest patch facts from it.
- https://albiononline.com/home — player production, trade, gear identity; live news dated today. Not a verified analysis of current balance.
- https://meetyourmakergame.com/game/ — building, traps, guard patrols, replays, explicit rewards from raider deaths.
- https://11bitstudios.com/games/moonlighter-2-the-endless-vault/ and https://subsetgames.com/itb.html — Cloudflare verification, no mechanics content verified. https://moonlighterthegame.com/ returned ERR_NAME_NOT_RESOLVED.

Scope: focused contemporary/reference review, not an exhaustive survey of every 2026 release or hands-on playtest. No invented 'latest meta' claim.
