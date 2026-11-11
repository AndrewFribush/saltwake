mod buyin;
mod craft;
mod shops;
mod editions;
mod market;
mod model;
mod runs;
mod settlement;
use model::*;
use near_sdk::{borsh, env, json_types::U64, near, AccountId, PanicOnDefault};
use std::collections::BTreeMap;

#[near(contract_state)]
#[derive(PanicOnDefault, Clone)]
pub struct Economy {
    shops: BTreeMap<String, Shopfront>,
    operator: AccountId,
    credits: BTreeMap<String, u64>,
    bank: u64,
    items: BTreeMap<String, Item>,
    editions: BTreeMap<String, Edition>,
    runs: BTreeMap<String, Run>,
    receipts: BTreeMap<String, Receipt>,
    next_edition: u64,
    next_run: u64,
    listings: BTreeMap<String, Listing>,
    npc_order: NpcOrder,
    batches: BTreeMap<String, CraftBatch>,
    recovery: RecoveryState,
}
#[derive(borsh::BorshDeserialize)]
#[borsh(crate = "near_sdk::borsh")]
struct LegacyEconomy {
    operator: AccountId,
    credits: BTreeMap<String, u64>,
    bank: u64,
    items: BTreeMap<String, Item>,
    editions: BTreeMap<String, Edition>,
    runs: BTreeMap<String, Run>,
    receipts: BTreeMap<String, Receipt>,
    next_edition: u64,
    next_run: u64,
    listings: BTreeMap<String, Listing>,
    npc_order: NpcOrder,
    batches: BTreeMap<String, CraftBatch>,
    recovery: RecoveryState,
}
fn hash<T: borsh::BorshSerialize>(value: &T) -> String {
    env::sha256(&borsh::to_vec(value).unwrap())
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}
fn now_ms() -> u64 {
    env::block_timestamp() / 1_000_000
}

#[near]
impl Economy {
    #[init(ignore_state)]
    #[private]
    pub fn migrate_shops() -> Self {
        let old: LegacyEconomy = env::state_read().expect("Legacy state required");
        Self {shops: BTreeMap::new(), operator:old.operator,credits:old.credits,bank:old.bank,items:old.items,editions:old.editions,runs:old.runs,receipts:old.receipts,next_edition:old.next_edition,next_run:old.next_run,listings:old.listings,npc_order:old.npc_order,batches:old.batches,recovery:old.recovery}
    }
    #[init]
    #[private]
    pub fn init_demo() -> Self {
        let mut s = Self {
            shops: BTreeMap::new(),
            operator: env::predecessor_account_id(),
            credits: BTreeMap::new(),
            bank: 0,
            items: BTreeMap::new(),
            editions: BTreeMap::new(),
            runs: BTreeMap::new(),
            receipts: BTreeMap::new(),
            next_edition: 0,
            next_run: 0,
            listings: BTreeMap::new(),
            batches: BTreeMap::new(),
            recovery: RecoveryState {
                epoch: "demo-1".into(),
                budget: U64(0),
                wage: U64(2),
                max_jobs_per_profile: 3,
                jobs: BTreeMap::new(),
            },
            npc_order: NpcOrder {
                id: "fine-tonic-demo".into(),
                item_type: ItemType::FineTonic,
                unit_price: U64(5),
                remaining: 0,
                budget: U64(0),
                seeded_demo_demand: true,
            },
        };
        for p in ["buyer", "p2", "p3", "p4", "p5"] {
            s.credits.insert(p.into(), 10);
            s.items.insert(
                format!("{p}-club"),
                Item {
                    id: format!("{p}-club"),
                    item_type: ItemType::Club,
                    location: Location::Owned { profile: p.into() },
                },
            );
        }
        s.credits.insert("maker".into(), 100);
        for (ty, prefix, count) in [(ItemType::Sword, "sword", 3), (ItemType::Tonic, "tonic", 6)] {
            for n in 0..count {
                let id = format!("maker-{prefix}-{n}");
                s.items.insert(
                    id.clone(),
                    Item {
                        id,
                        item_type: ty,
                        location: Location::Owned {
                            profile: "maker".into(),
                        },
                    },
                );
            }
        }
        s
    }
    // Separate, one-time demo issuance: original grants + five fine tonics +
    // 20 credits reserved solely for four NPC purchases. No runtime faucet.
    #[init]
    #[private]
    pub fn init_market_demo() -> Self {
        let mut s = Self::init_demo();
        s.npc_order.remaining = 4;
        s.npc_order.budget = U64(20);
        for n in 0..5 {
            let id = format!("maker-fine-tonic-{n}");
            s.items.insert(
                id.clone(),
                Item {
                    id,
                    item_type: ItemType::FineTonic,
                    location: Location::Owned {
                        profile: "maker".into(),
                    },
                },
            );
        }
        s
    }
    // Explicit extended seed issuance: market demo (170 credits, 19 items),
    // plus 6 reserved labor credits and 32 materials (8 herbs + 8 flasks each
    // for maker and bank). Total: 176 credits, 51 items. Two zero-asset workers.
    // Recipe transforms consume 4 input instances and issue exactly 2 outputs.
    #[init]
    #[private]
    pub fn init_demo_extended() -> Self {
        let mut s = Self::init_market_demo();
        s.recovery.budget = U64(6);
        s.credits.insert("worker".into(), 0);
        s.credits.insert("worker2".into(), 0);
        for owner in ["maker", "bank"] {
            for (ty, prefix) in [(ItemType::Herb, "herb"), (ItemType::Flask, "flask")] {
                for n in 0..8 {
                    let id = format!("{owner}-{prefix}-{n}");
                    let location = if owner == "bank" {
                        Location::Bank
                    } else {
                        Location::Owned {
                            profile: owner.into(),
                        }
                    };
                    s.items.insert(
                        id.clone(),
                        Item {
                            id,
                            item_type: ty,
                            location,
                        },
                    );
                }
            }
        }
        s
    }
    // Public testnet seed: the extended demo plus a larger newcomer labor pool.
    // Wallet players register with zero assets and earn their first coins
    // through bank recovery jobs, so the pool must outlast many players:
    // 120 reserved wage credits (60 jobs) and 120 herbs + 120 flasks in the bank.
    // Total: 290 credits, 275 items. Fixed at init; no runtime faucet.
    #[init]
    #[private]
    pub fn init_public_testnet() -> Self {
        let mut s = Self::init_demo_extended();
        s.recovery.budget = U64(120);
        for (ty, prefix) in [(ItemType::Herb, "herb"), (ItemType::Flask, "flask")] {
            for n in 8..120 {
                let id = format!("bank-{prefix}-{n}");
                s.items.insert(
                    id.clone(),
                    Item {
                        id,
                        item_type: ty,
                        location: Location::Bank,
                    },
                );
            }
        }
        s
    }
    pub fn execute(&mut self, op_id: String, command: Command) -> Receipt {
        assert_eq!(
            env::predecessor_account_id(),
            self.operator,
            "Operator only"
        );
        if command.actor.starts_with("wallet:") {
            let bound = match &command.action {
                Action::Settle { run_id, .. } | Action::Void { run_id, .. } =>
                    self.runs.get(run_id).is_some_and(|run| run.player == command.actor),
                Action::FinishCraft { batch_id, .. } => self.batches.get(batch_id)
                    .is_some_and(|batch| batch.actor == command.actor && !batch.recovery),
                Action::FinishRecovery { batch_id, .. } => self.batches.get(batch_id)
                    .is_some_and(|batch| batch.actor == command.actor && batch.recovery),
                _ => false,
            };
            assert!(bound, "Wallet actors require a bound oracle result");
        }
        self.process_command(op_id, command, false)
    }
    pub fn wallet_profile(&self, account_id: AccountId) -> String {
        format!("wallet:{account_id}")
    }
    pub fn register_player(&mut self) -> String {
        let profile = self.wallet_profile(env::predecessor_account_id());
        if self.credits.contains_key(&profile) { return profile; }
        assert!(self.credits.keys().filter(|p| p.starts_with("wallet:")).count() < 128, "Wallet profile capacity exhausted");
        self.credits.insert(profile.clone(), 0);
        profile
    }
    pub fn player_operation_id(&self, account_id: AccountId, request_id: String) -> String {
        player_operation_key(&account_id, &request_id)
    }
    pub fn execute_player(&mut self, request_id: String, action: Action) -> Receipt {
        let account = env::predecessor_account_id();
        let op_id = player_operation_key(&account, &request_id);
        let actor = self.wallet_profile(account);
        assert!(self.credits.contains_key(&actor), "Player registration required");
        assert!(player_action_allowed(&action), "Action requires operator orchestration");
        if let Action::BeginCraft { batch_id, deadline_ms, .. }
            | Action::BeginRecovery { batch_id, deadline_ms, .. } = &action {
            assert_eq!(batch_id, &op_id, "Player batch must match account request");
            assert_eq!(deadline_ms.0, 0, "Player craft deadline must use chain time");
        }
        self.process_command(op_id, Command { actor, action }, true)
    }
    pub fn operation(&self, op_id: String) -> Option<Receipt> {
        self.receipts.get(&op_id).cloned()
    }
    pub fn clock_ms(&self) -> U64 {
        U64(now_ms())
    }
    pub fn roundtrip_command(&self, command: Command) -> Command {
        command
    }
    pub fn command_hash(&self, command: Command) -> String {
        hash(&command)
    }
    pub fn snapshot(&self) -> Snapshot {
        Snapshot {
            shops: self.shops.values().cloned().collect(),
            credits: self
                .credits
                .iter()
                .map(|(k, v)| (k.clone(), U64(*v)))
                .collect(),
            bank: U64(self.bank),
            items: self.items.values().cloned().collect(),
            editions: self.editions.values().cloned().collect(),
            runs: self.runs.values().cloned().collect(),
            listings: self.listings.values().cloned().collect(),
            npc_order: self.npc_order.clone(),
            batches: self.batches.values().cloned().collect(),
            recovery: self.recovery.clone(),
            coin_issuance: buyin::read_issuance(),
            bank_prices: [
                ItemType::Club,
                ItemType::Sword,
                ItemType::Armor,
                ItemType::Herb,
                ItemType::Iron,
                ItemType::Flask,
                ItemType::Tonic,
                ItemType::FineTonic,
            ]
            .into_iter()
            .map(|t| BankPrice {
                item_type: t,
                sale_price: U64(t.value()),
                buyback_price: U64(t.value() / 2),
            })
            .collect(),
        }
    }
    pub fn rules(&self) -> Rules {
        Rules {
            catalog: [
                ItemType::Club,
                ItemType::Sword,
                ItemType::Armor,
                ItemType::Herb,
                ItemType::Iron,
                ItemType::Flask,
                ItemType::Tonic,
                ItemType::FineTonic,
            ]
            .into_iter()
            .map(|t| CatalogEntry {
                item_type: t,
                value: U64(t.value()),
                consumable: t.consumable(),
            })
            .collect(),
            costs: Costs {
                publication: U64(2),
                pursuer: U64(2),
                charger: U64(3),
                trap: U64(1),
                reward_socket: U64(1),
            },
            run_duration_ms: U64(900000),
            max_runs: 4,
        }
    }
    pub fn holdings(&self, profile: String) -> U64 {
        U64(self.profile_holdings(&profile))
    }
    pub fn balances(&self) -> BTreeMap<String, U64> {
        BTreeMap::from([
            ("buyer".into(), U64(*self.credits.get("buyer").unwrap())),
            ("bank".into(), U64(self.bank)),
        ])
    }
}
fn player_operation_key(account: &AccountId, request_id: &str) -> String {
    assert!(!request_id.is_empty() && request_id.len() <= 40
        && request_id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-'), "Invalid player request ID");
    hash(&("saltwake.player-operation.v1", account, request_id))
}
fn player_action_allowed(action: &Action) -> bool {
    matches!(action,
        Action::Publish { .. } | Action::PublishRandom { .. } | Action::Admit { .. }
        | Action::FinalizeClose { .. } | Action::Refresh { .. } | Action::SetFee { .. }
        | Action::List { .. } | Action::CancelListing { .. } | Action::Buy { .. }
        | Action::BankBuy { .. } | Action::BankSell { .. } | Action::FillNpcOrder { .. }
        | Action::CreateShop { .. } | Action::UpdateShop { .. } | Action::StockShop { .. }
        | Action::BeginCraft { .. } | Action::BeginRecovery { .. })
}
impl Economy {
    fn process_command(&mut self, op_id: String, mut command: Command, player: bool) -> Receipt {
        let input_limit = match &command.action {
            Action::Publish { terms, .. } | Action::PublishRandom { terms, .. }
                if matches!(terms.rules_version, 9 | 10 | 11) => 131072,
            _ => 32768,
        };
        assert!(
            env::input().map(|b| b.len()).unwrap_or(0) <= input_limit,
            "Request too large"
        );
        assert!(
            !op_id.is_empty() && op_id.len() <= 64,
            "Invalid operation ID"
        );
        let payload_hash = hash(&command);
        if let Some(r) = self.receipts.get(&op_id) {
            assert_eq!(r.payload_hash, payload_hash, "Operation payload conflict");
            return r.clone();
        }
        assert!(self.receipts.len() < 256, "Receipt capacity exhausted");
        // Receipt identity is the submitted command. Derive execution randomness
        // only for a new player admission, never for replay or operator demos.
        if player {
            // Bind new crafting windows to confirmed chain execution, not a
            // caller's deadline or time spent approving the wallet request.
            if let Action::BeginCraft { ref mut deadline_ms, .. }
                | Action::BeginRecovery { ref mut deadline_ms, .. } = command.action {
                *deadline_ms = U64(now_ms().saturating_add(120_000));
            }
            if let Action::Admit { ref mut seed, .. } = command.action {
                let entropy = env::sha256(&borsh::to_vec(&(
                    "saltwake.player-admission.v1", env::random_seed(),
                    env::predecessor_account_id(), &op_id,
                )).unwrap());
                *seed = U64(u64::from_le_bytes(entropy[..8].try_into().unwrap()));
            }
        }
        // All validation is transactional, including validation rejections retained as receipts.
        let mut staged = self.clone();
        let outcome = if !staged.credits.contains_key(&command.actor) {
            Err("UnknownProfile".into())
        } else {
            staged.apply(command, &op_id)
        };
        let (status, result) = match outcome {
            Ok(result) => {
                assert!(
                    staged.receipts.len() + 1 + staged.reserved_capacity() <= 256,
                    "ReceiptCapacityReserved"
                );
                *self = staged;
                ("Applied", result)
            }
            Err(code) => {
                assert!(
                    self.receipts.len() + 1 + self.reserved_capacity() <= 256,
                    "ReceiptCapacityReserved"
                );
                ("Rejected", code)
            }
        };
        let run = if status == "Applied" {
            self.runs.get(&result).cloned()
        } else {
            None
        };
        let receipt = Receipt {
            op_id: op_id.clone(),
            payload_hash,
            status: status.into(),
            result,
            run,
        };
        self.receipts.insert(op_id, receipt.clone());
        receipt
    }
    fn reserved_capacity(&self) -> usize {
        self.runs.values().filter(|r| r.status == "active").count()
            + self.editions.values().filter(|e| !e.closed).count()
            + self
                .listings
                .values()
                .filter(|l| l.status == "active")
                .count()
            + self
                .batches
                .values()
                .filter(|b| b.status == "active")
                .count()
    }
    fn apply(&mut self, c: Command, op_id: &str) -> Result<String, String> {
        match c.action {
            Action::CreateShop {title,district,x,y,interior,open} => self.save_shop(c.actor,None,U64(0),title,district,x,y,interior,open),
            Action::UpdateShop {shop_id,expected_version,title,district,x,y,interior,open} => self.save_shop(c.actor,Some(shop_id),expected_version,title,district,x,y,interior,open),
            Action::StockShop {shop_id,item_ids,unit_price} => self.stock_shop(c.actor,shop_id,item_ids,unit_price),
            Action::BeginCraft {
                batch_id,
                input_ids,
                challenge_commitment,
                deadline_ms,
            } => self.begin_craft(
                c.actor,
                batch_id,
                input_ids,
                challenge_commitment,
                deadline_ms,
                false,
            ),
            Action::FinishCraft {
                batch_id,
                tier,
                reason,
            } => self.finish_craft(c.actor, batch_id, tier, reason, false, op_id),
            Action::BeginRecovery {
                batch_id,
                bank_input_ids,
                challenge_commitment,
                deadline_ms,
            } => self.begin_craft(
                c.actor,
                batch_id,
                bank_input_ids,
                challenge_commitment,
                deadline_ms,
                true,
            ),
            Action::FinishRecovery {
                batch_id,
                tier,
                reason,
            } => self.finish_craft(c.actor, batch_id, tier, reason, true, op_id),
            Action::List {
                item_ids,
                unit_price,
            } => self.list(c.actor, item_ids, unit_price),
            Action::CancelListing { listing_id } => self.cancel_listing(c.actor, listing_id),
            Action::Buy {
                listing_id,
                item_ids,
                expected_unit_price,
            } => self.buy(c.actor, listing_id, item_ids, expected_unit_price),
            Action::BankBuy {
                item_ids,
                expected_unit_prices,
            } => self.bank_trade(c.actor, item_ids, expected_unit_prices, true),
            Action::BankSell {
                item_ids,
                expected_unit_prices,
            } => self.bank_trade(c.actor, item_ids, expected_unit_prices, false),
            Action::FillNpcOrder {
                order_id,
                item_ids,
                expected_unit_price,
            } => self.fill_npc_order(c.actor, order_id, item_ids, expected_unit_price, op_id),
            Action::Debit { .. } => Err("DeprecatedSmokeCommand".into()),
            Action::Publish {
                terms,
                fee,
                funding,
            } => self.publish(c.actor, terms, fee, funding, vec![]),
            Action::Admit {
                edition_id,
                expected_version,
                expected_fee,
                loadout_ids,
                seed,
            } => self.admit(
                c.actor,
                edition_id,
                expected_version,
                expected_fee,
                loadout_ids,
                seed,
            ),
            Action::Settle {
                run_id,
                outcome,
                disposition,
                carried_dungeon_ids,
            } => self.settle(
                c.actor,
                run_id,
                Some(outcome),
                None,
                disposition,
                carried_dungeon_ids,
                op_id.into(),
            ),
            Action::Void {
                run_id,
                reason,
                disposition,
            } => self.settle(
                c.actor,
                run_id,
                None,
                Some(reason),
                disposition,
                vec![],
                op_id.into(),
            ),
            Action::PublishRandom {
                terms,
                fee,
                fixed_funding,
                random_tables,
            } => self.publish(c.actor, terms, fee, fixed_funding, random_tables),
            Action::Refresh {
                edition_id,
                fixed_funding,
                random_funding,
            } => self.refresh(c.actor, edition_id, fixed_funding, random_funding),
            Action::SetFee {
                edition_id,
                new_fee,
            } => self.set_fee(c.actor, edition_id, new_fee),
            Action::FinalizeClose { edition_id } => self.finalize_close(c.actor, edition_id),
        }
    }
}
