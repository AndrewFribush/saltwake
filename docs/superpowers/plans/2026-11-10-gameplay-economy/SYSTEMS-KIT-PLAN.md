> Execution authorized by Andrew. The fresh authoritative product brief is [docs/systems/BRIEF.md](../../../systems/BRIEF.md). This plan is subordinate to it; old paused/approval wording below is historical.

# Saltwake: game system, creator kit and player economy

Status: executing under Andrew's subsequent ‘Execute’ instruction. This supersedes MERGED-PLAN.md. Current verified delivery status lives in docs/systems/PROGRESS.md; unchecked tasks here remain open unless explicitly accounted for there.

## Product definition

We are making a game people can build and operate inside, not supplying a campaign of our own adventures.

The core product is a reusable dungeon rules engine, a practical dungeon construction kit, and the civilian economy that supports player-created attractions. Creators assemble spaces, encounters, rewards and terms; adventurers choose and play those creations; artisans and merchants supply them. The operator provides the rules, bank/NPC economy and central issuance, not the player dungeon-making businesses.

A fixed test layout is a disposable engineering fixture. It is never the product milestone, default content strategy or proof that players have expressive tools. Success means independent creators can make materially different enjoyable dungeons without an engineer changing code, and those dungeons support meaningful adventurer and business decisions.

## What remains fixed

- Tile/grid world and interiors; walk into doors; fixed windows; no page scrolling.
- Makers fund their rewards, receive ordinary admission fees and can replenish stock. Central issuance validates/publishes their creations.
- Town gear is lost to the bank on death; unconsumed dungeon-origin loot returns to the pool; consumed items remain spent. Closure leftovers go to the bank, not maker refunds.
- Fixed rewards and funded random rolls, multiple funded copies/concurrent reservations, and in-run use of found goods.
- No-treasure attractions are legitimate. Artisans work per batch and sell finite stock at chosen prices. Materials can be sourced cheaply from the NPC economy; no compulsory mining minigame.
- Transparency: time, extracted loot, outcomes, denominators and sample sizes, distinct from cash earnings.
- Preserve versioning, origin/ownership, escrow, quotes, reserves, idempotency and recovery.
- Local work only; no paid calls, testnet, production, deployments or unsolicited recruitment messages.

## Design principle: a vocabulary, not a prescribed adventure

Every new mechanic must answer two questions: what interesting decision does it give the player, and what expressive control does it give the maker?

Start from general composable dungeon systems and the combinations the kit must support. Creator intentions can expose missing controls, but are not a prerequisite or a whitelist. Do not derive the vocabulary from the stopped scenario. Recent shove/escape work earns a place only if the capability audit and creator needs justify it. We evaluate combinations made by creators, including combinations we did not script.

The first kit should expose bounded, understandable components rather than arbitrary scripts or an overwhelming catalog. Provide a small complete vocabulary, verify its interactions, and expand where creator sessions reveal missing expressive power. Do not add mandatory fuel or change death rules to manufacture economic demand.

## Architecture and contracts

1. **Rules engine:** versioned actions, targeting, movement, damage, statuses, intent, hazards, inventory and terminal outcomes. Definitions drive both authoritative execution and player explanations.
2. **Content definitions:** data describing floors, entrances/exits, encounter placements, behavior parameters within safe bounds, triggers and reward sockets. Builders produce these definitions; the server validates the same schema. No secret exceptions for operator-authored content.
3. **Creator tools:** draw, place, configure, inspect, validate, rehearse, revise and publish from fixed panels. Rehearsal uses the same declared rules as the eventual edition, with explicitly synthetic inventory.
4. **Economy:** finite inventory, procurement, batch production, listings, admission, reservation, consumption, extraction, loss, closure and qualified accounts.
5. **Operations/feedback:** immutable edition versions, public records, creator observations, discovery, refresh and retirement. Private test notes are not fabricated public engagement.

Current anchors: packages/game/src; packages/shared/src/custom-layout.ts/types.ts; apps/web/src/FloorBuilder.tsx/Run.tsx/Shop.tsx/Crafting.tsx/Maker.tsx; apps/server/src/runs.ts/http.ts/edition-record.ts; contracts/economy/src. S01 verifies the existing implementation and its evidence before deciding what to reuse; no blanket audit or correctness claim is made here.

## Work packages

Every package ends with source review and relevant evidence. Cards are not complete merely because a screen exists. Dependencies are listed; estimates follow the capability audit rather than pretending this is a small fixed-adventure patch.

### S01 — Audit the existing system and recent work
Dependencies: none.
- [ ] Inventory implemented mechanics, authoring controls, stock operations and missing connections.
- [ ] Classify recent work as reusable system work, diagnostic tooling, test-only fixture, or unwanted product specialization.
- [ ] Propose retaining/discarding each change. The named practice adventure must not remain the default product direction; do not silently delete prior work while planning.
- [ ] Record current technical baseline, dirty-source manifest and established invariants.
Deliverable: capability map and explicit disposition of the mistaken adventure work.

### S02 — Define the first complete construction vocabulary
Dependencies: S01.
- [ ] Build a general composable authoring vocabulary without requiring Andrew to supply example dungeons. Audit and remove accidental hardcoded spatial/placement/progression limits. Creator feedback refines usability and expressiveness; it does not gate general implementation.
- [ ] Document maker controls already available and the smallest missing set needed to create different experiences: geometry, entry/exit, enemy behavior/placement, hazard timing, fixed/random chests or reward sources, resource loot, floor sequence and economic terms.
- [ ] Separate global game rules from per-dungeon choices. All configurable danger/economic terms must be visible and fixed at admission; no undisclosed arbitrary author scripting.
- [ ] For each component specify its player decision, maker control, combinations, limits and UI explanation.
- [ ] Make a coverage matrix including floor ordering/transitions and reward distribution, town entrance routing, clone/fork attribution, entity catalog limits, procurement/funding/fee/opening terms, and an in-tool component reference. Decide how creations are reached through the existing walkable town/gate; do not silently replace spatial entry with an unexplained list.
- [ ] Scope the initial entity kit to a configurable registered catalog, not arbitrary creator code. Record what cannot yet be expressed. Data cloning preserves source attribution and creates an independent editable definition; it never copies funded item ownership or grants publication rights to someone else’s assets.
Deliverable: reviewed reusable component spec. Numerical defaults remain tunable, with versioned records.

### S03 — Unify rule and content definitions
Dependencies: capability audit; proceed without waiting for creator examples.
- [ ] Define shared schemas and validation for the construction vocabulary, including old content compatibility.
- [ ] Remove duplicated assumptions between editor, rehearsal, server and published definitions where evidenced.
- [ ] Define validated save/export/import of creator definitions and asset references. Preserve existing user-uploaded tilesets and clearly label unverified provenance; cosmetics cannot change gameplay or imply verified NFT ownership.
- [ ] Ensure saved/admitted content pins rules and data; adding a mechanic cannot enable it in legacy runs accidentally.
Deliverable: schema/version contract with roundtrip, invalid-data and legacy tests.

### S04 — Deepen reusable player interactions
Dependencies: S02/S03.
- [ ] Implement only the minimum reusable action vocabulary that S02 establishes with deterministic targeting, readable intent and clear action costs.
- [ ] Verify interactions across enemies, hazards, terrain, equipment and items; pin displacement/committed-intent semantics if displacement is retained.
- [ ] Verify escape, death, continuation and item disposition independently of any particular map.
- [ ] Test small generated/parameterized arrangements and adversarial configurations. Preserve invalid-action/no-turn behavior.
Deliverable: mechanically expressive engine primitives, not a special encounter.

### S05 — Make authored layouts capable of meaningful choices
Dependencies: S03.
- [ ] Let creators construct routes, loops, optional areas, chokepoints and approachable reward placements using the grid tools. Include floor duplication/ordering, multi-floor transitions and distribution of rewards across floors; show which reservations belong to which edition/floor.
- [ ] Distinguish structural validity from design quality. Connectivity checks cannot certify fun or fair difficulty.
- [ ] Explain unreachable areas, conflicting placements, unsafe arrival and inaccessible exit with locations and actionable fixes.
Deliverable: a creator can realize and revise their intended spatial design without code edits.

### S06 — Configure encounters and rewards in the builder
Dependencies: S03/S04/S05.
- [ ] Expose supported enemy/hazard/trigger properties with understandable limits and visual previews.
- [ ] Configure fixed or funded random reward sockets, including zero reward. Verify existing contract support during S01 and connect confirmed capabilities; do not leave supported reward types inaccessible without explanation.
- [ ] Make configured monsters, traps and chests/reward sources actual interactive components under shared rules, not decorative tiles or a single hard-coded showcase. State which components exist now and which must be implemented.
- [ ] Show the interaction consequences of placement and configuration without hiding unfunded or invalid states.
Deliverable: coherent placement/configuration workflow in fixed windows, with roundtrip and keyboard/pointer checks.

### S07 — Make rehearsal a real design tool
Dependencies: S04/S06.
- [ ] Rehearse the current draft using its actual rules and configured encounters; clearly distinguish synthetic test inventory from funded publication.
- [ ] Offer useful starting kit/test-position choices without changing the saved dungeon or granting goods.
- [ ] Return from rehearsal to the same floor/selection and retained edits; restart/retry quickly; expose outcome/action trace for diagnosis.
- [ ] Preserve undo/redo, draft persistence and recovery. Never publish as a side effect of rehearsal.
- [ ] Add a synthetic business rehearsal: select stock, copies, fee/opening terms and inspect estimated funding requirements and outcome accounts without submitting transactions. This makes rewards and business terms testable in the first kit session, before S10 connects authoritative publication.
Deliverable: build → play → diagnose → edit → replay works as one tool loop.

### S08 — Playtest the building kit first
Dependencies: S05–S07.
- [ ] Andrew and then available willing creators choose what they want to make. Target at least two creators and two unfamiliar players for broad K1 evidence; roles may overlap but a player must test someone else’s creation. If fewer people are available, label the result preliminary and leave broader acceptance open. Supply neutral capability explanations, not step-by-step layouts.
- [ ] Observe intent, construction, confusion, workarounds, rehearsal and revision; record engineer interventions.
- [ ] Have another person play a creation without the author explaining the route.
- [ ] Ask creators what they could not express and players what they understood. A creator choosing no rewards is supported.
Gate K1: creators can realize substantially different intentions without code edits, including reward and business-term choices in synthetic rehearsal. This does not yet certify authoritative publication or real demand. A polished developer-made map cannot pass this gate.

### S09 — Refine tools and mechanics from creator/player evidence
Dependencies: S08.
- [ ] Separate a missing capability from a discoverability issue or poor tuning.
- [ ] Fix the largest observed obstacle, change one main variable, and repeat build/play/revise sessions.
- [ ] Test whether newly expressible combinations produce understandable choices, not merely more options.
- [ ] After two unsuccessful rounds, review the system assumption; do not compensate with authored showcase content.
Deliverable: accepted capability improvements with evidence and remaining limitations.

### S10 — Integrate publication, procurement and capacity
Dependencies: S03/S06; public-facing promotion of new mechanics requires K1 evidence.
- [ ] Creators procure ordinary goods, select funding, see placement cost and complete-copy capacity, quote entry fee/opening period, validate and publish.
- [ ] Rehearsal and published behavior match; only reward ownership/authority changes. Terms and layout versions are immutable for admitted runs.
- [ ] Verify fixed/random reservations, no-reward editions, refresh, concurrent capacity, changed future prices and closure. Document abandonment/retirement: no confiscation of active reservations, no maker refund, existing cutoff and terminal-settlement conditions govern closure; absence of the maker must have a defined operator cleanup path under the published rules.
- [ ] Preserve existing paid floor-count constraints unless a separate documented system decision changes them.
Deliverable: a usable maker business workflow for player-authored definitions.

### S11 — Validate arbitrary authored runs against the economy
Dependencies: S10.
- [ ] Test success, death, abandonment, expiry and void across multiple mechanically different authored definitions.
- [ ] Verify consumables, found equipment, returned stock, fee routing and bank forfeitures by exact IDs.
- [ ] Exercise duplicate/stale actions, uncertain transactions, disconnect/restart and terminal races.
Deliverable: reusable authoritative execution and settlement, not a one-map integration proof.

### S12 — Make preparation, play and return one player loop
Dependencies: S04/S10/S11.
- [ ] Choose a creation using actual terms/transparency, compare gear, pack a loadout, enter and act, then return to meaningful use/sale/restocking decisions.
- [ ] Make threats, choices and consequences legible with the same character/tile system and fixed panels.
- [ ] Make loss understandable and re-entry feasible through disclosed finite recovery support; distinguish knowledge from permanent purchased power.
Deliverable: an adventurer can choose and learn unfamiliar player-created content without developer help.

### S13 — Improve artisan and merchant play
Dependencies: S01; integrate with S12.
- [ ] Observe existing batch production, costs/quality, pricing, real stock, buying and selling, including resale of extracted goods between players and merchants buying to resell. Crafting is not the only source of retail stock.
- [ ] Refine the per-batch interaction and shop decisions where evidence identifies repetition/confusion.
- [ ] Make makers and adventurers actual counterpart buyers in local multi-profile tests; distinguish demonstration trades from organic demand.
- [ ] Add recipes/orders only when a demonstrated need and complete funding/fulfillment rules justify them.
Deliverable: supplying other players is an understandable, satisfying activity, not just extra menus.

### S14 — Implement trustworthy business accounting
Dependencies: S01; schema can proceed independently of gameplay.
- [ ] Review Claude's draft critically before implementation: it incorrectly treats deprecated debit as a grant, assumes ordering, risks double-counting fees and gives a wrong bound for unknown costs.
- [ ] Define actual-cost provenance and conservative unknown handling; verify receipts, sequence/coverage, transfer ownership and craft allocation without fractional-credit invention.
- [ ] Show cash flow, funded expense, pending fees, stock/reference value and qualified contribution separately. Expense committed maker treasure once; never imply closure refunds.
- [ ] Test resale, crafting, extraction, funding/refresh, losses and incomplete history through retry/rebuild.
Deliverable: credible information for operating a business, no guaranteed profitability claim.

### S15 — Make transparency and discovery serve player choice
Dependencies: existing records; integrate S10–S14.
- [ ] Preserve averages/medians, losses-as-zero, outcome counts, timing/loot coverage and sample-size disclosure.
- [ ] Associate evidence with appropriate edition/rules/terms; explain fee/refresh mixing and avoid success-only claims.
- [ ] Help players find creations matching preferences, including unfamiliar makers and no-reward content. Change ranking only for observed discovery problems.
- [ ] Give makers useful feedback without rewarding kills or disclosing private/unvisited data.
Deliverable: informed choice and actionable iteration, not manufactured popularity.

### S16 — Playtest the complete creator/economy ecosystem
Dependencies: S09/S11–S15.
- [ ] Makers create/fund, artisans supply, adventurers choose/play, merchants trade, makers revise new editions.
- [ ] Observe independent intentions and unfamiliar creations. Record absent demand, unsold stock, depleted funding, confusing costs and recovery friction.
- [ ] Offer neutral stop/repeat choices. Keep assigned trials separate from voluntary activity; do not force people into three runs to manufacture retention.
Gate K2: people can create, operate, play and revise through the same system without developer intervention. Enjoyment and repeat intent require actual people, not simulations.

### S17 — Stress the economy and refine its weakest link
Dependencies: S11/S14; human refinement follows S16.
- [ ] Simulate bounded low-population/no-new-user scenarios, depleted bank budgets, high/low extraction, stock concentration, collusion and refunds.
- [ ] Model cheap NPC material supply explicitly: finite stock, purchase prices, replenishment and subsidy rules. Distinguish goods issuance/price pressure from coin issuance; cheap materials alone do not mint currency.
- [ ] Verify conservation, lifecycle accounting and honest unresolved states. Banked goods are transfers, not burns; subsidy is not organic earnings.
- [ ] Address observed bottlenecks with the smallest tested change while retaining user-fixed incentives and ownership.
Deliverable: known failure modes and measured improvements, not a claim that simulation proves a sustainable market.

### S18 — Review, verify and accept the system
Dependencies: S01–S17, with honest reporting of unresolved human evidence.
- [ ] Independent source/evidence review of engine, kit, publication, trade and recovery; fix substantive findings.
- [ ] Run relevant game/server/contract tests, typechecking/builds and fixed-window browser checks across creation, rehearsal, publication and return.
- [ ] Demonstrate extension by registering one additional bounded component/configuration after the schema is in place, carrying it through validation, builder, rehearsal and publication without adventure-specific branches. A genuinely new behavior may require engine code; extensibility does not mean arbitrary behavior appears without implementation.
- [ ] Reproduce more than one user-created design from saved definitions; no special-case code or untracked creator state required.
- [ ] Record Andrew's verdict separately for dungeon play, building, and economic play, with unresolved issues and next experiments.
Deliverable: a verified extensible game system and construction kit. No external release authorized.

## Playtesting changes

The unit of evaluation is no longer “did someone enjoy our adventure?” It is:

- Can a creator express an intention, and what obstructs them?
- Does another player understand and enjoy what they made?
- Can the creator improve it using the tools and evidence?
- Do preparation, supply, admission, rewards and trade create worthwhile decisions around it?

Test fixtures remain necessary for correctness. They must be labeled as fixtures, generated/varied where useful, and kept separate from player content and business-demand evidence. Never describe an automated winning route as evidence of fun.

## Disposition of the stopped implementation

The replanning pass is complete and system implementation has restarted. Recent shove/escape code is an unaccepted reusable candidate pending S01/S02 review; the named practice scenario is a test fixture, not accepted game content. The named practice default was removed during S01; ordinary free practice is procedural. Cost design is unimplemented and needs corrections listed in S14. Existing transparency and preexisting builder/economy work remain intact.

Execution now follows the fresh systems brief. Creator playtesting remains open; do not resume the old named-adventure sequence.

## Review of the corrected plan

Claude reviewed the replacement and flagged residual bias from the stopped scenario, business tools arriving too late, and missing floor composition/entrance/catalog/attribution/resale coverage. Those were incorporated above. Its proposed inflation wording was corrected to distinguish goods supply from monetary issuance. Review source: `claude-kit-replan-review.md`; exact initial review input retained separately. The final revised text has not received another Claude review.
