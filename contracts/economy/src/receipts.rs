//! Operation receipts in bounded storage (docs/systems/CAPACITY.md).
//!
//! Tier 1: the newest `receipt_cap()` full receipts stay in the main state map `receipts` (layout unchanged).
//! Tier 2: when a receipt leaves tier 1 it becomes a compact tombstone under its own storage key
//! (op id digest -> payload hash, status, result, time). A tombstone is kept for at least `min_age_ms`
//! and the ring holds at most `slots` of them. Any op id found in either tier is never executed again:
//! a replay returns the recorded outcome (without the run copy) and a different payload panics.
//! When the ring is full of tombstones younger than `min_age_ms`, new operations are refused
//! (`Receipt window full`) instead of forgetting anything early; terminal headroom is reserved as before.
use crate::*;
use std::collections::VecDeque;

const ORDER_KEY: &[u8] = b"receipt_order.v1";
const RING_KEY: &[u8] = b"replay_ring.v1";
const CONFIG_KEY: &[u8] = b"replay_window.v1";
const TOMB_PREFIX: &[u8] = b"rx1:";
const PAGE_PREFIX: &[u8] = b"rp1:";
const PAGE: u64 = 64;
/// Tombstones kept per normal world.
pub const DEFAULT_REPLAY_SLOTS: u32 = 4096;
/// Minimum tombstone age before it may be forgotten: three days, several times NEAR's transaction validity period.
pub const DEFAULT_MIN_AGE_MS: u64 = 72 * 3600 * 1000;
/// Old tombstones forgotten per call; more than the one each call can add, so the ring drains.
const EXPIRE_PER_CALL: usize = 4;

#[near(serializers = [borsh])]
#[derive(Clone, Copy)]
pub struct WindowConfig {
    pub slots: u32,
    pub min_age_ms: u64,
}
#[near(serializers = [borsh])]
#[derive(Clone, Copy, Default)]
struct RingMeta {
    head: u64,
    len: u64,
}
#[near(serializers = [borsh])]
struct Tomb {
    payload: Vec<u8>,
    at_ms: u64,
    applied: bool,
    result: String,
}

pub fn config() -> WindowConfig {
    env::storage_read(CONFIG_KEY)
        .map(|b| borsh::from_slice(&b).expect("Corrupt replay window"))
        .unwrap_or(WindowConfig { slots: DEFAULT_REPLAY_SLOTS.saturating_mul(crate::cap_scale()), min_age_ms: DEFAULT_MIN_AGE_MS })
}
pub fn set_config(c: WindowConfig) {
    env::storage_write(CONFIG_KEY, &borsh::to_vec(&c).unwrap());
}
fn meta() -> RingMeta {
    env::storage_read(RING_KEY).map(|b| borsh::from_slice(&b).expect("Corrupt replay ring")).unwrap_or_default()
}
fn digest(op_id: &str) -> Vec<u8> {
    env::sha256(op_id.as_bytes())[..16].to_vec()
}
fn tomb_key(d: &[u8]) -> Vec<u8> {
    [TOMB_PREFIX, d].concat()
}
fn page_key(page: u64) -> Vec<u8> {
    [PAGE_PREFIX, &page.to_le_bytes()[..]].concat()
}
fn read_page(page: u64) -> Vec<Vec<u8>> {
    env::storage_read(&page_key(page)).map(|b| borsh::from_slice(&b).expect("Corrupt replay page")).unwrap_or_default()
}
fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}
fn unhex(s: &str) -> Vec<u8> {
    (0..s.len() / 2).map(|i| u8::from_str_radix(&s[2 * i..2 * i + 2], 16).unwrap_or(0)).collect()
}

/// The recorded outcome of an op id whose full receipt has left tier 1, if still remembered.
pub fn tombstone(op_id: &str) -> Option<Receipt> {
    let t: Tomb = borsh::from_slice(&env::storage_read(&tomb_key(&digest(op_id)))?).expect("Corrupt tombstone");
    Some(Receipt {
        op_id: op_id.into(),
        payload_hash: hex(&t.payload),
        status: if t.applied { "Applied" } else { "Rejected" }.into(),
        result: t.result,
        run: None,
    })
}

/// Forget at most a few tombstones older than the minimum age; returns the ring length afterwards.
pub fn expire_old(now: u64) -> u64 {
    let cfg = config();
    let mut m = meta();
    let mut changed = false;
    for _ in 0..EXPIRE_PER_CALL {
        if m.len == 0 {
            break;
        }
        let page = read_page(m.head / PAGE);
        let d = page.get((m.head % PAGE) as usize).cloned().unwrap_or_default();
        let key = tomb_key(&d);
        if let Some(raw) = env::storage_read(&key) {
            let t: Tomb = borsh::from_slice(&raw).expect("Corrupt tombstone");
            if t.at_ms.saturating_add(cfg.min_age_ms) > now {
                break;
            }
            env::storage_remove(&key);
        }
        m.head += 1;
        m.len -= 1;
        changed = true;
        // A page is removed only once fully consumed, so a page's entries always sit at their sequence offsets.
        if m.head % PAGE == 0 {
            env::storage_remove(&page_key((m.head - 1) / PAGE));
        }
    }
    if changed {
        env::storage_write(RING_KEY, &borsh::to_vec(&m).unwrap());
    }
    m.len
}

fn push_tomb(r: &Receipt, now: u64) {
    let d = digest(&r.op_id);
    let t = Tomb { payload: unhex(&r.payload_hash), at_ms: now, applied: r.status == "Applied", result: r.result.clone() };
    env::storage_write(&tomb_key(&d), &borsh::to_vec(&t).unwrap());
    let mut m = meta();
    let seq = m.head + m.len;
    let mut page = read_page(seq / PAGE);
    let offset = (seq % PAGE) as usize;
    page.resize(offset, vec![]);
    page.push(d);
    env::storage_write(&page_key(seq / PAGE), &borsh::to_vec(&page).unwrap());
    m.len += 1;
    env::storage_write(RING_KEY, &borsh::to_vec(&m).unwrap());
}

fn order(receipts: &BTreeMap<String, Receipt>) -> VecDeque<String> {
    // Lazy migration: state written before this module has no order; its receipts are evicted first, in key order.
    env::storage_read(ORDER_KEY)
        .map(|b| borsh::from_slice(&b).expect("Corrupt receipt order"))
        .unwrap_or_else(|| receipts.keys().cloned().collect())
}

/// Receipt slots still available: free tier-1 slots plus free tombstone slots.
pub fn free_slots(tier1: usize, ring_len: u64) -> usize {
    let cfg = config();
    receipt_cap().saturating_sub(tier1) + (cfg.slots as u64).saturating_sub(ring_len) as usize
}

/// Record a new receipt in tier 1, moving the oldest tier-1 receipts into tombstones beyond `receipt_cap()`.
pub fn record(receipts: &mut BTreeMap<String, Receipt>, receipt: Receipt, now: u64) {
    let mut queue = order(receipts);
    queue.push_back(receipt.op_id.clone());
    receipts.insert(receipt.op_id.clone(), receipt);
    while receipts.len() > receipt_cap() {
        let Some(oldest) = queue.pop_front() else { break };
        if let Some(old) = receipts.remove(&oldest) {
            push_tomb(&old, now);
        }
    }
    // Drop ids that are no longer in tier 1 (never expected) so the queue stays bounded by tier 1.
    if queue.len() > receipts.len() {
        queue.retain(|id| receipts.contains_key(id));
    }
    env::storage_write(ORDER_KEY, &borsh::to_vec(&queue).unwrap());
}

#[near(serializers = [json])]
pub struct WindowReport {
    pub recent_receipts: u32,
    pub recent_capacity: u32,
    pub tombstones: U64,
    pub tombstone_capacity: u32,
    pub min_age_ms: U64,
    pub oldest_tombstone_ms: Option<U64>,
}
pub fn report(tier1: usize) -> WindowReport {
    let cfg = config();
    let m = meta();
    let oldest = if m.len == 0 {
        None
    } else {
        read_page(m.head / PAGE)
            .get((m.head % PAGE) as usize)
            .and_then(|d| env::storage_read(&tomb_key(d)))
            .map(|raw| U64(borsh::from_slice::<Tomb>(&raw).expect("Corrupt tombstone").at_ms))
    };
    WindowReport {
        recent_receipts: tier1 as u32,
        recent_capacity: receipt_cap() as u32,
        tombstones: U64(m.len),
        tombstone_capacity: cfg.slots,
        min_age_ms: U64(cfg.min_age_ms),
        oldest_tombstone_ms: oldest,
    }
}
