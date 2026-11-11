# Multiplayer robustness (town presence and chat), 2026-11-11

## Load test

`npx tsx scripts/presence-load.ts --clients 50 --seconds 30` runs the real HTTP server and presence relay in a child process (so its CPU is measured alone) with 50 demo identities. Each client keeps an SSE stream open, moves every ~100–140 ms, crosses districts every ~20 s, one in five steps in and out of a player-building room, and about 1 % of ticks send a chat line stamped with its send time.

| Phase | Result (this Mac, under other agents' load) |
|---|---|
| Steady, 30 s | server CPU 6 %, RSS 122 MB, heap 19 MB; 58 279 events delivered (≈ 39 per client per second); 12 431 moves accepted, 142 chats, 211 extra heartbeats throttled with 429 (sent < 40 ms after a move, as designed); chat delivery p50 0 ms, p95 1 ms, max 7 ms |
| Stale cleanup | 5 clients froze (no moves or heartbeats, streams left open): after 30 s the server had closed all 5 streams and 28 of 40 watchers had seen a leave (the rest were in other districts, so correctly heard nothing) |
| Server restart | server killed and restarted on the same port: all 50 clients back (new session, new stream) in ≈ 2.5 s; CPU 6 % afterwards |

## Reconnection fixes in the web client

- `TownPresence`: the browser's `EventSource` retries a dropped stream by itself but gives up permanently on a non-200 answer, which is exactly what happens after a server restart (401: sessions are in memory). The hook now reopens the stream with backoff (2 s doubling to 15 s) whenever it is closed for good.
- `Demo`: a 401 on the world poll in demo mode takes a new session and asks for the same character again (remembered per tab), then refreshes and says "Reconnected after a server restart." Wallet mode is unchanged (wallet sessions require a fresh signature).
- Browser check: with the town open as the wayfarer, the API was restarted; within the poll interval the page showed "Reconnected after a server restart.", the same character, and presence back online.

## Chat safety

- Already in place: 160-character limit, 5 messages per 10 s per player, control and bidi characters stripped, text-only rendering, identity only from the server session.
- New, client-side (per browser): **Mute** (hide someone's messages; a line says how many are hidden), **Block** (mute plus hide their avatar in town and in rooms, and refuse to open a trade with them), a **Filter words** toggle (on by default; a short whole-word list shown as dots), and a **Muted (n)** list to unmute.
- New, server-side: **Report** sends the message id, author and text to `POST /api/presence/report`; the server keeps the last 200 reports in memory and logs each one for the operator. At most 5 reports per reporter per minute; you cannot report yourself; a report changes nothing for the reported player.
- Browser check: another player said "you idiot, what the hell", which showed as "you •••••, what the ••••"; Report produced a server log line with the message; Mute hid it ("1 message from muted or blocked players hidden"); Unmute brought it back.

## Not done

- Reports are not yet surfaced in any operator view, and there is no server-side moderation (kick, time-out).
- Presence still lives in one process; several server workers would need a shared pub/sub.
