# Informed admission and exact replenishment

## Player choice

Each gate offer now has Overview, Rules & hazards and Track record views tied to that exact edition. The rules view reads public admitted definitions, uses the shared layout compiler, and describes opening/deadline/capacity, per-floor exits and routes, mechanisms, individual enemy tuning, and trap timing/damage. It does not read private run state, maps, loot assignments or routes through fog. Invalid or unsupported rules disable entry instead of inventing a description.

The disclosure distinguishes charger charge damage from its default adjacent attack damage. Legacy module decoding strips newer metadata, preserving the admitted legacy explanation. Admission still submits the exact edition version and quoted fee. Changing an edition version remounts its offer view.

Preparation contains loadout information, maximum fee, reward preference and explicit browsing scope. Matching openings no longer falls back silently to every edition when the filter is empty. Any reward style is the default, including valid no-treasure creations. All editions/history is a separate explicit choice, retaining historical track records and admission guards for self-owned, closed or otherwise unavailable editions.

Desktop and phone checks caught and fixed a clipped admission button. Compact card spacing and moving preparation controls to their own existing fixed service panel provide room for paginated rules. No automated town navigation was introduced.

## Maker replenishment bug

A random pool named "fixed" previously shared its dropdown value with fixed rewards. Random-only editions could not replenish it; mixed editions could send compatible goods to the wrong pool. UI selection values now distinguish fixed from random-prefixed identities. The shared replenishment helper verifies current ownership and emits the exact pool ID, including IDs already containing that prefix.

Tests cover fixed rewards, random pools named "fixed" and "random:fixed", invalid/stale selections and ownership. A real ephemeral contract test proves those targets receive the intended goods, retries do not duplicate deposits, current run reservations remain unchanged, and subsequent admission draws from the correct pools.

## Evidence and limits

- 158 game tests pass, including three disclosure and three replenishment regressions.
- The focused replenishment contract test passes; see docs/evidence/replenishment/contract-test.txt.
- Typecheck and web build pass; see docs/evidence/admission-rules/.
- Aside verified the actual published rules11 edition-7, all three offer views at 1366×768 and 390×844, every rules page at phone width, and Preparation controls without document overflow or clipped tested controls. Reading the offer changed neither credits nor operation count.
- Independent review found no concrete disclosure mismatch or final tab/filter wiring defect.
- Screenshot copying from Aside's reported session path failed; no retained visual screenshot is claimed. Browser geometry and interaction logs are the evidence here.

No economic command was sent by the admission browser check. No testnet, paid call, hosted upload or production action occurred. These changes improve informed choice and correct replenishment; they do not establish human enjoyment, arbitrary behavior coverage, public identity, or whole-game completion.
