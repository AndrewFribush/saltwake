use crate::*;
use std::collections::{BTreeMap, BTreeSet};
impl Economy {
    pub(crate) fn publish(
        &mut self,
        actor: String,
        terms: Terms,
        fee: U64,
        funding: Vec<String>,
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
            || terms.rules_version != 1
            || !(2..=4).contains(&terms.modules.len())
            || terms
                .modules
                .iter()
                .any(|m| m != "cellar" && m != "gauntlet")
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
        if terms.no_reward != required.is_empty() {
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
        let edition = Edition {
            id: id.clone(),
            maker: actor,
            terms_hash: hash(&terms),
            terms,
            fee,
            version: U64(1),
            placement_paid: U64(cost),
            original_value: U64(value),
            active_runs: vec![],
            funded_ids: funding,
            closed: false,
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
        for item in self.items.values_mut() {
            if matches!(&item.location,Location::EditionFixed{edition,..}|Location::EditionRandom{edition,..} if edition==&edition_id)
            {
                item.location = Location::Bank;
            }
        }
        self.editions.get_mut(&edition_id).unwrap().closed = true;
        Ok(edition_id)
    }
}
