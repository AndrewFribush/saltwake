# Creator rehearsal and revision notebook

The builder now records synthetic rehearsals against a copy of the exact tested floors and encounters. Creators can start at the entrance or isolate the selected floor, choose unarmed/club/sword/armored kits, retry, return to their editing floor, inspect turns and locate a recorded position. Changing geometry or encounters disables location links to the old design. Copy tested design creates a new unfunded, zero-fee draft rather than overwriting the current work.

## Persistence and limits

Save notebook explicitly retains the latest five attempts across a local profile's drafts. Each attempt retains its latest 128 valid actions and reports discarded turns. It stores the starting floor, synthetic kit/random sample, outcome, net health changes and final position. The design can be exported with the attempt. Corrupt saved notebooks are not silently replaced. Decoding checks design validity and rejects finish/turn locations outside the tested floors and grid.

Starting on a later floor uses fresh synthetic equipment and health; it does not simulate the cost of reaching that floor. Random samples are possible outcomes, not probabilities. This notebook is private local tooling, not public demand, economic accounting or human enjoyment evidence. Unsaved attempts do not survive reload. It is not a replay engine or a guarantee of compatibility with future rules versions.

## Verification

- 107 game tests pass, including snapshot isolation, unarmed items, death messages, bounded history, save/decode, malformed locations and selected-floor starts.
- 77 server tests pass in the inherited verification run for the shared unarmed/trace changes. No server change was needed for selected-floor rehearsal.
- TypeScript and Vite asset build pass after the validation fix.
- Aside browser scripts verify kit switching, recording, explicit save/reload, editor selection retention, stale-design detection, copy-to-new-draft and selected-floor turn location.
- Summary, Turns, Design and About fit at 1366×768 and 390×844 without page scrolling or offscreen controls. Evidence uses DOM geometry and interactions; it is not screenshot or human aesthetic signoff.

Evidence: `docs/evidence/creator-trials/`. The saved “Notebook verification · tooling fixture” is a blank regression draft, not a supplied player adventure. Browser checks changed only local draft/notebook state; no admission, publication, purchase, testnet or production action occurred.

The overall completion goal remains active. Human creator/player acceptance and the remaining system requirements are not passed by this notebook.
