//! NEAR buy-in: a registered wallet player attaches NEAR and is credited game coins at a fixed published rate.
//! This is explicit central issuance. Coins enter only here (and at init), and the running totals are kept in
//! their own storage key so the main contract state layout is unchanged and older deployments still load.
//! The attached NEAR stays on the contract account (the operator treasury).
use crate::*;
use near_sdk::{json_types::U128, NearToken, Promise};

/// 0.01 NEAR per coin (0.1 NEAR = 10 coins). Published through `coin_offer`.
pub const COIN_PRICE_YOCTO: u128 = 10_000_000_000_000_000_000_000;
pub const MAX_COINS_PER_PURCHASE: u64 = 1_000;
const ISSUANCE_KEY: &[u8] = b"coin_issuance.v1";

#[near(serializers=[borsh,json])]
#[derive(Clone, Default)]
pub struct CoinIssuance {
    pub coins_issued: U64,
    pub near_received: U128,
    pub purchases: U64,
}
#[near(serializers=[json])]
pub struct CoinOffer {
    pub price_yocto_per_coin: U128,
    pub max_coins_per_purchase: U64,
    pub issuance: CoinIssuance,
}
#[near(serializers=[json])]
pub struct CoinPurchase {
    pub op_id: String,
    pub profile: String,
    pub coins: U64,
    pub paid_yocto: U128,
    /// true when this request was already recorded and the attached deposit (if any) was returned.
    pub replay: bool,
}

/// Per-player buy-in totals (append-only, own storage key per profile) so a player's ledger can itemize coins bought with NEAR.
fn buyer_key(profile: &str) -> Vec<u8> { format!("coin_buyer.v1:{profile}").into_bytes() }
pub fn read_buyer(profile: &str) -> Option<CoinIssuance> {
    env::storage_read(&buyer_key(profile)).map(|b| borsh::from_slice(&b).expect("Corrupt buyer record"))
}
pub fn read_issuance() -> CoinIssuance {
    env::storage_read(ISSUANCE_KEY)
        .map(|b| borsh::from_slice(&b).expect("Corrupt issuance record"))
        .unwrap_or_default()
}
fn purchase_key(op_id: &str) -> Vec<u8> {
    format!("coin_purchase.v1:{op_id}").into_bytes()
}

#[near]
impl Economy {
    pub fn coin_offer(&self) -> CoinOffer {
        CoinOffer {
            price_yocto_per_coin: U128(COIN_PRICE_YOCTO),
            max_coins_per_purchase: U64(MAX_COINS_PER_PURCHASE),
            issuance: read_issuance(),
        }
    }
    pub fn coin_purchases_of(&self, profile: String) -> CoinIssuance { read_buyer(&profile).unwrap_or_default() }
    pub fn coin_purchase(&self, account_id: AccountId, request_id: String) -> Option<U64> {
        let op_id = buy_operation_key(&account_id, &request_id);
        env::storage_read(&purchase_key(&op_id)).map(|b| borsh::from_slice::<U64>(&b).expect("Corrupt purchase"))
    }
    /// Exact quote: `expected_coins` × price must equal the attached deposit, or the call fails and NEAR
    /// refunds the deposit. Idempotent per (account, request_id): a replay credits nothing and returns
    /// any newly attached deposit.
    #[payable]
    pub fn buy_coins(&mut self, request_id: String, expected_coins: U64) -> CoinPurchase {
        let account = env::predecessor_account_id();
        let op_id = buy_operation_key(&account, &request_id);
        let profile = self.wallet_profile(account.clone());
        let deposit = env::attached_deposit().as_yoctonear();
        if let Some(prior) = env::storage_read(&purchase_key(&op_id)) {
            let coins: U64 = borsh::from_slice(&prior).expect("Corrupt purchase");
            if deposit > 0 {
                Promise::new(account).transfer(NearToken::from_yoctonear(deposit)).detach();
            }
            return CoinPurchase { op_id, profile, coins, paid_yocto: U128(coins.0 as u128 * COIN_PRICE_YOCTO), replay: true };
        }
        assert!(self.credits.contains_key(&profile), "Player registration required");
        let coins = expected_coins.0;
        assert!((1..=MAX_COINS_PER_PURCHASE).contains(&coins), "Buy between 1 and {MAX_COINS_PER_PURCHASE} coins");
        let price = coins as u128 * COIN_PRICE_YOCTO;
        assert_eq!(deposit, price, "Attached deposit must equal expected coins x {COIN_PRICE_YOCTO} yoctoNEAR");
        let balance = self.credits.get_mut(&profile).unwrap();
        *balance = balance.checked_add(coins).expect("Balance overflow");
        let mut issuance = read_issuance();
        issuance.coins_issued = U64(issuance.coins_issued.0.checked_add(coins).expect("Issuance overflow"));
        issuance.near_received = U128(issuance.near_received.0.checked_add(price).expect("Issuance overflow"));
        issuance.purchases = U64(issuance.purchases.0 + 1);
        env::storage_write(ISSUANCE_KEY, &borsh::to_vec(&issuance).unwrap());
        env::storage_write(&purchase_key(&op_id), &borsh::to_vec(&U64(coins)).unwrap());
        let mut mine = read_buyer(&profile).unwrap_or_default();
        mine.coins_issued = U64(mine.coins_issued.0 + coins);
        mine.near_received = U128(mine.near_received.0 + price);
        mine.purchases = U64(mine.purchases.0 + 1);
        env::storage_write(&buyer_key(&profile), &borsh::to_vec(&mine).unwrap());
        env::log_str(&format!("coin_purchase {op_id} {profile} {coins} {price}"));
        CoinPurchase { op_id, profile, coins: U64(coins), paid_yocto: U128(price), replay: false }
    }
}
/// Separate namespace from player commands, so a buy-in request id never collides with a command receipt.
pub fn buy_operation_key(account: &AccountId, request_id: &str) -> String {
    assert!(!request_id.is_empty() && request_id.len() <= 40
        && request_id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-'), "Invalid player request ID");
    hash(&("saltwake.coin-purchase.v1", account, request_id))
}
