use near_sdk::{json_types::U64, near};
#[near(serializers=[borsh,json])]
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "camelCase")]
pub enum ItemType {
    Club,
    Sword,
    Armor,
    Herb,
    Iron,
    Flask,
    Tonic,
    FineTonic,
}
impl ItemType {
    pub fn value(self) -> u64 {
        match self {
            Self::Club => 4,
            Self::Sword => 12,
            Self::Armor => 8,
            Self::Herb | Self::Iron | Self::Flask => 2,
            Self::Tonic => 6,
            Self::FineTonic => 8,
        }
    }
    pub fn consumable(self) -> bool {
        matches!(self, Self::Tonic | Self::FineTonic)
    }
}
#[near(serializers=[borsh,json])]
#[derive(Clone, Debug, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Location {
    Owned {
        profile: String,
    },
    Listed {
        listing: String,
    },
    EditionFixed {
        edition: String,
        item_type: ItemType,
    },
    EditionRandom {
        edition: String,
        table_id: String,
    },
    Reserved {
        run: String,
        socket: String,
        source_pool: String,
    },
    Loadout {
        run: String,
        profile: String,
    },
    Crafting {
        batch: String,
        source_owner: String,
    },
    Bank,
    Consumed {
        operation: String,
    },
}
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct Item {
    pub id: String,
    pub item_type: ItemType,
    pub location: Location,
}
#[near(serializers=[borsh,json])]
#[derive(Clone, Copy, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Enemy {
    None,
    Pursuer,
    Charger,
}
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct Socket {
    pub id: String,
    pub room: u8,
    pub slot: u8,
    pub enemy: Enemy,
    pub trap: bool,
    pub reward: Option<ItemType>,
}
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct Terms {
    pub title: String,
    pub rules_version: u8,
    pub modules: Vec<String>,
    pub sockets: Vec<Socket>,
    pub opens_at_ms: U64,
    pub closes_at_ms: U64,
    pub no_reward: bool,
    pub difficulty_tag: String,
    pub style_tag: String,
    pub run_duration_ms: U64,
    pub max_runs: u8,
}
#[near(serializers=[borsh,json])]
#[derive(Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Action {
    Debit {
        amount: U64,
    },
    Publish {
        terms: Terms,
        fee: U64,
        funding: Vec<String>,
    },
    Admit {
        edition_id: String,
        expected_version: U64,
        expected_fee: U64,
        loadout_ids: Vec<String>,
        seed: U64,
    },
    Settle {
        run_id: String,
        outcome: Outcome,
        disposition: Partition,
        carried_dungeon_ids: Vec<String>,
    },
    Void {
        run_id: String,
        reason: String,
        disposition: Partition,
    },
    FinalizeClose {
        edition_id: String,
    },
    PublishRandom {
        terms: Terms,
        fee: U64,
        fixed_funding: Vec<String>,
        random_tables: Vec<RandomTable>,
    },
    Refresh {
        edition_id: String,
        fixed_funding: Vec<String>,
        random_funding: Vec<RandomFunding>,
    },
    SetFee {
        edition_id: String,
        new_fee: U64,
    },
    List {
        item_ids: Vec<String>,
        unit_price: U64,
    },
    CancelListing {
        listing_id: String,
    },
    Buy {
        listing_id: String,
        item_ids: Vec<String>,
        expected_unit_price: U64,
    },
    BankBuy {
        item_ids: Vec<String>,
        expected_unit_prices: Vec<U64>,
    },
    BankSell {
        item_ids: Vec<String>,
        expected_unit_prices: Vec<U64>,
    },
    FillNpcOrder {
        order_id: String,
        item_ids: Vec<String>,
        expected_unit_price: U64,
    },
    BeginCraft {
        batch_id: String,
        input_ids: Vec<String>,
        challenge_commitment: String,
        deadline_ms: U64,
    },
    FinishCraft {
        batch_id: String,
        tier: CraftTier,
        reason: FinishReason,
    },
    BeginRecovery {
        batch_id: String,
        bank_input_ids: Vec<String>,
        challenge_commitment: String,
        deadline_ms: U64,
    },
    FinishRecovery {
        batch_id: String,
        tier: CraftTier,
        reason: FinishReason,
    },
    CreateShop {title:String,district:String,x:u8,y:u8,interior:String,open:bool},
    UpdateShop {shop_id:String,expected_version:U64,title:String,district:String,x:u8,y:u8,interior:String,open:bool},
    StockShop {shop_id:String,item_ids:Vec<String>,unit_price:U64},
}
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct Command {
    pub actor: String,
    pub action: Action,
}
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct Receipt {
    pub op_id: String,
    pub payload_hash: String,
    pub status: String,
    pub result: String,
    pub run: Option<Run>,
}
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct RandomTable {
    pub table_id: String,
    pub socket_ids: Vec<String>,
    pub item_ids: Vec<String>,
}
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct RandomFunding {
    pub table_id: String,
    pub item_ids: Vec<String>,
}
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct Edition {
    pub id: String,
    pub maker: String,
    pub terms: Terms,
    pub terms_hash: String,
    pub fee: U64,
    pub version: U64,
    pub placement_paid: U64,
    pub original_value: U64,
    pub refresh_value: U64,
    pub refresh_ids: Vec<String>,
    pub random_tables: Vec<RandomTable>,
    pub active_runs: Vec<String>,
    pub funded_ids: Vec<String>,
    pub closed: bool,
    // Cumulative dungeon reward reference values; never include town loadout.
    pub extracted_value: U64,
    pub consumed_value: U64,
    pub banked_value: U64,
}
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct Assignment {
    pub socket: String,
    pub item_id: String,
    pub source_pool: String,
}
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct Run {
    pub id: String,
    pub edition: String,
    pub player: String,
    pub fee: U64,
    pub deadline_ms: U64,
    pub seed: U64,
    pub loadout_ids: Vec<String>,
    pub assignments: Vec<Assignment>,
    pub status: String,
    pub terminal_reason: Option<String>,
}
#[near(serializers=[json])]
pub struct CatalogEntry {
    pub item_type: ItemType,
    pub value: U64,
    pub consumable: bool,
}
#[near(serializers=[json])]
pub struct Costs {
    pub publication: U64,
    pub pursuer: U64,
    pub charger: U64,
    pub trap: U64,
    pub reward_socket: U64,
}
#[near(serializers=[json])]
pub struct Rules {
    pub catalog: Vec<CatalogEntry>,
    pub costs: Costs,
    pub run_duration_ms: U64,
    pub max_runs: u8,
}
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct Listing {
    pub id: String,
    pub seller: String,
    pub item_ids: Vec<String>,
    pub remaining_ids: Vec<String>,
    pub unit_price: U64,
    pub status: String,
}
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct NpcOrder {
    pub id: String,
    pub item_type: ItemType,
    pub unit_price: U64,
    pub remaining: u8,
    pub budget: U64,
    pub seeded_demo_demand: bool,
}
#[near(serializers=[json])]
pub struct BankPrice {
    pub item_type: ItemType,
    pub sale_price: U64,
    pub buyback_price: U64,
}
#[near(serializers=[json])]
pub struct Snapshot {
    pub shops: Vec<Shopfront>,
    pub credits: std::collections::BTreeMap<String, U64>,
    pub bank: U64,
    pub items: Vec<Item>,
    pub editions: Vec<Edition>,
    pub runs: Vec<Run>,
    pub listings: Vec<Listing>,
    pub npc_order: NpcOrder,
    pub bank_prices: Vec<BankPrice>,
    pub batches: Vec<CraftBatch>,
    pub recovery: RecoveryState,
    pub coin_issuance: crate::buyin::CoinIssuance,
}

#[near(serializers=[borsh,json])]
#[derive(Clone, Copy, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Outcome {
    Extracted,
    Died,
    Abandoned,
    Expired,
}
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct Partition {
    pub town_consumed: Vec<String>,
    pub town_returned: Vec<String>,
    pub town_forfeited: Vec<String>,
    pub dungeon_consumed: Vec<String>,
    pub dungeon_extracted: Vec<String>,
    pub dungeon_returned: Vec<String>,
}

#[near(serializers=[borsh,json])]
#[derive(Clone, Copy, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum CraftTier {
    Normal,
    Fine,
}
#[near(serializers=[borsh,json])]
#[derive(Clone, Copy, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum FinishReason {
    Completed,
    Expired,
}
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct CraftBatch {
    pub id: String,
    pub actor: String,
    pub input_ids: Vec<String>,
    pub challenge_commitment: String,
    pub deadline_ms: U64,
    pub recovery: bool,
    pub wage_reserved: U64,
    pub status: String,
    pub tier: Option<CraftTier>,
    pub reason: Option<FinishReason>,
    pub output_ids: Vec<String>,
}
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct RecoveryState {
    pub epoch: String,
    pub budget: U64,
    pub wage: U64,
    pub max_jobs_per_profile: u8,
    pub jobs: std::collections::BTreeMap<String, u8>,
}

#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct Shopfront {pub id:String,pub owner:String,pub title:String,pub district:String,pub x:u8,pub y:u8,pub interior:String,pub version:U64,pub open:bool,pub listing_ids:Vec<String>}
