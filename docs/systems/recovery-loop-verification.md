# Loss and workbench recovery loop

## Observed friction and changes

Developer inspection found the workbench enabled recovery work based only on the labor budget, even for rich or otherwise ineligible characters. It also enabled a recipe for any four goods. These errors reached the contract rather than helping the player prepare.

The API now supplies a recovery offer computed from authoritative holdings, current batches, job allowance, wage reserve, labor funds and available bank materials. Holdings include listed gear, packed gear, non-recovery crafting inputs and pending run fees, using the same rules as the contract. Workbench controls show the specific reason when unavailable. Recipe readiness checks exact ownership and two herbs/two flasks; no equipment or wrong materials can masquerade as a batch.

Interrupted workbench actions now persist the original endpoint/body/request ID in per-profile session storage. Network failures, server errors and request timeouts retain the same request, and an explicit Retry workbench action survives reload. Definitive client errors release it; confirmed responses clear it. Starting another action is disabled while a request needs retry. The crafting animation timer runs only while a timed step is active.

## Verification

- `apps/server/test/loss-recovery-loop.test.ts` runs a real local NEAR contract behind the HTTP API. Buyer spends its ten coins on a deliberately labelled no-reward regression fixture, dies and forfeits its club, completes three finite recovery jobs, buys the forfeited club back for four coins and re-enters for the maker's newly quoted two-coin fee. The packed club produces club damage again. After the second loss the recovery allowance and labor budget remain exhausted. Client eligibility holdings match the contract's holdings view.
- Three shared workbench tests cover exact recipe/ownership/duplicates, shortages and budget/cap reasons, plus hidden holdings in listings, loadouts, crafting and fee reserves.
- `docs/evidence/recovery-loop/retry-browser.txt` records a real local recovery job for worker2. The browser deliberately dropped the begin response after server acceptance, reloaded, navigated back through the town/interior and retried. One job was charged against the allowance; credits changed 0 → 2; exactly two normal tonics settled to bank ownership. The test used immediate inputs, not fabricated fine-quality timings.
- Idle and active workbench controls fit at 1366×768 and 390×844. Scripts and DOM geometry evidence are in `docs/evidence/recovery-loop/`.
- Final checks: 98 game tests, 76 server tests, typecheck and web build pass. The full standalone contract suite was not rerun; the new HTTP loop executes the real local contract, alongside existing server integration tests.

## Interpretation and boundaries

This establishes a usable technical recovery path and fixes concrete preparation/retry friction. It is developer observation plus automated interaction, not independent human fun or retention acceptance. Three jobs and six total labor credits are finite support, not a promise of unlimited recovery. The re-entry test explicitly models a maker choosing a new fee; no agent silently alters a live player's admission terms.

The browser consumed one existing local worker2 recovery allowance and two coins of the existing labor fund; no new issuance, reset, testnet write, external deployment or paid call occurred. API restarted against the existing local world. Contract authority, recipe outputs, death ownership and recovery subsidies were unchanged.

Next loop work: supply/equipment discoverability and comparison, player-authored dungeon readability and repeated creator/play/revise sessions. The overall goal remains active.
