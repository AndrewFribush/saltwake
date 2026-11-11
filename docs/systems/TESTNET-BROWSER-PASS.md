# Testnet browser pass (2026-11-11)

Contract `saltwake-20261110.testnet`, API on 127.0.0.1:18945, web on http://127.0.0.1:18944.
Two separate cookie jars: Aside (the real browser) and gstack's headless `$B` browser. Both used the dev test
signer, with a different key per context (`?devSigner=<account>`). Every economic action below was clicked in the
UI and signed as that player. Links go to `https://testnet.nearblocks.io/txns/<hash>`.

## 1. Two wallet players in town, live movement and chat: PASS

- player2 (`$B`) and player3 (Aside): each saw the other's avatar with its NEAR account label, saw it move
  (the avatar transform changed as the other player walked), and exchanged chat messages.
- trader4 (`$B`) and player3 (Aside): same result, captured from both sides.
- Screenshots: `docs/evidence/testnet-browser/01-trader4-sees-player3-walking-and-chat.png`,
  `02-player3-sees-trader4-walking-and-chat.jpg`, `00-player2-chat-with-player3.png` (captured just after player3's
  tab closed, so it shows the chat but not the avatar).

## 2. Player-to-player trade: PASS

player3 offered a Flask at 2 coins through **Trade with …** → **Offer your goods**. trader4 opened the trade panel
from the chat name, picked the Flask and bought it. The chat announcement reached both players.

- list (player3): `HSQ3SQYYhKwtcP95ZfxhXBcNyu2L9RVu5K8XjPqzrAAB`
- buy (trader4): `7fmrwNpRD8Xjr6R159DPQi7umAeUGjYsH1mRAt2DPWJn`
- Screenshots: `04-trader4-trade-panel-before-buy.png`, `05-trader4-after-buy.png`, `06-player3-sees-trader4-buy.jpg`

## 3. Recovery job wage, then a bank purchase: PASS

player3 went Copper Kettle → Ivo → Working bench → Recovery job, played the three steps (fine tier), and the
operator paid the 2-coin wage. player3 then bought a Flask from the market (`bank-flask-10`).

- register_player (player3): `5oXDeuiyFAiND3HXVjXNqt1eZbMnckeXSk26jeE92SqT`
- begin_recovery (player3): `HG5etZdgM2cWHpCtkvb6ptP7RGgLkxi1HniVi5NUBUxV`
- finish_recovery (operator, wage paid): `Ff5Zyoszr3bwBGcuzqvFiexbjw7aqUBnPXH9o8sWfRCh`
- bank_buy (player3): `9HqoQ1C7mP5LfEdLWXaDyBJP95pn7A8KR5myZVn9QnBH`
- Further recovery jobs that funded the trade: player3 `Ag7VXpvJ9nTvpF5WSDUYg978oCYzaxYaXm3eH8Shk1of`, and trader4
  (register `6kiigNhZTYG9y8idviUfSJSo4FgD1YA8KpsDPpuGenm`, begin_recovery `AP3tJ1nW8xE4SEmQuQPdVC5iJshqGDgL91mdFVqkmfzL`)
- Screenshot: `03-player3-wallet-after-recovery-and-bank-buy.png`

trader4 is `trader4.saltwake-player3-20261110.testnet`, a sub-account created from player3 with 2 testnet NEAR
(`DsZLvGXWr9p8XYHC2k9SiT3vHnV9ZKzbpkc17aiwyD9V`) because the faucet returned 429.

## Changes made

- Dev test signer: `.state/dev-test-signer.json` accepts `keyPaths` (several players). A browser context picks one
  with `?devSigner=<account>`, which is kept in sessionStorage and sent as `X-Test-Signer`. Unknown accounts are
  refused. An optional `rpcUrl` (one of the two public testnet RPCs) moves the signer off the API's endpoint. The
  signer is still dev-only and same-origin, and real wallets are unaffected.
- Testnet API: new `--rpc-cache-ms` (default 5000). Snapshot, contract-clock and per-operation receipt reads are
  cached for that window (`apps/server/src/rpc-cache.ts`). Without this, every client poll forced a reconcile pass
  that re-read the receipts of all pending operations. That kept fastnear at -429 for everyone: sign-in failed with
  INVALID_PROOF and commands failed with 429. This run used `--rpc-cache-ms 20000`.

## Still broken / caveats

- player1 and player2 each have a `begin_recovery` that an older server prepared before `requestId` was saved. It
  can never be signed or resumed, so their workbench and trade panel stay locked (an "unresolved" operation).
  It affects only those two test accounts. New players are fine.
- After **Retry interrupted action** confirms a buy, the red "Pending confirmation" banner stays up until the next
  action.
- Public RPC limits are still the weak point. One API should poll, with `--rpc-cache-ms` at 15000 or more on fastnear.
- The faucet (helper.testnet.near.org) returned 429 all session.
