# Creator kit verification — 2026-11-10

Authority: BRIEF.md. This implementation strengthens tools and systems; no authored adventure or scripted player route was added.

## Delivered

The guild builder has Guide, Check, Library and Business inspectors. Guide explains the bounded component vocabulary. Check locates blocked markers, overlaps, open boundaries and disconnected floor and preserves all authoritative validation errors. Library exports/imports versioned definitions only, clones with fresh identities, and removes drafts to recover capacity. Import is locked while reading; invalid input cannot replace existing drafts. Creator artwork remains separate and no asset provenance is asserted.

Business is synthetic: enter funded copies, paid completed attempts, whole-pool reward claims, total stock acquisition cost and other costs. Fee and placement follow the current draft. Results show stock requirements, admission revenue, full committed cost, contribution, mathematical break-even and remaining full copies. Unclaimed stock does not refund the maker. Unknown acquisition cost prevents a profit or break-even figure. Four simultaneous reservations is not four lifetime customers.

This calculator assumes sequential completed attempts, no voids, refresh or unresolved reservations, and either full-pool removal or full unused return. Partial consumption/extraction is outside its model. It does not estimate attendance, certify profitability, inspect purchase receipts, select goods, or submit commands. It rejects initial funding over 128 items. If copies are exhausted, the final claim must be on the final modeled attempt; the model does not prescribe an actual event order.

## Evidence

- `../evidence/creator-kit/game-tests.txt`: 85 passing game tests, including blueprint validation/coercion, diagnostics and business arithmetic/unknown costs/depletion/limits.
- `../evidence/creator-kit/server-tests.txt`: 53 passing server tests, including paid play and settlement/recovery.
- `../evidence/creator-kit/typecheck.txt` and `build.txt`: TypeScript and Vite production asset build pass. Asset compilation is not deployment.
- `../evidence/creator-kit/browser.js` and `browser.txt`: actual Aside interaction at 1366×768 and 390×844; no page overflow/offscreen controls, diagnostic tile highlight, malformed then valid import with corrected status, clone/remove, return to rehearsal, no captured window errors. All four business pages checked; editing fee to 2 and other cost to 3 produced revenue 20 and contribution 15 for ten no-reward attempts. No publish, purchase or draft-save action.

Existing NEAR sandbox database recovered from the surviving node home on its existing RPC port 49838. Local API and Vite restarted on 18931/18930. No sandbox initialization, saved-world replacement or external transaction. Server tests use their own disposable local sandbox fixtures.

## Independent review disposition

Claude's source review is retained as `../evidence/creator-kit/claude-review.md`, with exact input and raw output alongside it.

Fixed: stale notice masking import/clone; inconsistent cap/active update; overlong cloned titles; no library removal; stale focus on edit/draft changes; misleading import waiting text; unused StudioTabs import. Additionally rejected non-string reward keys explicitly after noting Object.hasOwn coerces keys.

Validated: floor validator requires the same dimensions/socket counts as draft loading; random reward economic support exists in shared types and contract dispatch, while editor limitation is explicit; Guide/Library fit was checked in the browser. Enemy health/damage guide numbers now derive from the rule constants. Placement fees remain pinned descriptions of existing economy rules, not an independently adjustable engine parameter.

Retained low-priority limitation: many boundary defects produce many diagnostic pages. Each is actionable and the authoritative summary remains present; no false geometry acceptance results.

Human evaluation remains outstanding. This evidence establishes behavior and accounting boundaries, not a fun game, sustainable market, or complete systems plan.

A second Claude review of the business calculator was launched separately. At this checkpoint its output file is still empty; this review is pending, not passed. Exact input is `../evidence/creator-kit/business-review-input.txt`. The calculator has automated tests and browser verification, but no independent review result yet.

Operational notes: near-sandbox's version path is a directory containing the executable; macOS node homes are under os.tmpdir(), not necessarily /tmp. Recover the existing home/port before starting the API, and never print sandbox.json because it contains the signer. Aside's role locator did not resolve number inputs here; specific inspector-scoped CSS input locators passed. A chained locator.getByRole is unsupported in this Aside runtime.

Neutral creator/unfamiliar-player testing instructions are in `creator-playtest.md`. No human sessions have been conducted in this implementation pass.
