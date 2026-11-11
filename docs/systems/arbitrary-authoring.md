# Arbitrary player-authored dungeons

Andrew's correction supersedes the request for two example intentions. No creator scenario is required to continue implementation. Support reusable systems and arbitrary compositions of those systems; never whitelist adventures or mistake two fixtures for the product.

## Hardcoded limits audit

| Constraint | Current work / required continuation |
| --- | --- |
| Exactly four encounter sockets per floor | Replaced in new rules v4 by 0–16 freely placed/removable encounters; blank drafts start with none. Prior v3 modules retain exactly-four validation. |
| 13×9 grid | New rules v5 supports independent 5–31 column/row dimensions, safe resizing, editor panning and a player-following viewport. Old module formats retain their fixed dimensions. |
| Mandatory sequential floors | Rules v6 supports directed walk-on passages, branches, return routes and self-links, with remembered room state. Rules v9 now permits 1–16 floors (64 encounters total); one extraction exit per floor remains; destination arrival is at the target spawn or nearest free floor tile if occupied. |
| Two enemy behaviors and alternating spikes | Rules v7 now exposes health, damage, alert radius and trap period/armed duration/phase/damage through builder, rehearsal and contract-backed play. Two enemy behavior types remain. Rules v10 adds reusable channel switches and linked doors across geometry, pathfinding, sight, combat, persistence, editor and contract validation. Broader component composition is still required; see mechanisms-verification.md. |
| One shared random pool | Builder now exposes up to 16 named independent pools with separate stock assignment, bottleneck capacity and per-pool synthetic rehearsal samples. Contract table limits and without-replacement reservations remain authoritative. |
| One-hour opening and fixed run duration in builder | New v8 publications expose opening delay/length, run duration and concurrent capacity in a saved, portable Terms inspector. Contract admission uses those exact terms; existing editions retain their deadlines and limits. See operating-terms-verification.md. |
| Lifetime run/listing/batch/receipt capacities | Bounded local prototype. Needs persistent storage/lifecycle design with safe settlement reserve before public scale, not simply deleting old receipts or lifting caps. |

Resource limits remain explicit implementation bounds, not the definition of what creators may design. Arbitrary content does not imply arbitrary executable scripts or infinite storage.

## Versioned placement extension

Rules v4 uses `custom4:` modules with 0–16 unique traversable encounter positions per floor and up to 64 total encounter definitions across four floors. Definitions, fixed/random goods, ownership and reserve rules remain authoritative. Blueprint v3 carries variable placement counts; blueprint v1/v2 import retains its old positional limits. Rehearsal and server materialization use the same authored layout compiler. Existing v1–v3 editions retain their original module validation and execution.

Follow through with grid dimensions, transition composition, configurable reusable components and independent loot tables. Human testing remains useful for usability and fun, but is not a prerequisite for general authoring implementation.

## Placement-extension evidence

`docs/evidence/free-placement/` contains 109 passing game tests, 83 passing server tests, four focused contract/codec tests, v3/v4 funded server integration, typecheck/build, desktop/phone interaction/geometry checks and saved-placement reload evidence. A separate 35-test contract sweep passed during this continuation; the added v4 contract case was verified in the focused run. The local contract refresh took a backup and asserted an unchanged economic snapshot. No schema migration, world reset, external deployment or testnet transaction occurred.

Browser verification caveat: the initial post-restart check depended on a previously named fixture that was absent from the selected profile's displayed library. Its absence was not explained, so that attempt is not counted as persistence evidence. A self-contained replacement created and explicitly saved a new six-encounter draft, verified it after reload, and a separate browser invocation reopened and rehearsed it successfully. No existing draft was removed to make the check pass.

## Floor-count and execution-budget extension

Rules v9 removes the mandatory 2–4 floor structure. New drafts start with one floor; connected or sequential designs can use up to sixteen. Blueprint/draft v9 and trial records preserve the extended range. Valid larger designs required a v9-only 128 KiB command allowance and 300-Tgas publication allocation, verified through actual local HTTP signing and contract execution. Older formats retain their limits. See [floor-count-verification.md](floor-count-verification.md).

## Authored departure conditions

Rules11 removes the mandatory kill-all extraction shape for new content. Creators independently choose extraction permission, clearance and a named switch condition per floor. Onward-only stairs permit linear continuation; separate walk-on passages retain their own policy. Departure resolves one final danger turn. New creator definitions have no automatic threshold shrine. Legacy admitted behavior stays pinned. See [exit-rules-verification.md](exit-rules-verification.md), including current single-channel and one-exit-per-floor bounds.
