use crate::*;
use std::collections::{BTreeMap, BTreeSet};
impl Economy {
    pub(crate) fn publish(
        &mut self,
        actor: String,
        terms: Terms,
        fee: U64,
        funding: Vec<String>,
        random_tables: Vec<RandomTable>,
    ) -> Result<String, String> {
        let now = now_ms();
        if terms.run_duration_ms.0 != 900000
            || terms.max_runs != 4
            || !["beginner", "standard", "hard"].contains(&terms.difficulty_tag.as_str())
            || !["combat", "loot", "challenge"].contains(&terms.style_tag.as_str())
        {
            return Err("InvalidRules".into());
        }
        if self.editions.len() >= 32 {
            return Err("EditionCapacity".into());
        }
        if terms.title.trim().is_empty()
            || terms.title.len() > 80
            || !matches!(terms.rules_version, 1 | 2 | 3)
            || !(2..=4).contains(&terms.modules.len())
            || terms.modules.iter().any(|m| {
                if terms.rules_version == 3 {
                    !valid_custom_module(m)
                } else {
                    m != "cellar" && m != "gauntlet"
                }
            })
        {
            return Err("InvalidTerms".into());
        }
        if terms.closes_at_ms.0 <= now
            || terms.closes_at_ms.0 <= terms.opens_at_ms.0
            || terms.closes_at_ms.0 - terms.opens_at_ms.0 > 86_400_000
            || fee.0 > 1_000_000
            || terms.sockets.len() > 16
            || funding.len() > 128
        {
            return Err("InvalidTerms".into());
        }
        let mut ids = BTreeSet::new();
        let mut slots = BTreeSet::new();
        let mut required = BTreeMap::<ItemType, usize>::new();
        let mut cost = 2;
        for socket in &terms.sockets {
            if socket.id.is_empty()
                || socket.id.len() > 40
                || socket.room as usize >= terms.modules.len()
                || socket.slot >= 4
                || !ids.insert(socket.id.clone())
                || !slots.insert((socket.room, socket.slot))
            {
                return Err("InvalidSocket".into());
            }
            cost += match socket.enemy {
                Enemy::None => 0,
                Enemy::Pursuer => 2,
                Enemy::Charger => 3,
            };
            cost += u64::from(socket.trap);
            if let Some(ty) = socket.reward {
                *required.entry(ty).or_default() += 1;
                cost += 1;
            }
        }
        let mut table_ids = BTreeSet::new();
        let mut random_sockets = BTreeSet::new();
        let mut all_funding = funding.clone();
        if random_tables.len() > 16 {
            return Err("InvalidRandomTable".into());
        }
        for table in &random_tables {
            if table.table_id.is_empty()
                || table.table_id.len() > 40
                || !table_ids.insert(&table.table_id)
                || table.socket_ids.is_empty()
                || table.socket_ids.len() > 16
            {
                return Err("InvalidRandomTable".into());
            }
            for socket_id in &table.socket_ids {
                if !random_sockets.insert(socket_id)
                    || !terms
                        .sockets
                        .iter()
                        .any(|s| &s.id == socket_id && s.reward.is_none())
                {
                    return Err("InvalidRandomSocket".into());
                }
                cost += 1;
            }
            if table.item_ids.len() < table.socket_ids.len() {
                return Err("IncompleteBundle".into());
            }
            all_funding.extend(table.item_ids.clone());
        }
        if all_funding.len() > 128 {
            return Err("FundingCapacity".into());
        }
        if all_funding.iter().collect::<BTreeSet<_>>().len() != all_funding.len() {
            return Err("DuplicateFunding".into());
        }
        if terms.no_reward != (required.is_empty() && random_tables.is_empty()) {
            return Err("RewardDeclaration".into());
        }
        if funding.iter().collect::<BTreeSet<_>>().len() != funding.len() {
            return Err("DuplicateFunding".into());
        }
        let mut available = BTreeMap::<ItemType, usize>::new();
        let mut value = 0;
        for id in &funding {
            let item = self.items.get(id).ok_or("MissingItem")?;
            if item.location
                != (Location::Owned {
                    profile: actor.clone(),
                })
            {
                return Err("UnownedFunding".into());
            }
            if !required.contains_key(&item.item_type) {
                return Err("UnusedFundingType".into());
            }
            *available.entry(item.item_type).or_default() += 1;
            value += item.item_type.value();
        }
        if required
            .iter()
            .any(|(ty, count)| available.get(ty).copied().unwrap_or(0) < *count)
        {
            return Err("IncompleteBundle".into());
        }
        for table in &random_tables {
            for id in &table.item_ids {
                let item = self.items.get(id).ok_or("MissingItem")?;
                if item.location
                    != (Location::Owned {
                        profile: actor.clone(),
                    })
                {
                    return Err("UnownedFunding".into());
                }
                value += item.item_type.value();
            }
        }
        let balance = self.credits.get_mut(&actor).unwrap();
        if *balance < cost {
            return Err("InsufficientCredits".into());
        }
        *balance -= cost;
        self.bank += cost;
        let id = format!("edition-{}", self.next_edition);
        self.next_edition += 1;
        for item_id in &funding {
            let item = self.items.get_mut(item_id).unwrap();
            item.location = Location::EditionFixed {
                edition: id.clone(),
                item_type: item.item_type,
            };
        }
        for table in &random_tables {
            for item_id in &table.item_ids {
                self.items.get_mut(item_id).unwrap().location = Location::EditionRandom {
                    edition: id.clone(),
                    table_id: table.table_id.clone(),
                };
            }
        }
        let edition = Edition {
            id: id.clone(),
            maker: actor,
            terms_hash: if random_tables.is_empty() {
                hash(&terms)
            } else {
                hash(&(&terms, &random_tables))
            },
            terms,
            fee,
            version: U64(1),
            placement_paid: U64(cost),
            original_value: U64(value),
            refresh_value: U64(0),
            refresh_ids: vec![],
            random_tables,
            active_runs: vec![],
            funded_ids: all_funding,
            closed: false,
            extracted_value: U64(0),
            consumed_value: U64(0),
            banked_value: U64(0),
        };
        self.editions.insert(id.clone(), edition);
        Ok(id)
    }
}

impl Economy {
    pub(crate) fn finalize_close(
        &mut self,
        actor: String,
        edition_id: String,
    ) -> Result<String, String> {
        let edition = self.editions.get(&edition_id).ok_or("MissingEdition")?;
        if edition.maker != actor {
            return Err("WrongMaker".into());
        }
        if edition.closed {
            return Err("AlreadyClosed".into());
        }
        if now_ms() < edition.terms.closes_at_ms.0 {
            return Err("BeforeCutoff".into());
        }
        if !edition.active_runs.is_empty() {
            return Err("ActiveReservations".into());
        }
        let mut banked = 0u64;
        for item in self.items.values_mut() {
            if matches!(&item.location,Location::EditionFixed{edition,..}|Location::EditionRandom{edition,..} if edition==&edition_id)
            {
                banked = banked
                    .checked_add(item.item_type.value())
                    .ok_or("ValueOverflow")?;
                item.location = Location::Bank;
            }
        }
        let edition = self.editions.get_mut(&edition_id).unwrap();
        edition.banked_value = U64(edition
            .banked_value
            .0
            .checked_add(banked)
            .ok_or("ValueOverflow")?);
        edition.closed = true;
        Ok(edition_id)
    }
}

impl Economy {
    pub(crate) fn set_fee(
        &mut self,
        actor: String,
        edition_id: String,
        new_fee: U64,
    ) -> Result<String, String> {
        let e = self.editions.get_mut(&edition_id).ok_or("MissingEdition")?;
        if e.maker != actor {
            return Err("WrongMaker".into());
        }
        if e.closed || now_ms() >= e.terms.closes_at_ms.0 {
            return Err("EditionNotOpen".into());
        }
        if new_fee.0 > 1_000_000 {
            return Err("InvalidFee".into());
        }
        e.version = U64(e.version.0.checked_add(1).ok_or("VersionOverflow")?);
        e.fee = new_fee;
        Ok(edition_id)
    }
    pub(crate) fn refresh(
        &mut self,
        actor: String,
        edition_id: String,
        fixed: Vec<String>,
        random: Vec<RandomFunding>,
    ) -> Result<String, String> {
        let e = self
            .editions
            .get(&edition_id)
            .ok_or("MissingEdition")?
            .clone();
        if e.maker != actor {
            return Err("WrongMaker".into());
        }
        if e.closed || now_ms() >= e.terms.closes_at_ms.0 {
            return Err("EditionNotOpen".into());
        }
        let count = fixed.len() + random.iter().map(|t| t.item_ids.len()).sum::<usize>();
        if count == 0 || count > 128 || random.len() > 16 || e.refresh_ids.len() + count > 128 {
            return Err("FundingCapacity".into());
        }
        let mut seen = BTreeSet::new();
        let mut tables = BTreeSet::new();
        let mut value = 0;
        for (id, table) in fixed.iter().map(|id| (id, None)).chain(
            random
                .iter()
                .flat_map(|t| t.item_ids.iter().map(move |id| (id, Some(&t.table_id)))),
        ) {
            if !seen.insert(id.clone()) {
                return Err("DuplicateFunding".into());
            }
            let item = self.items.get_mut(id).ok_or("MissingItem")?;
            if item.location
                != (Location::Owned {
                    profile: actor.clone(),
                })
            {
                return Err("UnownedFunding".into());
            }
            item.location = if let Some(table_id) = table {
                if !e.random_tables.iter().any(|t| &t.table_id == table_id) {
                    return Err("UnknownRandomTable".into());
                }
                Location::EditionRandom {
                    edition: edition_id.clone(),
                    table_id: table_id.clone(),
                }
            } else {
                if !e
                    .terms
                    .sockets
                    .iter()
                    .any(|s| s.reward == Some(item.item_type))
                {
                    return Err("UnusedFundingType".into());
                }
                Location::EditionFixed {
                    edition: edition_id.clone(),
                    item_type: item.item_type,
                }
            };
            value += item.item_type.value();
        }
        for table in &random {
            if table.item_ids.is_empty() || !tables.insert(&table.table_id) {
                return Err("InvalidRandomTable".into());
            }
        }
        let e = self.editions.get_mut(&edition_id).unwrap();
        e.refresh_value = U64(e
            .refresh_value
            .0
            .checked_add(value)
            .ok_or("ValueOverflow")?);
        e.refresh_ids.extend(seen);
        Ok(edition_id)
    }
}

// JSON-only validation types: deliberately not part of the persisted Borsh schema.
#[derive(near_sdk::serde::Deserialize)]
#[serde(crate = "near_sdk::serde")]
struct CustomPoint {
    x: usize,
    y: usize,
}
#[derive(near_sdk::serde::Deserialize)]
#[serde(crate = "near_sdk::serde")]
struct CustomFloor {
    tiles: Vec<String>,
    spawn: CustomPoint,
    exit: CustomPoint,
    sockets: Vec<CustomPoint>,
}
fn valid_custom_module(module: &str) -> bool {
    if module.len() > 2048 {
        return false;
    }
    let Some(json) = module.strip_prefix("custom:") else {
        return false;
    };
    let Ok(floor) = near_sdk::serde_json::from_str::<CustomFloor>(json) else {
        return false;
    };
    if floor.tiles.len() != 9 || floor.sockets.len() != 4 {
        return false;
    }
    for (y, row) in floor.tiles.iter().enumerate() {
        if row.len() != 13 {
            return false;
        }
        for (x, tile) in row.bytes().enumerate() {
            if !matches!(tile, b'#' | b'.')
                || ((x == 0 || x == 12 || y == 0 || y == 8) && tile != b'#')
            {
                return false;
            }
        }
    }
    let mut positions = BTreeSet::new();
    for p in [&floor.spawn, &floor.exit]
        .into_iter()
        .chain(floor.sockets.iter())
    {
        if p.x >= 13
            || p.y >= 9
            || floor.tiles[p.y].as_bytes()[p.x] != b'.'
            || !positions.insert((p.x, p.y))
        {
            return false;
        }
    }
    let mut seen = BTreeSet::new();
    let mut queue = vec![(floor.spawn.x, floor.spawn.y)];
    seen.insert(queue[0]);
    while let Some((x, y)) = queue.pop() {
        // Closed boundaries guarantee every queued floor cell is interior.
        for p in [(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)] {
            if floor.tiles[p.1].as_bytes()[p.0] == b'.' && seen.insert(p) {
                queue.push(p);
            }
        }
    }
    seen.len()
        == floor
            .tiles
            .iter()
            .flat_map(|row| row.bytes())
            .filter(|tile| *tile == b'.')
            .count()
}
