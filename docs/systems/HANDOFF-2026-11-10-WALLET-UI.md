# Handoff — stopped at Andrew's request

Andrew requested: “Wrap up andd note down where you are.” Implementation stopped; preserve all current work. No commit, push, deployment, testnet call, installed-wallet connection or persistent demo contract refresh was performed. The whole game goal is unfinished and paused, not complete.

## Authoritative scope

BRIEF.md, COMPLETION-GOAL.md and the SYSTEMS-KIT-PLAN.md supersede the historical adventure/merged plan. Build arbitrary player-authored dungeons and connected creator/adventurer/artisan/shop loops. Fixed-window spatial UI; preserve all funding, death, treasure, exact transaction and restart rules. Local development/disposable simulation only. Do not touch the shelved franchise project. Extensive intentional dirty changes on build/dungeon-loop must be preserved.

## Completed and verified before this stop

- Wallet-session and account-authorized contract foundations; prepared wallet crafting/recovery and external-batch recovery are integrated through HTTP. See player-identity-verification.md, wallet-http-and-discovery-verification.md and wallet-crafting-verification.md.
- Full server suite passed141 tests at the prior checkpoint. Subsequent prepared-reservation correction passed18 focused controller/queue tests; typecheck/build passed at that checkpoint.
- Browser transport now persists exact account/request intents before approval, resumes authenticated cookies, preserves uncertain submissions across reload, and validates prepared crafting descriptors. Its19 tests passed.
- Public GET /api/config returns exact auth mode/destination without session creation or chain reads;1 test passed.
- Latest actual HTTP+WASM test uses the browser transport with a **test-only local signer adapter**: NEP-413 login, registration, recovery batch approval/gameplay/wages, lost-broadcast-response reload, exact receipt recovery without another approval, and craft replay. It passed1/1. Evidence:docs/evidence/wallet-crafting/browser-http-loop-retest.txt. Initial failure is retained in browser-http-loop.txt: /api/command rejected prepared starts. Fixed http.ts to permit starts only for existing player-authorized queued requests, with enqueue enforcing the exact payload.

## Saved but not fully integrated

Kepler wrote WalletGame.tsx, WalletOnboarding.tsx, wallet-game.test.ts, and modified Demo.tsx/Crafting.tsx. They provide opt-in onboarding/registration, identity-scoped reset, injected command/crafting transport and removal of demo profile switching in wallet mode. Default Demo remains available. Agent's25 tests (6 UI/request seam +19 transport) passed; scoped typechecking passed. Logs copied to docs/evidence/wallet-ui/. These are markup/seam tests, not mounted-browser acceptance.

App.tsx still renders Demo directly. The existing live local demo remains unchanged. Main server has not been restarted to expose the newly added config endpoint. At inspection, API listener was node PID55734 on127.0.0.1:18931; revalidate before touching it. Do not inspect/print .state/sandbox.json or keys. Persistent contract remains the pre-identity rules11 build; do not refresh it merely to test onboarding.

Boole drafted near-wallet-selector-adapter.ts against published SDK source. Parent installed exact @near-wallet-selector/core@10.1.4, @near-wallet-selector/nightly@10.1.4 and buffer@6.0.3 using npm install --ignore-scripts. package.json/package-lock.json changed. Adapter tests and full final typecheck/build after this dependency/UI addition have NOT run. Adapter still needs prepared begin_craft/begin_recovery support.

## Critical next check before any wallet activation

Verify whether Nightly actually honors custom local-sandbox endpoints throughout transaction construction/signing/submission or maps unrecognized networks to mainnet. SDK Network accepts arbitrary IDs; that does not prove the wallet provider honors them. Inspect installed Nightly/wallet-utils implementation. **Do not wire or activate this adapter until isolation is established.** No actual installed-wallet connection has been attempted. If it cannot support local sandbox, retain it as an explicit supported-network adapter and continue disposable local verification without silently substituting a public network.

## Next work

1. Review the saved UI and adapter sources; establish network behavior and complete adapter action support/tests. Use gstack browse/Aside for any browser work.
2. Run final typecheck, relevant web/server tests and build against the combined tree. Preserve initial failures and fix substantive issues.
3. Connect App to exact mode configuration, explicit connect/sign-in/register controls and WalletGame. Add runtime wallet-mode configuration in a disposable isolated sandbox, not by refreshing the existing demo contract. No implicit demo fallback on wallet auth errors.
4. Verify mounted UI: identity switching during pending work, lost response/reload, logout/expiry, shops/builders/paid admissions/crafting, fixed desktop/mobile windows. Separate real SDK acceptance from the test signer proof.
5. Continue full systems completion checklist and human playtest/refinement work; I05/I06 and human enjoyment acceptance remain open.

Both agents were instructed to stop and acknowledged. IDs for resuming: Kepler01a1c840-8868-7a23-ad2b-797e00891e58; Boole01a1c886-2277-7241-9050-a0a2d53738d6.
