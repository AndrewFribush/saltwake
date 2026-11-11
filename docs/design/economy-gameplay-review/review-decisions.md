# Response to Claude and recommended next design

10 November 2026. Claude completed a successful independent CLI review of the exact initial brief (`claude-brief.txt`). Raw response retained; readable version in `claude-review.md`. This is a design critique, not an approval, playtest or executed source verification.

## Adopt

1. Narrow the first playable experiment. One authored floor containing two connected encounter spaces, a tempting optional cache, charger/pursuer/spikes, club versus sword, and extraction before a full clear. Existing generation/builder support can supply its geometry. Do not build new floor types, crafting recipes, run modifiers or economy protocol first.
2. Make the connection to business concrete through an actual sale. The first linked experiment can use existing player listings: artisan produces a useful batch, adventurer buys, maker purchases and funds stock, adventurer extracts or loses, each actor sees what changed. Escrowed buy orders remain promising, but are a later feature requiring separate scope and correctness work.
3. Store/show the full action history before building a replay viewer. Render a short death explanation from authoritative recorded events, with a full expandable/paged history in the fixed inspector. No client inference about lost goods.
4. Define discovery behavior rather than saying 'better ranking.' Proposed first experiment: apply the player's explicit fee/style/risk preferences; rotate eligible offers so cheapest does not always win; where available reserve a slot for an under-observed maker. Show sample counts and self-reported difficulty. Do not optimize solely for completion rate: that buries deliberately difficult attractions and can be gamed. Exact policy can wait until multiple eligible editions actually exist.
5. Observe a few real players before broadening features. A small comparison with the old build can reveal friction but cannot establish a statistical treatment effect. Optional return without prompting is more valuable evidence than an arbitrary success percentage.

## Reject or qualify

- **Death disposition:** keep unconsumed dungeon-origin goods returning to the pool; town-origin equipment goes to the bank, consumed goods remain spent. Claude's proposal to bank a reserved bundle on every death changes Andrew's rule. Do not implement it. Maker fees also still arrive on normal deaths; saying the maker 'earns nothing' from death is inaccurate under that fee rule.
- **Profit arithmetic:** Claude's '48 committed for at most 8 fees' is not a valid lifetime ceiling. `max_runs:4` is concurrent capacity, not four lifetime admissions; failed runs can return stock. Funding reference value is also not necessarily acquisition cost. Use the explicitly hypothetical stress example in `research-addendum.md` instead. That still exposes a real incentive problem.
- **Separate stake:** maker-funded treasure plus admission fees and zero-treasure editions already exist. Optional sponsorship would be a new funding role, not a necessary solution. The maker earns fees and bears the treasure cost; there is no missing decision to award makers treasure proceeds.
- **Bank prices:** current reference/half-reference prices are implementation defaults, not a user-fixed rule. Future tuning must be stated, not disguised as an immutable requirement. Goods banked and later resold are not destroyed; coins flowing to bank are not mechanically burned. The danger is circulation/liquidity and insufficient budget recycling, not automatic monetary deflation proved by the supplied excerpts.
- **Mandatory lamp/oil:** defer. It adds a catalog item, recipe, fuel rules and a compulsory cost before testing the core. Hiding committed threats also weakens readability at exactly the point equipment is at risk. If tested later, keep adjacent threats readable and compare optional illumination/exploration benefits with a fully readable baseline. Do not fund artisan demand by making every run a tax on visibility.
- **Shove on guard:** promising but not automatically simpler. Current actions have no facing parameter/state; simultaneous defense and control may dominate sword. First proposed prototype: a distinct club shove action on an adjacent target, cardinal displacement by one walkable unoccupied tile, no free collision damage, enemy response still resolves from committed intent, no extra stun. Blocked shove is an invalid action with no turn consumed. Spikes retain their normal phase. Test chokepoint repetition and indefinite safe loops before making it a real gear ability. This is a proposed rule, not coded behavior.
- **Same-device detection:** not a solution to alternate accounts. It excludes legitimate shared-device players and is easy to evade. Self-entry blocking remains a basic rule, not beneficial-owner detection. Collusive extraction and ratings remain an unresolved adversarial-economy risk. Keep this explicit before any real-value launch.
- **Determinism:** readable combat is not inherently a solved or boring game. Shared rules, varied geometry and combinations can be deep. Avoid adding hidden randomness merely to defeat walkthroughs. Layout disclosure/replays can affect discovery; seed/version scope must remain honest.
- **Stray alert check:** Claude identified a possible duplicated code check but did not verify a functional bug. It is not evidence the proposed gameplay fix has been implemented or tested.

## The smallest experience we should now specify and build

Proposed working title: **The Smuggler's Choice**. Local free practice first, all in existing fixed windows.

1. Prepare with club or sword and an existing tonic. Show what each does in one sentence. Start healthy; no oil/time-pressure subsystem.
2. Enter a floor with two encounter spaces. One charger creates a readable dangerous line; a pursuer makes staying put costly; alternating spikes offer an opportunity. A cache sits on an optional detour. No arbitrary invisible trap or unavoidable starting damage.
3. Learn one interaction: shove a creature onto a dangerous tile or bait a committed charge. Successful environmental play receives clear animation/log feedback. Do not certify depth until players actually use it.
4. At the designated escape tile, choose extraction even with enemies alive. Extraction consumes a turn and resolves incoming enemies/hazards first; if dead, death wins; otherwise settle extraction. Invalid/stale requests cannot produce both outcomes. Provide the warning before the player commits. This requires a new rules version in any later funded run, not changing admitted runs.
5. A threatened player can take the tonic now, carry the cache home, or abandon the cache and escape. There must be at least one layout/loadout situation where each choice is sensible. Do not force every player to leave loot just to satisfy a metric.
6. On return, give one clear outcome and immediate re-equip/retry access. In practice, show learning only and award no economic items. In the subsequent funded slice, show exact settled goods/cash and preserve pending-operation recovery.

Tuning remains experimental: start with existing HP/damage/healing values, measure whether the optional reward is tempting and escape creates an actual decision. No assertion that one shove makes a wonderful roguelike. If players still only move and trade hits, revise encounter geometry and verbs before adding content or finance features.

## The economy slice after that

Use existing listings and crafting for one completed human-readable cycle. Show actual purchase costs, consumables, sale receipts, remaining inventory and maker fees. Add missing acquisition-cost provenance before claiming net profit. Preserve reference value as a separate public pool measurement. Give a broke player the existing visibly limited recovery commission and free practice; record when subsidy or stock runs out.

First success is players saying both 'I want another run' and 'I know what I want to buy/make differently.' Durable markets, long-term retention, resistance to collusion, sustainable operator revenue and real-money readiness remain unproven.

## Decisions for Andrew

Recommended direction: tactical expeditions with meaningful merchant preparation; retain all established funding and death rules. Start with the practice slice above, then connect it to the existing finite economy. Broader questions about expected population and long-term progression remain useful, but need not prevent this bounded local experiment. No implementation has started in this review pass.

## Andrew's decision: transparency (follow-up)

Keep treasure returning to the pool. Help entrants judge each edition using observed run time, loot actually taken home, extraction/death/abandonment/timeout counts and sample sizes. Include averages and medians; failed settled attempts contribute zero extracted loot. Active and voided attempts are disclosed separately, not folded into averages. Reference loot value is not sale proceeds or net earnings. Aggregate by edition and disclose fee/refresh mixing, missing timing coverage, small samples and unverified local participant profiles. This addresses informed choice; it does not prove the death incentive or collusion risk has disappeared.
