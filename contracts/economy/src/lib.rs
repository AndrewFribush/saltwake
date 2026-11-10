use near_sdk::{near, env, AccountId, PanicOnDefault, json_types::U64, borsh};
use std::collections::BTreeMap;

#[near(serializers=[borsh])]
struct Command { profile: String, amount: u64 }

#[near(serializers=[borsh, json])]
#[derive(Clone)]
pub struct Receipt { hash: Vec<u8>, buyer: U64, bank: U64 }

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Economy {
    operator: AccountId,
    buyer: u64,
    bank: u64,
    receipts: BTreeMap<String, Receipt>,
}

#[near]
impl Economy {
    #[init]
    pub fn init_demo() -> Self {
        Self { operator: env::predecessor_account_id(), buyer: 10, bank: 0, receipts: BTreeMap::new() }
    }

    // Temporary smoke command; not an admission or general economic interface.
    pub fn debit(&mut self, op_id: String, profile: String, amount: U64) -> Receipt {
        assert_eq!(env::predecessor_account_id(), self.operator, "Operator only");
        assert!(!op_id.is_empty() && op_id.len() <= 64, "Invalid operation ID");
        assert_eq!(profile, "buyer", "Unknown profile");
        let payload = borsh::to_vec(&Command { profile, amount: amount.0 }).unwrap();
        let hash = env::sha256(&payload);
        if let Some(old) = self.receipts.get(&op_id) {
            assert_eq!(old.hash, hash, "Operation payload conflict");
            return old.clone();
        }
        assert!(self.receipts.len() < 128, "Receipt capacity exhausted");
        assert!(amount.0 > 0 && amount.0 <= self.buyer, "Invalid debit");
        self.buyer -= amount.0;
        self.bank = self.bank.checked_add(amount.0).expect("Overflow");
        let receipt = Receipt { hash, buyer: U64(self.buyer), bank: U64(self.bank) };
        self.receipts.insert(op_id, receipt.clone());
        receipt
    }

    pub fn balances(&self) -> BTreeMap<String, U64> {
        BTreeMap::from([("buyer".into(), U64(self.buyer)), ("bank".into(), U64(self.bank))])
    }
}
