//! Bounded records for a long-lived world (docs/systems/CAPACITY.md).
//!
//! Caps apply to ACTIVE records only. Terminal records (settled runs, sold or cancelled listings, finished
//! batches, closed editions, closed commissions) are immutable; the newest few of each kind stay in the
//! snapshot for history and the rest are pruned after each committed command. Nothing an active record
//! needs is removed: items never point at a terminal run, listing or batch, and a closed edition holds no items.
use crate::*;

pub const MAX_ACTIVE_RUNS: usize = 64;
pub const MAX_ACTIVE_LISTINGS: usize = 64;
pub const MAX_ACTIVE_BATCHES: usize = 64;
pub const MAX_OPEN_EDITIONS: usize = 32;
pub const KEEP_TERMINAL_RUNS: usize = 64;
pub const KEEP_CLOSED_LISTINGS: usize = 64;
pub const KEEP_FINISHED_BATCHES: usize = 64;
pub const KEEP_CLOSED_EDITIONS: usize = 16;
pub const KEEP_CLOSED_COMMISSIONS: usize = 32;

const NEXT_LISTING_KEY: &[u8] = b"next_listing.v1";
const NEXT_COMMISSION_KEY: &[u8] = b"next_commission.v1";

/// Numeric suffix of `<prefix><n>` ids; anything else sorts as newest so it is never pruned first.
pub(crate) fn serial(id: &str, prefix: &str) -> u64 {
    id.strip_prefix(prefix).and_then(|n| n.parse().ok()).unwrap_or(u64::MAX)
}
fn read_u64(key: &[u8]) -> Option<u64> {
    env::storage_read(key).map(|b| u64::from_le_bytes(b.try_into().expect("Corrupt counter")))
}
/// Next unused number for `<prefix><n>` ids. Older state numbered by map length and never removed entries,
/// so the first value is one past the largest existing number (equal to the old length).
fn next_serial<'a>(key: &[u8], prefix: &str, ids: impl Iterator<Item = &'a String>) -> u64 {
    read_u64(key).unwrap_or_else(|| ids.map(|id| serial(id, prefix)).filter(|n| *n != u64::MAX).map(|n| n + 1).max().unwrap_or(0))
}
/// The next listing id, never used before even after older listings were pruned. `commit_listing` records it
/// once the listing exists, so a rejected command leaves the counter untouched.
pub(crate) fn next_listing(listings: &BTreeMap<String, Listing>) -> (u64, String) {
    let n = next_serial(NEXT_LISTING_KEY, "listing-", listings.keys()).max(listings.len() as u64);
    (n, format!("listing-{n}"))
}
pub(crate) fn commit_listing(n: u64) {
    env::storage_write(NEXT_LISTING_KEY, &(n + 1).to_le_bytes());
}
pub(crate) fn allocate_commission(map: &BTreeMap<String, crate::commissions::Commission>) -> String {
    let n = next_serial(NEXT_COMMISSION_KEY, "commission-", map.keys()).max(map.len() as u64);
    env::storage_write(NEXT_COMMISSION_KEY, &(n + 1).to_le_bytes());
    format!("commission-{n}")
}
/// Ids beyond the newest `keep`, oldest first.
fn excess(mut ids: Vec<(u64, String)>, keep: usize) -> Vec<String> {
    if ids.len() <= keep {
        return vec![];
    }
    ids.sort();
    let n = ids.len() - keep;
    ids.into_iter().take(n).map(|(_, id)| id).collect()
}

impl Economy {
    pub(crate) fn active_runs(&self) -> usize {
        self.runs.values().filter(|r| r.status == "active").count()
    }
    pub(crate) fn active_listings(&self) -> usize {
        self.listings.values().filter(|l| l.status == "active").count()
    }
    pub(crate) fn active_batches(&self) -> usize {
        self.batches.values().filter(|b| b.status == "active").count()
    }
    pub(crate) fn open_editions(&self) -> usize {
        self.editions.values().filter(|e| !e.closed).count()
    }
    /// Prune terminal records beyond the retained history. Runs after a command has committed.
    /// Editions are only examined after a closure or a building change (the commands that can make one
    /// prunable), because the building check reads every interior; commissions only after commission commands.
    pub(crate) fn compact(&mut self, editions_touched: bool, commissions_touched: bool) {
        // Closed editions first, with their settled runs, unless a town building still points at one.
        let closed: Vec<_> = if editions_touched && self.editions.values().filter(|e| e.closed).count() > KEEP_CLOSED_EDITIONS {
            self.editions
                .values()
                .filter(|e| e.closed && !self.shops.values().any(|s| s.interior.contains(&format!("\"{}\"", e.id))))
                .map(|e| (serial(&e.id, "edition-"), e.id.clone()))
                .collect()
        } else {
            vec![]
        };
        let pruned_editions = excess(closed, KEEP_CLOSED_EDITIONS);
        if !pruned_editions.is_empty() {
            for id in &pruned_editions {
                self.editions.remove(id);
                self.runs.retain(|_, r| &r.edition != id || r.status == "active");
            }
            crate::editions::forget_retired(&pruned_editions);
        }
        let terminal = self.runs.values().filter(|r| r.status != "active").map(|r| (serial(&r.id, "run-"), r.id.clone())).collect();
        for id in excess(terminal, KEEP_TERMINAL_RUNS) {
            self.runs.remove(&id);
        }
        let closed = self.listings.values().filter(|l| l.status != "active").map(|l| (serial(&l.id, "listing-"), l.id.clone())).collect();
        let pruned = excess(closed, KEEP_CLOSED_LISTINGS);
        if !pruned.is_empty() {
            // Pin the id counter before any listing disappears, so ids are never reused.
            if read_u64(NEXT_LISTING_KEY).is_none() {
                let n = next_serial(NEXT_LISTING_KEY, "listing-", self.listings.keys()).max(self.listings.len() as u64);
                env::storage_write(NEXT_LISTING_KEY, &n.to_le_bytes());
            }
            for id in &pruned {
                self.listings.remove(id);
                crate::market::forget_reservation(id);
            }
            for shop in self.shops.values_mut() {
                shop.listing_ids.retain(|l| !pruned.contains(l));
            }
        }
        // Batch ids carry no order; the deadline is fixed at begin and rises with chain time.
        let finished: Vec<_> = self.batches.values().filter(|b| b.status != "active").map(|b| (b.deadline_ms.0, b.id.clone())).collect();
        for id in excess(finished, KEEP_FINISHED_BATCHES) {
            self.batches.remove(&id);
        }
        if commissions_touched {
            let mut map = crate::commissions::read();
            let closed = map.values().filter(|c| c.status != "open").map(|c| (serial(&c.id, "commission-"), c.id.clone())).collect();
            let pruned = excess(closed, KEEP_CLOSED_COMMISSIONS);
            if !pruned.is_empty() {
                if read_u64(NEXT_COMMISSION_KEY).is_none() {
                    let n = next_serial(NEXT_COMMISSION_KEY, "commission-", map.keys()).max(map.len() as u64);
                    env::storage_write(NEXT_COMMISSION_KEY, &n.to_le_bytes());
                }
                for id in &pruned {
                    map.remove(id);
                }
                crate::commissions::write(&map);
            }
        }
    }
}
