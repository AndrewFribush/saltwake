# Testnet wallet play: notes

Branch `feat/testnet-wallet`. Local sandbox stays on operator demo profiles. A server started with `--testnet` runs wallet sign-in only, with no demo profiles and no fallback.

## Testnet contract

- `saltwake-20261110.testnet` (new account; the older `dungeon-economy-demo-20261110.testnet` was not touched).
- Wasm sha256 `ca700bfd5fab89362f147b46270f7bccb79252e27fb2682af371d85285f159c2`, initialized with the new `init_public_testnet`: the extended demo plus 120 wage credits (60 bank recovery jobs) and 120 herbs + 120 flasks in the bank. Wallet players register with 0 coins. They earn their first coins at the workshop (Copper Kettle → Working bench → Recovery job, 2 coins, up to 3 jobs per player) and then buy from the bank or market.
- Hard limits from the contract: 64 craft batches ever, 128 wallet players.
- Deploy script: `scripts/testnet-public-deploy.ts <account> <funder...>` (faucet, top-up, deploy, init). Keys live in git-ignored `.state/`.

## Run it

```
npm ci && npm run build:contract
# API (operator) against testnet. The config is .state/testnet-public*.json (key, epoch, RPC) and the approval is .state/*approval*.json
npx tsx apps/server/src/main.ts --testnet --config .state/testnet-public-live.json \
  --approval .state/testnet-public-approval-live.json --port 18945 --web-origin http://127.0.0.1:18944
# Web
SALTWAKE_API_PORT=18945 npx vite apps/web --host 127.0.0.1 --port 18944 --strictPort
# open http://127.0.0.1:18944 (must be 127.0.0.1, not localhost)
```

Approval file: `{approvedBy:"Andrew", accountId, rpcUrl, wasmSha256, maximumTransactions (<=5000), expiresAt (<=2026-11-16T23:59:59Z), approvalId?}`. The server checks the RPC allowlist, the account, the local artifact hash and the deployed code hash before starting. The operator budget counts broadcasts and survives restarts. A new `approvalId` starts a new budget.

## Wallets

MyNearWallet (popup web wallet, no install; `testnet.mynearwallet.com` creates free accounts), Meteor (popup or extension) and Nightly (extension), all via `@near-wallet-selector` 10.1.4. Connecting creates a function-call key for the game contract, so MyNearWallet signs game calls without further popups.

Dev only: with `.state/dev-test-signer.json` `{"keyPath":".state/testnet-player-<acct>.json","contractId":"saltwake-20261110.testnet"}` present, the Vite dev server offers a "Dev test signer" wallet. The key stays in the Vite Node process. Used for automated browser runs.

## Verified

- Script path (`scripts/testnet-wallet-proof.ts <player>.testnet [api] [origin]`, same WalletTransport as the browser, local key as the wallet), on testnet as `saltwake-player1-20261110.testnet`:
  - register_player `5PQGTpsrA9TM3wveeV1imCKdKS6ahqJ89ghEw31ofAkM`
  - begin_recovery (player-signed) `98gvjjvAoDcMLD38Y5yKr1eXre8MLJ9JJRDQ1F57phC2`
  - operator finish_recovery paid the 2-coin wage
  - bank_buy (player-signed) `EQFswp4KGDLyiGbuphL1dnuCnfbcZnq59isJb5rHkfd7` → the player owns `bank-herb-0`
- Browser (Aside, dev test signer, `saltwake-player2-20261110.testnet`): wallet picker renders, NEP-413 sign-in verified by the server, register_player sent from the UI `5kwd2hrWsLweCG8f6e1ynsgGP4fJRgtSMzvqUDopamhJ`, town loads with the wallet identity, and a reload keeps the session (no new signature).

## Open

- An economic action clicked in the browser has not been confirmed on testnet yet. Runs were cut off by Aside disconnects mid-approval and then by public-RPC rate limits (fastnear free tier returns -429; `rpc.testnet.near.org` is deprecated and also throttles). Several stale local servers (started during this work) still poll the RPC. Stopping them and running one server should clear it.
- A wallet batch prepared but never signed (tab closed during approval) used to block that player's workbench. Fixed: `CraftView.resume` plus an "Approve this job in your wallet" button. Servers already running when the fix landed still have the old behavior until restarted (affects player1 and player2 on the 18945 server).
- A human with MyNearWallet must click: Connect → MyNearWallet → approve in the popup, then "Sign in with wallet" → sign in the popup. Register and play are signed with the function-call key (no popup).
- Sessions are in server memory (1 h). A server restart signs everyone out (they sign in again; on-chain state is unaffected).
