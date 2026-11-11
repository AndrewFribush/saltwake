# Town presence notes

## What works

- Everyone in the same Saltwake district sees everyone else walk around in real time. Each avatar has its own tint, a name label and a facing, and slides smoothly between tiles (a 110ms CSS transform transition, which snaps on jumps of more than 2 tiles).
- When a player crosses into another district, the old district sees them leave and the new one sees them arrive. Entering a building or shop, or starting a dungeon run, hides you from the town. Interiors stay single-player because room layouts are saved per browser, so a shared room would not match between players.
- District chat: an overlay in the top-left corner of the map, holding the last 20 messages of the district's recent history (5 minutes). Press Enter on the map to start typing and Escape to return to walking. Typing never moves the character. Messages are limited to 160 characters and 5 per 10s per player. Control and bidi characters are stripped, and messages render as React text, so markup shows as plain text. On screens under 700px wide the chat starts collapsed.
- Identity comes only from the server session (`presenceIdentity` in `apps/server/src/presence.ts`). That is the demo profile id today and `wallet:<account>` → `<account>` once wallet sign-in lands. Any name or id the client sends is ignored.
- Transport is SSE (`GET /api/presence/stream`) plus `POST /api/presence/move` and `POST /api/presence/chat`, with no new dependencies. Clients send moves at most every 80ms and a heartbeat every 5s. The server drops moves closer than 40ms apart. A player is dropped when their stream closes or after 20s without a heartbeat. Streams are re-checked against the session every 15s, so a profile switch drops the old identity. Limits: 200 players, and 4 streams per player.
- Presence lives only in memory. It never touches the economy, the contract or the outbox, and a position grants nothing.

## Player trading (no contract change)

- Click another player in your district, or their name in chat, to open **Trade with …**. The panel shows their active listings, which include their shop stock. Pick items and buy them with the existing `buy` command at the listing's exact `unit_price`.
- **Offer your goods** lists the items you select with the existing `list` command, and **Withdraw** runs `cancel_listing`. After a successful offer or buy, a line is posted to district chat so the other player notices.
- Every trade goes through Demo's normal `command` wrapper: the authenticated `/api/command` (or the wallet transport), then the outbox, then the contract. The actor is bound by the server session. Presence ids, positions and chat never authorize anything. The 4-tile range is a UX rule only.
- Limitation: offers are ordinary public listings, so anyone can buy them, not only the player you are trading with. A true private trade would need a contract change, and the wallet lane owns contract changes. The minimal option is an optional `buyer: Option<AccountId>` on `list` that `buy` enforces. A full two-sided swap would need a new escrowed `offer_swap`/`accept_swap` pair. Neither is implemented.

## Try it with two browsers

Run a separate copy on other ports so the 18930/18931 demo is untouched:

```sh
npm run sandbox                                   # terminal 1 (this checkout's own .state)
SALTWAKE_API_PORT=18951 npm run server            # terminal 2
SALTWAKE_API_PORT=18951 npm run dev -- --port 18950 --strictPort   # terminal 3
```

Open http://127.0.0.1:18950 and http://localhost:18950. They are different hosts, so they keep separate cookie jars and each gets its own demo profile (the delver and the proprietor). A private window or a second browser also works. Walk around, cross a map edge, enter and leave a building, and chat.

With no env var set, ports stay at 18930/18931 exactly as before.

## Tests

`apps/web/test/presence-names.test.ts` covers trade-partner matching (demo and `wallet:` profiles). `apps/server/test/presence.test.ts` (part of `npm run test:server`) covers join, leave, move, district changes, indoor hiding, throttling, validation, chat normalization and length/rate limits, chat history, stale cleanup, capacity, session-only identity, and an HTTP run through the real `httpServer` (SSE, two sessions, a forged id, cross-origin and oversized requests refused, leave on disconnect).

## What's left

- Remote avatars use one shared sprite with a hue shift. Per-player looks would need character customization.
- There is no chat moderation beyond the limits above, and no mute/block.
- Presence lives in a single process. Running multiple server workers would need a shared pub/sub.
- When wallet mode is on, the dev proxy's origin rewrite (`SALTWAKE_API_PORT`) does not apply. Wallet mode pins its own origin.
