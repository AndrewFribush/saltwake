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
        let valid_operating_terms = if matches!(terms.rules_version, 8 | 9 | 10 | 11 | 12 | 13) {
            (60_000..=3_600_000).contains(&terms.run_duration_ms.0)
                && (1..=4).contains(&terms.max_runs)
        } else {
            terms.run_duration_ms.0 == 900000 && terms.max_runs == 4
        };
        if !valid_operating_terms
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
            || !matches!(terms.rules_version, 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13)
            || !(if matches!(terms.rules_version, 9 | 10 | 11 | 12 | 13) { 1..=16 } else { 2..=4 }).contains(&terms.modules.len())
            || terms.modules.iter().any(|m| {
                if terms.rules_version >= 3 {
                    !valid_custom_module(m, if matches!(terms.rules_version, 8 | 9) { 7 } else { terms.rules_version })
                } else {
                    m != "cellar" && m != "gauntlet"
                }
            })
            || (terms.rules_version == 6 && !valid_custom_graph(&terms.modules))
        {
            return Err("InvalidTerms".into());
        }
        if terms.closes_at_ms.0 <= now
            || terms.closes_at_ms.0 <= terms.opens_at_ms.0
            || terms.closes_at_ms.0 - terms.opens_at_ms.0 > 86_400_000
            || fee.0 > 1_000_000
            || terms.sockets.len() > if terms.rules_version >= 4 { 64 } else { 16 }
            || (matches!(terms.rules_version, 9 | 10 | 11 | 12 | 13)
                && terms.modules.iter().filter_map(|m| custom_socket_count(m)).sum::<usize>() > 64)
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
                || (if terms.rules_version >= 4 { custom_socket_count(&terms.modules[socket.room as usize]).map_or(true, |n| socket.slot as usize >= n) } else { socket.slot >= 4 })
                || !ids.insert(socket.id.clone())
                || !slots.insert((socket.room, socket.slot))
            {
                return Err("InvalidSocket".into());
            }
            cost += match socket.enemy {
                Enemy::None => 0,
                Enemy::Pursuer => 2,
                Enemy::Charger => 3,
                _ if terms.rules_version < 12 => return Err("InvalidSocket".into()),
                Enemy::Archer => 3,
                Enemy::Bomber => 2,
                Enemy::Brute => 4,
                Enemy::Nest => 4,
            };
            cost += u64::from(socket.trap);
            if let Some(ty) = socket.reward {
                *required.entry(ty).or_default() += 1;
                cost += 1;
            }
        }
        if matches!(terms.rules_version, 7 | 8 | 9 | 10 | 11 | 12 | 13) && !valid_tuned_terms(&terms) {
            return Err("InvalidTerms".into());
        }
        if matches!(terms.rules_version, 10 | 11 | 12 | 13) && !valid_device_wiring(&terms.modules, terms.rules_version) {
            return Err("InvalidTerms".into());
        }
        if terms.rules_version >= 12 {
            let mut total = 0usize;
            if terms.rules_version == 13 && !valid_lock_keys(&terms.modules) {
                return Err("InvalidTerms".into());
            }
            for module in &terms.modules {
                let (features, feature_cost) = depth_features(module, terms.rules_version).ok_or("InvalidTerms")?;
                total += features;
                cost += feature_cost;
            }
            if total > 128 {
                return Err("InvalidTerms".into());
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
        if now_ms() < edition.terms.closes_at_ms.0 && !is_retired(&edition_id) {
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
// Only v6+ reads links. Older versions retain their ignored-metadata behavior.
#[derive(near_sdk::serde::Deserialize)]
#[serde(crate = "near_sdk::serde")]
struct CustomLinks {
    links: Vec<CustomLink>,
}
#[derive(near_sdk::serde::Deserialize)]
#[serde(crate = "near_sdk::serde")]
struct CustomLink {
    id: String,
    x: usize,
    y: usize,
    to: usize,
    // Deserialization enforces a required boolean; traversal is engine policy.
    #[serde(rename = "require_clear")]
    _require_clear: bool,
}
#[derive(near_sdk::serde::Deserialize)]
#[serde(crate = "near_sdk::serde")]
struct TunedFloor {
    tuning: Vec<EncounterTuning>,
    #[serde(default, deserialize_with = "present_links")]
    links: Option<Vec<CustomLink>>,
}
// Default handles absent fields; present values must deserialize as the concrete
// type, so explicit null is rejected rather than treated as an omitted override.
fn present_links<'de, D: near_sdk::serde::Deserializer<'de>>(d: D) -> Result<Option<Vec<CustomLink>>, D::Error> {
    <Vec<CustomLink> as near_sdk::serde::Deserialize>::deserialize(d).map(Some)
}
fn present_u8<'de, D: near_sdk::serde::Deserializer<'de>>(d: D) -> Result<Option<u8>, D::Error> {
    <u8 as near_sdk::serde::Deserialize>::deserialize(d).map(Some)
}
#[derive(near_sdk::serde::Deserialize)]
#[serde(crate = "near_sdk::serde", deny_unknown_fields)]
struct EncounterTuning {
    slot: usize,
    #[serde(default, deserialize_with = "present_u8")]
    hp: Option<u8>,
    #[serde(default, deserialize_with = "present_u8")]
    damage: Option<u8>,
    #[serde(default, deserialize_with = "present_u8")]
    alert: Option<u8>,
    #[serde(default, deserialize_with = "present_u8")]
    trap_period: Option<u8>,
    #[serde(default, deserialize_with = "present_u8")]
    trap_active: Option<u8>,
    #[serde(default, deserialize_with = "present_u8")]
    trap_offset: Option<u8>,
    #[serde(default, deserialize_with = "present_u8")]
    trap_damage: Option<u8>,
}
fn valid_tuned_terms(terms: &Terms) -> bool {
    let mut has_links = false;
    for (room, module) in terms.modules.iter().enumerate() {
        let Some(json) = module.strip_prefix(match terms.rules_version { 10 => "custom10:", 11 => "custom11:", 12 => "custom12:", 13 => "custom13:", _ => "custom7:" }) else { return false; };
        let Ok(floor) = near_sdk::serde_json::from_str::<TunedFloor>(json) else { return false; };
        has_links |= floor.links.is_some();
        if floor.tuning.len() > 16 { return false; }
        let mut slots = BTreeSet::new();
        for t in floor.tuning {
            let enemy_fields = t.hp.is_some() || t.damage.is_some() || t.alert.is_some();
            let trap_fields = t.trap_period.is_some() || t.trap_active.is_some() || t.trap_offset.is_some() || t.trap_damage.is_some();
            let Some(socket) = terms.sockets.iter().find(|s| s.room as usize == room && s.slot as usize == t.slot) else { return false; };
            let period = t.trap_period.unwrap_or(2);
            if !slots.insert(t.slot) || (!enemy_fields && !trap_fields)
                || (enemy_fields && matches!(socket.enemy, Enemy::None))
                || (trap_fields && !socket.trap)
                || t.hp.is_some_and(|v| !(1..=30).contains(&v))
                || t.damage.is_some_and(|v| !(1..=12).contains(&v))
                || t.alert.is_some_and(|v| !(1..=8).contains(&v))
                || !(2..=8).contains(&period)
                || !(1..period).contains(&t.trap_active.unwrap_or(1))
                || t.trap_offset.unwrap_or(0) >= period
                || t.trap_damage.is_some_and(|v| !(1..=12).contains(&v))
            { return false; }
        }
    }
    !has_links || valid_custom_graph(&terms.modules)
}
fn valid_custom_graph(modules: &[String]) -> bool {
    let mut edges = Vec::new();
    for module in modules {
        let Some(json) = module.strip_prefix("custom6:").or_else(|| module.strip_prefix("custom7:")).or_else(|| module.strip_prefix("custom10:")).or_else(|| module.strip_prefix("custom11:")).or_else(|| module.strip_prefix("custom12:")).or_else(|| module.strip_prefix("custom13:")) else { return false; };
        let Ok(floor) = near_sdk::serde_json::from_str::<CustomLinks>(json) else { return false; };
        if floor.links.iter().any(|link| link.to >= modules.len()) {
            return false;
        }
        edges.push(floor.links);
    }
    if edges.is_empty() { return false; }
    let mut seen = BTreeSet::from([0]);
    let mut queue = vec![0];
    while let Some(room) = queue.pop() {
        for link in &edges[room] {
            if seen.insert(link.to) { queue.push(link.to); }
        }
    }
    seen.len() == modules.len()
}
fn custom_socket_count(module: &str) -> Option<usize> {
 let json = module.strip_prefix("custom4:").or_else(|| module.strip_prefix("custom5:")).or_else(|| module.strip_prefix("custom6:")).or_else(|| module.strip_prefix("custom7:")).or_else(|| module.strip_prefix("custom10:")).or_else(|| module.strip_prefix("custom11:")).or_else(|| module.strip_prefix("custom12:")).or_else(|| module.strip_prefix("custom13:"))?;
 near_sdk::serde_json::from_str::<CustomFloor>(json).ok().map(|f| f.sockets.len())
}
fn valid_custom_module(module: &str, version: u8) -> bool {
    if module.len() > if matches!(version, 12 | 13) { 6144 } else if matches!(version, 7 | 10 | 11) { 4096 } else { 2048 } {
        return false;
    }
    let prefix = match version {
        3 => "custom:",
        4 => "custom4:",
        5 => "custom5:",
        6 => "custom6:",
        7 => "custom7:",
        10 => "custom10:",
        11 => "custom11:",
        12 => "custom12:",
        13 => "custom13:",
        _ => return false,
    };
    let Some(json) = module.strip_prefix(prefix) else {
        return false;
    };
    let Ok(floor) = near_sdk::serde_json::from_str::<CustomFloor>(json) else {
        return false;
    };
    let height = floor.tiles.len();
    let width = floor.tiles.first().map_or(0, |row| row.len());
    let valid_dimensions = if version >= 5 {
        (5..=31).contains(&width) && (5..=31).contains(&height)
    } else {
        width == 13 && height == 9
    };
    if !valid_dimensions || (if version >= 4 { floor.sockets.len() > 16 } else { floor.sockets.len() != 4 }) {
        return false;
    }
    for (y, row) in floor.tiles.iter().enumerate() {
        if row.len() != width {
            return false;
        }
        for (x, tile) in row.bytes().enumerate() {
            if !matches!(tile, b'#' | b'.')
                || ((x == 0 || x == width - 1 || y == 0 || y == height - 1) && tile != b'#')
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
        if p.x >= width
            || p.y >= height
            || floor.tiles[p.y].as_bytes()[p.x] != b'.'
            || !positions.insert((p.x, p.y))
        {
            return false;
        }
    }
    if version >= 6 {
        let links = if version == 6 {
            let Ok(graph) = near_sdk::serde_json::from_str::<CustomLinks>(json) else { return false; };
            graph.links
        } else {
            let Ok(floor) = near_sdk::serde_json::from_str::<TunedFloor>(json) else { return false; };
            floor.links.unwrap_or_default()
        };
        if links.len() > 8 { return false; }
        let mut ids = BTreeSet::new();
        for link in links {
            if link.id.is_empty() || link.id.len() > 32 || !ids.insert(link.id)
                || link.x >= width || link.y >= height
                || floor.tiles[link.y].as_bytes()[link.x] != b'.'
                || !positions.insert((link.x, link.y))
            {
                return false;
            }
        }
    }
    if matches!(version, 10 | 11 | 12 | 13) {
        let Ok(devices) = near_sdk::serde_json::from_str::<DeviceFloor>(json) else { return false; };
        if devices.devices.len() > 16 { return false; }
        let mut ids = BTreeSet::new();
        for device in &devices.devices {
            let (id, x, y, channel) = device.fields();
            if id.is_empty() || id.len() > 32 || !ids.insert(id)
                || !valid_channel(channel) || x >= width || y >= height
                || floor.tiles[y].as_bytes()[x] != b'.' || !positions.insert((x, y))
            { return false; }
        }
    }
    if matches!(version, 12 | 13) {
        return depth_floor_valid(json, &floor.tiles, (floor.spawn.x, floor.spawn.y), &mut positions, version);
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

// Devices are interpreted only by v10+; older module metadata remains ignored.
#[derive(near_sdk::serde::Deserialize)]
#[serde(crate = "near_sdk::serde")]
struct DeviceFloor {
    devices: Vec<Device>,
}
#[derive(near_sdk::serde::Deserialize)]
#[serde(crate = "near_sdk::serde", tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
enum Device {
    Switch {
        id: String, x: usize, y: usize, channel: String,
        #[serde(rename = "mode")]
        _mode: SwitchMode,
    },
    Door {
        id: String, x: usize, y: usize, channel: String,
        #[serde(rename = "open_when")]
        _open_when: bool,
    },
}
#[derive(near_sdk::serde::Deserialize)]
#[serde(crate = "near_sdk::serde", rename_all = "snake_case")]
enum SwitchMode { Toggle, Set, Clear }
impl Device {
    fn fields(&self) -> (&str, usize, usize, &str) {
        match self {
            Self::Switch { id, x, y, channel, .. } | Self::Door { id, x, y, channel, .. } => (id, *x, *y, channel),
        }
    }
}
fn valid_channel(channel: &str) -> bool {
    let bytes = channel.as_bytes();
    !bytes.is_empty() && bytes.len() <= 32 && bytes[0].is_ascii_alphabetic()
        && bytes.iter().all(|b| b.is_ascii_alphanumeric() || matches!(b, b'_' | b'-'))
}
fn valid_device_wiring(modules: &[String], version: u8) -> bool {
    let mut switches = BTreeSet::new();
    let mut doors = BTreeSet::new();
    let mut count = 0;
    let mut has_extraction = false;
    for module in modules {
        let Some(json) = module.strip_prefix(match version { 13 => "custom13:", 12 => "custom12:", 11 => "custom11:", _ => "custom10:" }) else { return false; };
        let Ok(floor) = near_sdk::serde_json::from_str::<DeviceFloor>(json) else { return false; };
        if version >= 11 {
            let Ok(exit) = near_sdk::serde_json::from_str::<ExitFloor>(json) else { return false; };
            has_extraction |= exit.exit_rule.extract;
            if exit.exit_rule.channel.is_some() != exit.exit_rule.value.is_some() { return false; }
            if let Some(channel) = exit.exit_rule.channel {
                if !valid_channel(&channel) { return false; }
                doors.insert(channel);
            }
        }
        if version == 13 {
            let Ok(depth) = near_sdk::serde_json::from_str::<DepthFloor>(json) else { return false; };
            for f in depth.features { if let Feature::Plate { channel, .. } = f { switches.insert(channel); } }
        }
        count += floor.devices.len();
        if count > 64 { return false; }
        for device in floor.devices {
            match device {
                Device::Switch { channel, .. } => { switches.insert(channel); },
                Device::Door { channel, .. } => { doors.insert(channel); },
            }
        }
    }
    (version < 11 || has_extraction) && doors.is_subset(&switches)
}

// Exit policies are only interpreted by v11. Presence-aware deserializers reject
// explicit null while allowing both signal fields to be omitted.
#[derive(near_sdk::serde::Deserialize)]
#[serde(crate = "near_sdk::serde")]
struct ExitFloor {
    #[serde(deserialize_with = "exit_rule_object")]
    exit_rule: ExitRule,
}
fn exit_rule_object<'de, D: near_sdk::serde::Deserializer<'de>>(d: D) -> Result<ExitRule, D::Error> {
    struct ObjectVisitor;
    impl<'de> near_sdk::serde::de::Visitor<'de> for ObjectVisitor {
        type Value = ExitRule;
        fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result { f.write_str("an exit rule object") }
        fn visit_map<M: near_sdk::serde::de::MapAccess<'de>>(self, map: M) -> Result<ExitRule, M::Error> {
            <ExitRule as near_sdk::serde::Deserialize>::deserialize(near_sdk::serde::de::value::MapAccessDeserializer::new(map))
        }
    }
    d.deserialize_map(ObjectVisitor)
}
#[derive(near_sdk::serde::Deserialize)]
#[serde(crate = "near_sdk::serde", deny_unknown_fields)]
struct ExitRule {
    extract: bool,
    #[serde(rename = "require_clear")]
    _require_clear: bool,
    #[serde(default, deserialize_with = "present_string")]
    channel: Option<String>,
    #[serde(default, deserialize_with = "present_bool")]
    value: Option<bool>,
}
fn present_string<'de, D: near_sdk::serde::Deserializer<'de>>(d: D) -> Result<Option<String>, D::Error> {
    <String as near_sdk::serde::Deserialize>::deserialize(d).map(Some)
}
fn present_bool<'de, D: near_sdk::serde::Deserializer<'de>>(d: D) -> Result<Option<bool>, D::Error> {
    <bool as near_sdk::serde::Deserialize>::deserialize(d).map(Some)
}

// Rules v12 depth features. Every field is required and range-checked; unknown kinds or
// fields are rejected. Cracked walls sit on inner walls; chasms block connectivity.
#[derive(near_sdk::serde::Deserialize)]
#[serde(crate = "near_sdk::serde")]
struct DepthFloor {
    features: Vec<Feature>,
    #[serde(default, deserialize_with = "present_tide")]
    tide: Option<Tide>,
}
#[derive(near_sdk::serde::Deserialize)]
#[serde(crate = "near_sdk::serde", deny_unknown_fields)]
struct Tide {
    turns: u8,
    damage: u8,
}
fn present_tide<'de, D: near_sdk::serde::Deserializer<'de>>(d: D) -> Result<Option<Tide>, D::Error> {
    <Tide as near_sdk::serde::Deserialize>::deserialize(d).map(Some)
}
#[derive(near_sdk::serde::Deserialize)]
#[serde(crate = "near_sdk::serde", rename_all = "snake_case")]
enum Boon { Might, Ward, Sight }
#[derive(near_sdk::serde::Deserialize)]
#[serde(crate = "near_sdk::serde", rename_all = "snake_case")]
enum Supply { Bomb, Dart, Flash }
#[derive(near_sdk::serde::Deserialize)]
#[serde(crate = "near_sdk::serde", tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
enum Feature {
    Barrel { id: String, x: usize, y: usize, damage: u8 },
    Crack { id: String, x: usize, y: usize, hp: u8 },
    Oil { id: String, x: usize, y: usize },
    Pit { id: String, x: usize, y: usize },
    Fountain { id: String, x: usize, y: usize, heal: u8, charges: u8 },
    Altar { id: String, x: usize, y: usize, #[serde(rename = "boon")] _boon: Boon, cost: u8 },
    Cache { id: String, x: usize, y: usize, #[serde(rename = "supply")] _supply: Supply, count: u8 },
    // Rules v13 progression components.
    Key { id: String, x: usize, y: usize, color: String },
    Lock { id: String, x: usize, y: usize, color: String },
    Plate { id: String, x: usize, y: usize, channel: String },
}
impl Feature {
    fn place(&self) -> (&str, usize, usize) {
        match self {
            Self::Barrel { id, x, y, .. } | Self::Crack { id, x, y, .. } | Self::Oil { id, x, y } | Self::Pit { id, x, y }
            | Self::Fountain { id, x, y, .. } | Self::Altar { id, x, y, .. } | Self::Cache { id, x, y, .. }
            | Self::Key { id, x, y, .. } | Self::Lock { id, x, y, .. } | Self::Plate { id, x, y, .. } => (id, *x, *y),
        }
    }
    fn cost(&self) -> u64 { match self { Self::Fountain { .. } | Self::Altar { .. } | Self::Cache { .. } => 2, _ => 1 } }
    fn valid_config(&self) -> bool {
        match self {
            Self::Barrel { damage, .. } => (1..=12).contains(damage),
            Self::Crack { hp, .. } => (1..=5).contains(hp),
            Self::Fountain { heal, charges, .. } => (1..=12).contains(heal) && (1..=3).contains(charges),
            Self::Altar { cost, .. } => (1..=6).contains(cost),
            Self::Cache { count, .. } => (1..=3).contains(count),
            Self::Oil { .. } | Self::Pit { .. } => true,
            Self::Key { color, .. } | Self::Lock { color, .. } => valid_channel(color),
            Self::Plate { channel, .. } => valid_channel(channel),
        }
    }
}
fn depth_features(module: &str, version: u8) -> Option<(usize, u64)> {
    let floor = near_sdk::serde_json::from_str::<DepthFloor>(module.strip_prefix(if version == 13 { "custom13:" } else { "custom12:" })?).ok()?;
    Some((floor.features.len(), floor.features.iter().map(Feature::cost).sum()))
}
fn depth_floor_valid(json: &str, tiles: &[String], spawn: (usize, usize), positions: &mut BTreeSet<(usize, usize)>, version: u8) -> bool {
    let Ok(floor) = near_sdk::serde_json::from_str::<DepthFloor>(json) else { return false; };
    if floor.features.len() > 24 { return false; }
    if let Some(t) = &floor.tide {
        if !(5..=200).contains(&t.turns) || !(1..=6).contains(&t.damage) { return false; }
    }
    let height = tiles.len();
    let width = tiles[0].len();
    let tile = |x: usize, y: usize| tiles[y].as_bytes()[x];
    let mut ids = BTreeSet::new();
    let mut cracks = BTreeSet::new();
    let mut pits = BTreeSet::new();
    for f in &floor.features {
        let (id, x, y) = f.place();
        if version < 13 && matches!(f, Feature::Key { .. } | Feature::Lock { .. } | Feature::Plate { .. }) { return false; }
        if id.is_empty() || id.len() > 32 || !ids.insert(id) || !f.valid_config() || x >= width || y >= height || !positions.insert((x, y)) {
            return false;
        }
        match f {
            Feature::Crack { .. } => {
                if x == 0 || y == 0 || x == width - 1 || y == height - 1 || tile(x, y) != b'#'
                    || ![(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)].iter().any(|&(a, b)| tile(a, b) == b'.') {
                    return false;
                }
                cracks.insert((x, y));
            }
            _ => {
                if tile(x, y) != b'.' { return false; }
                if matches!(f, Feature::Pit { .. }) { pits.insert((x, y)); }
                if matches!(f, Feature::Lock { .. }) { cracks.insert((x, y)); }
            }
        }
    }
    let open = |p: (usize, usize)| !pits.contains(&p) && (tile(p.0, p.1) == b'.' || cracks.contains(&p));
    let mut seen = BTreeSet::from([spawn]);
    let mut queue = vec![spawn];
    while let Some((x, y)) = queue.pop() {
        // Closed boundaries guarantee every queued cell is interior.
        for p in [(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)] {
            if open(p) && seen.insert(p) { queue.push(p); }
        }
    }
    let mut count = 0;
    for y in 0..height { for x in 0..width { if open((x, y)) { count += 1; } } }
    seen.len() == count
}

// v13: every locked door colour needs a key of that colour somewhere in the dungeon.
fn valid_lock_keys(modules: &[String]) -> bool {
    let mut keys = BTreeSet::new();
    let mut locks = BTreeSet::new();
    for module in modules {
        let Some(json) = module.strip_prefix("custom13:") else { return false; };
        let Ok(floor) = near_sdk::serde_json::from_str::<DepthFloor>(json) else { return false; };
        for f in floor.features {
            match f { Feature::Key { color, .. } => { keys.insert(color); }, Feature::Lock { color, .. } => { locks.insert(color); }, _ => {} }
        }
    }
    locks.is_subset(&keys)
}
// Retired editions live in their own storage key so older contract state still loads unchanged.
const RETIRED_KEY: &[u8] = b"retired_editions.v1";
pub(crate) fn read_retired() -> Vec<String> {
    env::storage_read(RETIRED_KEY).map(|b| borsh::from_slice(&b).expect("Corrupt retired list")).unwrap_or_default()
}
pub(crate) fn is_retired(edition_id: &str) -> bool {
    read_retired().iter().any(|id| id == edition_id)
}
impl Economy {
    /// The maker stops new admissions. Terms, funding and records are untouched; active runs settle normally,
    /// and closure (unused treasure to the bank) becomes available as soon as no runs are active.
    pub(crate) fn retire(&mut self, actor: String, edition_id: String) -> Result<String, String> {
        let edition = self.editions.get(&edition_id).ok_or("MissingEdition")?;
        if edition.maker != actor {
            return Err("WrongMaker".into());
        }
        if edition.closed {
            return Err("AlreadyClosed".into());
        }
        let mut retired = read_retired();
        if retired.iter().any(|id| id == &edition_id) {
            return Err("AlreadyRetired".into());
        }
        retired.push(edition_id.clone());
        env::storage_write(RETIRED_KEY, &borsh::to_vec(&retired).unwrap());
        Ok(edition_id)
    }
}
