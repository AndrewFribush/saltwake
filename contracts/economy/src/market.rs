use crate::*;
use std::collections::BTreeSet;

fn unique_items(ids: &[String]) -> Result<(), String> {
    if ids.is_empty() || ids.len() > 128 {
        return Err("InvalidItemCount".into());
    }
    if ids.iter().collect::<BTreeSet<_>>().len() != ids.len() {
        return Err("DuplicateItems".into());
    }
    Ok(())
}
impl Economy {
    pub(crate) fn list(
        &mut self,
        actor: String,
        ids: Vec<String>,
        price: U64,
    ) -> Result<String, String> {
        unique_items(&ids)?;
        if self.active_listings() >= crate::compact::MAX_ACTIVE_LISTINGS {
            return Err("ListingCapacity".into());
        }
        if price.0 == 0 || price.0 > 1_000_000 {
            return Err("InvalidPrice".into());
        }
        let (serial, id) = crate::compact::next_listing(&self.listings);
        for item_id in &ids {
            let item = self.items.get_mut(item_id).ok_or("MissingItem")?;
            if item.location
                != (Location::Owned {
                    profile: actor.clone(),
                })
            {
                return Err("UnownedItem".into());
            }
            item.location = Location::Listed {
                listing: id.clone(),
            };
        }
        self.listings.insert(
            id.clone(),
            Listing {
                id: id.clone(),
                seller: actor,
                item_ids: ids.clone(),
                remaining_ids: ids,
                unit_price: price,
                status: "active".into(),
            },
        );
        crate::compact::commit_listing(serial);
        Ok(id)
    }
    pub(crate) fn cancel_listing(&mut self, actor: String, id: String) -> Result<String, String> {
        let l = self.listings.get_mut(&id).ok_or("MissingListing")?;
        if l.seller != actor {
            return Err("WrongSeller".into());
        }
        if l.status != "active" {
            return Err("ListingClosed".into());
        }
        for item_id in &l.remaining_ids {
            let item = self.items.get_mut(item_id).ok_or("MissingItem")?;
            if item.location
                != (Location::Listed {
                    listing: id.clone(),
                })
            {
                return Err("WrongSourceLocation".into());
            }
            item.location = Location::Owned {
                profile: actor.clone(),
            };
        }
        l.remaining_ids.clear();
        l.status = "cancelled".into();
        Ok(id)
    }
    pub(crate) fn buy(
        &mut self,
        actor: String,
        id: String,
        ids: Vec<String>,
        price: U64,
    ) -> Result<String, String> {
        unique_items(&ids)?;
        let l = self.listings.get(&id).ok_or("MissingListing")?.clone();
        if self.shops.values().any(|s| !s.open && s.listing_ids.contains(&id)) { return Err("ShopClosed".into()); }
        if l.status != "active" {
            return Err("ListingClosed".into());
        }
        if l.seller == actor {
            return Err("SelfPurchase".into());
        }
        if reserved_buyer(&id).is_some_and(|b| b != actor) {
            return Err("ReservedForAnotherBuyer".into());
        }
        if price.0 != l.unit_price.0 {
            return Err("StalePrice".into());
        }
        let total = price
            .0
            .checked_mul(ids.len() as u64)
            .ok_or("PriceOverflow")?;
        if self.credits[&actor] < total {
            return Err("InsufficientCredits".into());
        }
        for item_id in &ids {
            let item = self.items.get_mut(item_id).ok_or("MissingItem")?;
            if !l.remaining_ids.contains(item_id)
                || item.location
                    != (Location::Listed {
                        listing: id.clone(),
                    })
            {
                return Err("ItemUnavailable".into());
            }
            item.location = Location::Owned {
                profile: actor.clone(),
            };
        }
        *self.credits.get_mut(&actor).unwrap() -= total;
        let seller = self.credits.get_mut(&l.seller).unwrap();
        *seller = seller.checked_add(total).ok_or("CreditOverflow")?;
        let l = self.listings.get_mut(&id).unwrap();
        l.remaining_ids.retain(|i| !ids.contains(i));
        if l.remaining_ids.is_empty() {
            l.status = "sold".into();
        }
        Ok(id)
    }
    pub(crate) fn bank_trade(
        &mut self,
        actor: String,
        ids: Vec<String>,
        prices: Vec<U64>,
        buying: bool,
    ) -> Result<String, String> {
        unique_items(&ids)?;
        if prices.len() != ids.len() {
            return Err("InvalidPriceCount".into());
        }
        let mut total = 0u64;
        for (id, price) in ids.iter().zip(prices) {
            let item = self.items.get(id).ok_or("MissingItem")?;
            let source = if buying {
                Location::Bank
            } else {
                Location::Owned {
                    profile: actor.clone(),
                }
            };
            if item.location != source {
                return Err("ItemUnavailable".into());
            }
            let expected = if buying {
                item.item_type.value()
            } else {
                item.item_type.value() / 2
            };
            if price.0 != expected {
                return Err("StalePrice".into());
            }
            total = total.checked_add(expected).ok_or("PriceOverflow")?;
        }
        if buying {
            let balance = self.credits.get_mut(&actor).unwrap();
            if *balance < total {
                return Err("InsufficientCredits".into());
            }
            *balance -= total;
            self.bank = self.bank.checked_add(total).ok_or("CreditOverflow")?;
        } else {
            if self.bank < total {
                return Err("InsufficientBankCredits".into());
            }
            self.bank -= total;
            let balance = self.credits.get_mut(&actor).unwrap();
            *balance = balance.checked_add(total).ok_or("CreditOverflow")?;
        }
        for id in ids {
            self.items.get_mut(&id).unwrap().location = if buying {
                Location::Owned {
                    profile: actor.clone(),
                }
            } else {
                Location::Bank
            };
        }
        Ok(if buying { "bank_buy" } else { "bank_sell" }.into())
    }
    pub(crate) fn fill_npc_order(
        &mut self,
        actor: String,
        id: String,
        ids: Vec<String>,
        price: U64,
        op: &str,
    ) -> Result<String, String> {
        unique_items(&ids)?;
        let order = &mut self.npc_order;
        if id != order.id {
            return Err("MissingOrder".into());
        }
        if price.0 != order.unit_price.0 {
            return Err("StalePrice".into());
        }
        let total = price
            .0
            .checked_mul(ids.len() as u64)
            .ok_or("PriceOverflow")?;
        if ids.len() > order.remaining as usize || total > order.budget.0 {
            return Err("OrderExhausted".into());
        }
        for id in &ids {
            let item = self.items.get_mut(id).ok_or("MissingItem")?;
            if item.location
                != (Location::Owned {
                    profile: actor.clone(),
                })
            {
                return Err("UnownedItem".into());
            }
            if item.item_type != order.item_type {
                return Err("WrongItemType".into());
            }
            // Seeded NPC demand is a terminal consumable sink, not resellable bank stock.
            item.location = Location::Consumed {
                operation: op.into(),
            };
        }
        order.remaining -= ids.len() as u8;
        order.budget.0 -= total;
        let balance = self.credits.get_mut(&actor).unwrap();
        *balance = balance.checked_add(total).ok_or("CreditOverflow")?;
        Ok(id)
    }
}

/// Private offers: listing id -> the only profile allowed to buy it. Listing ids are never reused.
/// Stored outside the main state struct so existing state loads without migration.
fn reservation_key(listing: &str) -> Vec<u8> { format!("listing-buyer:{listing}").into_bytes() }
pub(crate) fn reserved_buyer(listing: &str) -> Option<String> {
    near_sdk::env::storage_read(&reservation_key(listing)).and_then(|v| String::from_utf8(v).ok())
}
/// A pruned (terminal) listing's reservation is no longer needed; its id is never reused.
pub(crate) fn forget_reservation(listing: &str) {
    near_sdk::env::storage_remove(&reservation_key(listing));
}
pub(crate) fn reserve(listing: &str, buyer: &str) {
    near_sdk::env::storage_write(&reservation_key(listing), buyer.as_bytes());
}
impl Economy {
    pub(crate) fn list_for(&mut self, actor: String, ids: Vec<String>, price: U64, buyer: String) -> Result<String, String> {
        if buyer.is_empty() || buyer.len() > 80 || !self.credits.contains_key(&buyer) { return Err("UnknownBuyer".into()); }
        if buyer == actor { return Err("SelfPurchase".into()); }
        self.list(actor, ids, price)
    }
}
