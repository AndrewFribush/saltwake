use crate::*;
use std::collections::BTreeSet;
impl Economy {
    pub(crate) fn admit(
        &mut self,
        actor: String,
        edition_id: String,
        expected_version: U64,
        expected_fee: U64,
        loadout_ids: Vec<String>,
        seed: U64,
    ) -> Result<String, String> {
        let edition = self
            .editions
            .get(&edition_id)
            .ok_or("MissingEdition")?
            .clone();
        let now = now_ms();
        if edition.maker == actor {
            return Err("SelfEntry".into());
        }
        if now < edition.terms.opens_at_ms.0 || now >= edition.terms.closes_at_ms.0 {
            return Err("EditionNotOpen".into());
        }
        if expected_version.0 != edition.version.0 || expected_fee.0 != edition.fee.0 {
            return Err("StaleOffer".into());
        }
        if self.runs.len() >= 64 || edition.active_runs.len() >= edition.terms.max_runs as usize {
            return Err("RunCapacity".into());
        }
        if self
            .runs
            .values()
            .any(|r| r.player == actor && r.status == "active")
        {
            return Err("ProfileAlreadyRunning".into());
        }
        if loadout_ids.len() > 8
            || loadout_ids.iter().collect::<BTreeSet<_>>().len() != loadout_ids.len()
        {
            return Err("InvalidLoadout".into());
        }
        let mut weapons = 0;
        let mut armor = 0;
        for id in &loadout_ids {
            let i = self.items.get(id).ok_or("MissingItem")?;
            if i.location
                != (Location::Owned {
                    profile: actor.clone(),
                })
            {
                return Err("UnownedLoadout".into());
            }
            if matches!(i.item_type, ItemType::Club | ItemType::Sword) {
                weapons += 1;
            }
            if i.item_type == ItemType::Armor {
                armor += 1;
            }
        }
        if loadout_ids.len() - weapons.min(1) - armor.min(1) > 6 {
            return Err("BagCapacity".into());
        }
        let mut selected = BTreeSet::new();
        let mut assignments = vec![];
        for socket in &edition.terms.sockets {
            if let Some(ty) = socket.reward {
                let item = self
                    .items
                    .values()
                    .find(|i| {
                        i.item_type == ty
                            && i.location
                                == (Location::EditionFixed {
                                    edition: edition_id.clone(),
                                    item_type: ty,
                                })
                            && !selected.contains(&i.id)
                    })
                    .ok_or("IncompleteBundle")?;
                selected.insert(item.id.clone());
                assignments.push(Assignment {
                    socket: socket.id.clone(),
                    item_id: item.id.clone(),
                    source_pool: format!("fixed:{}", near_sdk::serde_json::to_string(&ty).unwrap()),
                });
            }
        }
        // BTreeMap iteration sorts current stock by item ID. Each socket draws from
        // the remaining table; SHA256 input is Borsh(seed, socket ID), never wall time.
        for socket in &edition.terms.sockets {
            if let Some(table) = edition
                .random_tables
                .iter()
                .find(|t| t.socket_ids.contains(&socket.id))
            {
                let pool: Vec<_> = self
                    .items
                    .values()
                    .filter(|i| {
                        !selected.contains(&i.id)
                            && i.location
                                == (Location::EditionRandom {
                                    edition: edition_id.clone(),
                                    table_id: table.table_id.clone(),
                                })
                    })
                    .collect();
                if pool.is_empty() {
                    return Err("IncompleteBundle".into());
                }
                let digest = env::sha256(&borsh::to_vec(&(seed.0, &socket.id)).unwrap());
                let draw = u64::from_le_bytes(digest[..8].try_into().unwrap());
                let item = pool[(draw % pool.len() as u64) as usize];
                selected.insert(item.id.clone());
                assignments.push(Assignment {
                    socket: socket.id.clone(),
                    item_id: item.id.clone(),
                    source_pool: format!("random:{}", table.table_id),
                });
            }
        }
        let balance = self.credits.get_mut(&actor).unwrap();
        if *balance < edition.fee.0 {
            return Err("InsufficientCredits".into());
        }
        *balance -= edition.fee.0;
        let id = format!("run-{}", self.next_run);
        self.next_run += 1;
        for a in &assignments {
            self.items.get_mut(&a.item_id).unwrap().location = Location::Reserved {
                run: id.clone(),
                socket: a.socket.clone(),
                source_pool: a.source_pool.clone(),
            };
        }
        for item_id in &loadout_ids {
            self.items.get_mut(item_id).unwrap().location = Location::Loadout {
                run: id.clone(),
                profile: actor.clone(),
            };
        }
        self.editions
            .get_mut(&edition_id)
            .unwrap()
            .active_runs
            .push(id.clone());
        self.runs.insert(
            id.clone(),
            Run {
                id: id.clone(),
                edition: edition_id,
                player: actor,
                fee: edition.fee,
                deadline_ms: U64(now.checked_add(edition.terms.run_duration_ms.0).ok_or("TimeOverflow")?),
                seed,
                loadout_ids,
                assignments,
                status: "active".into(),
                terminal_reason: None,
            },
        );
        Ok(id)
    }
}
