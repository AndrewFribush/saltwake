mod editions;
mod model;
mod runs;
mod settlement;
use model::*;
use near_sdk::{borsh, env, json_types::U64, near, AccountId, PanicOnDefault};
use std::collections::BTreeMap;

#[near(contract_state)]
#[derive(PanicOnDefault, Clone)]
pub struct Economy {
    operator: AccountId,
    credits: BTreeMap<String, u64>,
    bank: u64,
    items: BTreeMap<String, Item>,
    editions: BTreeMap<String, Edition>,
    runs: BTreeMap<String, Run>,
    receipts: BTreeMap<String, Receipt>,
    next_edition: u64,
    next_run: u64,
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
    #[init]
    #[private]
    pub fn init_demo() -> Self {
        let mut s = Self {
            operator: env::predecessor_account_id(),
            credits: BTreeMap::new(),
            bank: 0,
            items: BTreeMap::new(),
            editions: BTreeMap::new(),
            runs: BTreeMap::new(),
            receipts: BTreeMap::new(),
            next_edition: 0,
            next_run: 0,
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
    pub fn execute(&mut self, op_id: String, command: Command) -> Receipt {
        assert_eq!(
            env::predecessor_account_id(),
            self.operator,
            "Operator only"
        );
        assert!(
            env::input().map(|b| b.len()).unwrap_or(0) <= 32768,
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
            credits: self
                .credits
                .iter()
                .map(|(k, v)| (k.clone(), U64(*v)))
                .collect(),
            bank: U64(self.bank),
            items: self.items.values().cloned().collect(),
            editions: self.editions.values().cloned().collect(),
            runs: self.runs.values().cloned().collect(),
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
    pub fn balances(&self) -> BTreeMap<String, U64> {
        BTreeMap::from([
            ("buyer".into(), U64(*self.credits.get("buyer").unwrap())),
            ("bank".into(), U64(self.bank)),
        ])
    }
}
impl Economy {
    fn reserved_capacity(&self) -> usize {
        self.runs.values().filter(|r| r.status == "active").count()
            + self.editions.values().filter(|e| !e.closed).count()
    }
    fn apply(&mut self, c: Command, op_id: &str) -> Result<String, String> {
        match c.action {
            Action::Debit { .. } => Err("DeprecatedSmokeCommand".into()),
            Action::Publish {
                terms,
                fee,
                funding,
            } => self.publish(c.actor, terms, fee, funding),
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
            Action::FinalizeClose { edition_id } => self.finalize_close(c.actor, edition_id),
        }
    }
}
