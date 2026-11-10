# Trust and limitations

Everything shipped here is a local prototype with explicitly seeded test assets. No mainnet/testnet deployment, public hosting, wallet ownership authentication, organic demand or profits are claimed.

The operator controls the signing key and demo profiles. The contract validates value/state transitions; it does not independently prove combat, acquired loot, crafting timing or the fairness of a seed. Demo session claims isolate concurrent visitors while held, and expire after 30 minutes; a server restart invalidates those leases. Do not expose this localhost API publicly as account authentication.

The server serializes economic submissions, persists signed transactions before broadcast, checks immutable operation receipts, and retains uncertainty/locks across failures. A replacement signature keeps the exact logical operation ID and command hash so late delivery cannot duplicate effects. Re-signing has a bounded retry budget; exhaustion requires operator diagnosis and does not free inventory. SQLite uses WAL/FULL and an exclusive process writer lock.

Crafting quality is measured by server receipt time, so network latency affects scores. It is not an anti-bot mechanism. Practice timing uses a monotonic browser clock and cannot award goods. Economic batches lock exact inputs; completion transforms four material instances into two outputs. Expiry gives normal tier. Recovery output belongs to bank and wages have an explicit budget/cap.

Seed issuance: extended initializer supplies 176 total credits including NPC-order/labor reserves and 51 initial item instances. NPC order demand (four fine tonics, five credits each) is a demo subsidy. There is no runtime faucet or promise of infinite liquidity. Reset means a new sandbox epoch, not a disguised replenishment inside an existing economy.

Maker rewards come from maker-owned stock. Maker earns entry fees after terminal settlement; void refunds entry. Town-origin unconsumed equipment goes to bank on death/abandon/expiry. Unconsumed dungeon-origin items return to their original pool; consumed items remain spent even on void. Closure banks leftover stock, never refunds the maker.

Public reference values are fixed catalog values. They are not external prices or a profit claim. Random tables draw deterministically without replacement from funded instances using an operator-controlled seed; there is no independent random beacon.

New version-2 paid editions now use seeded chambers and corridors, server-owned exploration and exact funded rewards. Version-1 editions retain fixed layouts. Free practice remains a separate non-economic activity. Town positions are client presentation state and confer no goods, credits or access authority. All economic operations are still server/contract validated. Fresh local worlds spend existing proprietor assets to seed two funded openings and tonic listings; this is explicit demo supply. Passing economic tests does not establish that either is fun, balanced, fair against adversarial clients, production secure, or competitive in the contest. Human gameplay gate remains open following the user's criticism that the earlier version felt basic rather than roguelike.

Authored version-3 floors are immutable public edition terms, not secret geometry. Rust and TypeScript validate their bounded tile maps and markers; the server still assigns only confirmed funded instances. The free builder rehearsal uses synthetic items and never submits economic commands. House layouts are cosmetic browser-local data and confer no ownership or inventory. See [builder verification](builders-verification.md).
