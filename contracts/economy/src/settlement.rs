use crate::*;
use std::collections::BTreeSet;
fn exact_partition(source: &[String], groups: &[&Vec<String>]) -> bool {
    let flat: Vec<_> = groups.iter().flat_map(|g| g.iter()).collect();
    flat.len() == source.len()
        && flat.iter().copied().collect::<BTreeSet<_>>().len() == flat.len()
        && flat.into_iter().collect::<BTreeSet<_>>() == source.iter().collect::<BTreeSet<_>>()
}
impl Economy {
    pub(crate) fn settle(
        &mut self,
        actor: String,
        run_id: String,
        outcome: Option<Outcome>,
        reason: Option<String>,
        d: Partition,
        carried: Vec<String>,
        operation: String,
    ) -> Result<String, String> {
        let run = self.runs.get(&run_id).ok_or("MissingRun")?.clone();
        if actor != run.player {
            return Err("WrongProfile".into());
        }
        if run.status != "active" {
            return Err("TerminalRun".into());
        }
        if outcome == Some(Outcome::Expired) && now_ms() < run.deadline_ms.0 {
            return Err("PrematureExpiry".into());
        }
        if outcome.is_none()
            && reason
                .as_ref()
                .map(|r| r.trim().is_empty() || r.len() > 200)
                .unwrap_or(true)
        {
            return Err("VoidReasonRequired".into());
        }
        let rewards: Vec<_> = run.assignments.iter().map(|a| a.item_id.clone()).collect();
        if !exact_partition(
            &run.loadout_ids,
            &[&d.town_consumed, &d.town_returned, &d.town_forfeited],
        ) || !exact_partition(
            &rewards,
            &[
                &d.dungeon_consumed,
                &d.dungeon_extracted,
                &d.dungeon_returned,
            ],
        ) {
            return Err("InvalidPartition".into());
        }
        let loss = matches!(
            outcome,
            Some(Outcome::Died | Outcome::Abandoned | Outcome::Expired)
        );
        if loss && !d.town_returned.is_empty()
            || !loss && !d.town_forfeited.is_empty()
            || outcome != Some(Outcome::Extracted) && !d.dungeon_extracted.is_empty()
        {
            return Err("IllegalDestination".into());
        }
        if carried.iter().collect::<BTreeSet<_>>().len() != carried.len()
            || carried
                .iter()
                .any(|id| !rewards.contains(id) || d.dungeon_consumed.contains(id))
        {
            return Err("InvalidCarriedSet".into());
        }
        if outcome == Some(Outcome::Extracted)
            && carried.iter().collect::<BTreeSet<_>>()
                != d.dungeon_extracted.iter().collect::<BTreeSet<_>>()
        {
            return Err("UnacquiredExtraction".into());
        }
        for id in &run.loadout_ids {
            if self.items.get(id).ok_or("MissingItem")?.location
                != (Location::Loadout {
                    run: run_id.clone(),
                    profile: actor.clone(),
                })
            {
                return Err("WrongSourceLocation".into());
            }
        }
        for a in &run.assignments {
            if self.items.get(&a.item_id).ok_or("MissingItem")?.location
                != (Location::Reserved {
                    run: run_id.clone(),
                    socket: a.socket.clone(),
                    source_pool: a.source_pool.clone(),
                })
            {
                return Err("WrongSourceLocation".into());
            }
        }
        for id in d.town_consumed.iter().chain(d.dungeon_consumed.iter()) {
            if !self.items.get(id).unwrap().item_type.consumable() {
                return Err("NonConsumable".into());
            }
        }
        for id in d.town_consumed.iter().chain(d.dungeon_consumed.iter()) {
            self.items.get_mut(id).unwrap().location = Location::Consumed {
                operation: operation.clone(),
            };
        }
        for id in d.town_returned.iter().chain(d.dungeon_extracted.iter()) {
            self.items.get_mut(id).unwrap().location = Location::Owned {
                profile: actor.clone(),
            };
        }
        for id in &d.town_forfeited {
            self.items.get_mut(id).unwrap().location = Location::Bank;
        }
        for id in &d.dungeon_returned {
            let i = self.items.get_mut(id).unwrap();
            let assignment = run.assignments.iter().find(|a| &a.item_id == id).unwrap();
            i.location = if let Some(table_id) = assignment.source_pool.strip_prefix("random:") {
                Location::EditionRandom {
                    edition: run.edition.clone(),
                    table_id: table_id.into(),
                }
            } else {
                Location::EditionFixed {
                    edition: run.edition.clone(),
                    item_type: i.item_type,
                }
            };
        }
        // Count only the validated dungeon partition. Town items may have been
        // extracted previously; their later consumption/forfeiture is not a new
        // reward disposition for this edition.
        let extracted = d.dungeon_extracted.iter().try_fold(0u64, |value, id| {
            value
                .checked_add(self.items.get(id).unwrap().item_type.value())
                .ok_or("ValueOverflow")
        })?;
        let consumed = d.dungeon_consumed.iter().try_fold(0u64, |value, id| {
            value
                .checked_add(self.items.get(id).unwrap().item_type.value())
                .ok_or("ValueOverflow")
        })?;
        let edition = self.editions.get_mut(&run.edition).unwrap();
        edition.extracted_value = U64(edition
            .extracted_value
            .0
            .checked_add(extracted)
            .ok_or("ValueOverflow")?);
        edition.consumed_value = U64(edition
            .consumed_value
            .0
            .checked_add(consumed)
            .ok_or("ValueOverflow")?);
        edition.active_runs.retain(|id| id != &run_id);
        let recipient = if outcome.is_none() {
            &actor
        } else {
            &edition.maker
        };
        *self.credits.get_mut(recipient).unwrap() += run.fee.0;
        let r = self.runs.get_mut(&run_id).unwrap();
        r.status = match outcome {
            Some(Outcome::Extracted) => "extracted",
            Some(Outcome::Died) => "died",
            Some(Outcome::Abandoned) => "abandoned",
            Some(Outcome::Expired) => "expired",
            None => "void",
        }
        .into();
        r.terminal_reason = reason;
        Ok(run_id)
    }
}
