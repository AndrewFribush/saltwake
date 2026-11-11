//! Commissions: a player posts an escrowed order for N goods of one type at a fixed unit price; other players fill it
//! by delivering goods they own and are paid from the escrow. Coins move between players only (never to the operator).
//! Kept under its own storage key so the main state layout is unchanged and older deployments load as-is. The key is
//! written only at the end of a successful action; a rejection returns before any write, and a later panic reverts it.
use crate::*;
use std::collections::BTreeSet;
const KEY: &[u8] = b"commissions.v1";
pub const MAX_OPEN_COMMISSIONS: usize = 32;
pub const MAX_COMMISSION_QUANTITY: u32 = 32;
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct Commission { pub id: String, pub buyer: String, pub item_type: ItemType, pub unit_price: U64, pub quantity: u32, pub filled: u32, pub escrow: U64, pub status: String, pub delivered: Vec<String> }
pub fn read() -> BTreeMap<String, Commission> { env::storage_read(KEY).map(|b| borsh::from_slice(&b).expect("Corrupt commissions")).unwrap_or_default() }
pub(crate) fn write(map: &BTreeMap<String, Commission>) { env::storage_write(KEY, &borsh::to_vec(map).unwrap()); }
impl Economy {
    pub(crate) fn post_commission(&mut self, actor: String, item_type: ItemType, price: U64, quantity: u32) -> Result<String, String> {
        let mut map = read();
        if map.values().filter(|c| c.status == "open").count() >= MAX_OPEN_COMMISSIONS { return Err("CommissionCapacity".into()); }
        if quantity == 0 || quantity > MAX_COMMISSION_QUANTITY { return Err("InvalidQuantity".into()); }
        if price.0 == 0 || price.0 > 1_000_000 { return Err("InvalidPrice".into()); }
        let total = price.0.checked_mul(quantity as u64).ok_or("ValueOverflow")?;
        let balance = self.credits.get_mut(&actor).ok_or("UnknownProfile")?;
        if *balance < total { return Err("InsufficientCredits".into()); }
        *balance -= total;
        let id = crate::compact::allocate_commission(&map);
        map.insert(id.clone(), Commission { id: id.clone(), buyer: actor, item_type, unit_price: price, quantity, filled: 0, escrow: U64(total), status: "open".into(), delivered: vec![] });
        write(&map);
        Ok(id)
    }
    pub(crate) fn fill_commission(&mut self, actor: String, id: String, ids: Vec<String>, price: U64) -> Result<String, String> {
        let mut map = read();
        let c = map.get(&id).ok_or("MissingCommission")?.clone();
        if c.status != "open" { return Err("CommissionClosed".into()); }
        if c.buyer == actor { return Err("SelfFill".into()); }
        if c.unit_price != price { return Err("StalePrice".into()); }
        if ids.is_empty() || ids.len() as u32 > c.quantity - c.filled || ids.iter().collect::<BTreeSet<_>>().len() != ids.len() { return Err("InvalidItemCount".into()); }
        for item_id in &ids {
            let item = self.items.get_mut(item_id).ok_or("MissingItem")?;
            if item.location != (Location::Owned { profile: actor.clone() }) { return Err("UnownedItem".into()); }
            if item.item_type != c.item_type { return Err("WrongItemType".into()); }
            item.location = Location::Owned { profile: c.buyer.clone() };
        }
        let pay = price.0 * ids.len() as u64;
        let seller = self.credits.get_mut(&actor).ok_or("UnknownProfile")?;
        *seller = seller.checked_add(pay).ok_or("CreditOverflow")?;
        let entry = map.get_mut(&id).unwrap();
        entry.escrow = U64(entry.escrow.0 - pay);
        entry.filled += ids.len() as u32;
        entry.delivered.extend(ids);
        if entry.filled == entry.quantity { entry.status = "filled".into(); }
        write(&map);
        Ok(id)
    }
    pub(crate) fn cancel_commission(&mut self, actor: String, id: String) -> Result<String, String> {
        let mut map = read();
        let c = map.get(&id).ok_or("MissingCommission")?.clone();
        if c.buyer != actor { return Err("WrongBuyer".into()); }
        if c.status != "open" { return Err("CommissionClosed".into()); }
        let buyer = self.credits.get_mut(&actor).ok_or("UnknownProfile")?;
        *buyer = buyer.checked_add(c.escrow.0).ok_or("CreditOverflow")?;
        let entry = map.get_mut(&id).unwrap();
        entry.escrow = U64(0);
        entry.status = "cancelled".into();
        write(&map);
        Ok(id)
    }
}
