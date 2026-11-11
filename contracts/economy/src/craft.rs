use crate::*;
use std::collections::BTreeSet;
impl Economy {
    pub(crate) fn profile_holdings(&self, actor: &str) -> u64 {
        let mut value = self.credits.get(actor).copied().unwrap_or(0);
        for item in self.items.values() {
            let owned = match &item.location {
                Location::Owned { profile } | Location::Loadout { profile, .. } => profile == actor,
                Location::Listed { listing } => self
                    .listings
                    .get(listing)
                    .map(|l| l.seller == actor)
                    .unwrap_or(false),
                Location::Crafting { batch, .. } => self
                    .batches
                    .get(batch)
                    .map(|b| !b.recovery && b.actor == actor)
                    .unwrap_or(false),
                _ => false,
            };
            if owned {
                value = value.saturating_add(item.item_type.value());
            }
        }
        for run in self.runs.values().filter(|r| r.status == "active") {
            // Include refundable player escrow and pending maker income conservatively.
            if run.player == actor
                || self
                    .editions
                    .get(&run.edition)
                    .map(|e| e.maker == actor)
                    .unwrap_or(false)
            {
                value = value.saturating_add(run.fee.0);
            }
        }
        for batch in self.batches.values().filter(|b| b.actor == actor) {
            value = value.saturating_add(batch.wage_reserved.0);
        }
        value
    }
    pub(crate) fn begin_craft(
        &mut self,
        actor: String,
        id: String,
        ids: Vec<String>,
        commitment: String,
        deadline: U64,
        recovery: bool,
    ) -> Result<String, String> {
        if id.is_empty() || id.len() > 64 {
            return Err("InvalidBatchId".into());
        }
        if self.batches.contains_key(&id) {
            return Err("BatchExists".into());
        }
        if self.batches.len() >= crate::cap(64) {
            return Err("BatchCapacity".into());
        }
        if commitment.len() != 64 || !commitment.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Err("InvalidCommitment".into());
        }
        let now = now_ms();
        if deadline.0 <= now || deadline.0 > now.saturating_add(900000) {
            return Err("InvalidDeadline".into());
        }
        if self
            .batches
            .values()
            .any(|b| b.actor == actor && b.status == "active")
        {
            return Err("ProfileAlreadyCrafting".into());
        }
        // A full batch is 2 herbs + 2 flasks -> 2 tonics; a small batch (not for recovery work) is 1 + 1 -> 1.
        let small = !recovery && ids.len() == 2;
        if !(ids.len() == 4 || small) || ids.iter().collect::<BTreeSet<_>>().len() != ids.len() {
            return Err("InvalidRecipe".into());
        }
        if recovery {
            if self.recovery.jobs.get(&actor).copied().unwrap_or(0)
                >= self.recovery.max_jobs_per_profile
            {
                return Err("RecoveryJobCap".into());
            }
            // Recovery work is for anyone who cannot yet afford one batch of ingredients,
            // so the earn path always reaches a first craft: 2 herbs + 2 flasks at catalog value.
            if self.profile_holdings(&actor) >= RECOVERY_HOLDINGS_LIMIT {
                return Err("RecoveryHoldings".into());
            }
            if self.recovery.budget.0 < self.recovery.wage.0 {
                return Err("RecoveryBudget".into());
            }
        }
        let mut herbs = 0;
        let mut flasks = 0;
        for item_id in &ids {
            let item = self.items.get_mut(item_id).ok_or("MissingItem")?;
            let source = if recovery {
                Location::Bank
            } else {
                Location::Owned {
                    profile: actor.clone(),
                }
            };
            if item.location != source {
                return Err("UnownedInput".into());
            }
            match item.item_type {
                ItemType::Herb => herbs += 1,
                ItemType::Flask => flasks += 1,
                _ => return Err("InvalidRecipe".into()),
            };
            item.location = Location::Crafting {
                batch: id.clone(),
                source_owner: if recovery {
                    "bank".into()
                } else {
                    actor.clone()
                },
            };
        }
        if herbs * 2 != ids.len() || flasks * 2 != ids.len() {
            return Err("InvalidRecipe".into());
        }
        let wage = if recovery {
            self.recovery.budget.0 -= self.recovery.wage.0;
            *self.recovery.jobs.entry(actor.clone()).or_default() += 1;
            self.recovery.wage
        } else {
            U64(0)
        };
        self.batches.insert(
            id.clone(),
            CraftBatch {
                id: id.clone(),
                actor,
                input_ids: ids,
                challenge_commitment: commitment,
                deadline_ms: deadline,
                recovery,
                wage_reserved: wage,
                status: "active".into(),
                tier: None,
                reason: None,
                output_ids: vec![],
            },
        );
        Ok(id)
    }
    pub(crate) fn finish_craft(
        &mut self,
        actor: String,
        id: String,
        tier: CraftTier,
        reason: FinishReason,
        recovery: bool,
        op: &str,
    ) -> Result<String, String> {
        let batch = self.batches.get(&id).ok_or("MissingBatch")?.clone();
        if batch.actor != actor {
            return Err("WrongProfile".into());
        }
        if batch.recovery != recovery {
            return Err("WrongBatchKind".into());
        }
        if batch.status != "active" {
            return Err("TerminalBatch".into());
        }
        let expired = now_ms() >= batch.deadline_ms.0;
        if reason == FinishReason::Expired && !expired {
            return Err("PrematureExpiry".into());
        }
        let tier = if expired { CraftTier::Normal } else { tier };
        for input in &batch.input_ids {
            let item = self.items.get_mut(input).ok_or("MissingItem")?;
            if item.location
                != (Location::Crafting {
                    batch: id.clone(),
                    source_owner: if recovery {
                        "bank".into()
                    } else {
                        actor.clone()
                    },
                })
            {
                return Err("WrongSourceLocation".into());
            }
            item.location = Location::Consumed {
                operation: op.into(),
            };
        }
        let mut outputs = vec![];
        for n in 0..batch.input_ids.len() / 2 {
            let output = format!("crafted-{id}-{n}");
            if self.items.contains_key(&output) {
                return Err("ItemIdConflict".into());
            }
            self.items.insert(
                output.clone(),
                Item {
                    id: output.clone(),
                    item_type: if tier == CraftTier::Fine {
                        ItemType::FineTonic
                    } else {
                        ItemType::Tonic
                    },
                    location: if recovery {
                        Location::Bank
                    } else {
                        Location::Owned {
                            profile: actor.clone(),
                        }
                    },
                },
            );
            outputs.push(output);
        }
        let balance = self.credits.get_mut(&actor).unwrap();
        *balance = balance
            .checked_add(batch.wage_reserved.0)
            .ok_or("CreditOverflow")?;
        let b = self.batches.get_mut(&id).unwrap();
        b.status = "finished".into();
        b.tier = Some(tier);
        b.reason = Some(if expired {
            FinishReason::Expired
        } else {
            reason
        });
        b.output_ids = outputs;
        b.wage_reserved = U64(0);
        Ok(id)
    }
}
/// One batch of ingredients at catalog value (2 herbs + 2 flasks = 8 coins).
pub const RECOVERY_HOLDINGS_LIMIT: u64 = 8;
