use crate::*;
use std::collections::BTreeSet;
/// Land rules for player-built town spaces. Versioned and explicit; mirrored in packages/shared/src/land.ts.
pub const LAND_RULES_VERSION:&str="land-v1";
pub const MAX_BUILDINGS:usize=32;
pub const MAX_PLOTS_PER_OWNER:usize=3;
pub const MAX_FIXTURE_TEXT:usize=160;
#[near(serializers=[json])]
pub struct LandRules {pub version:String,pub max_buildings:u32,pub max_plots_per_owner:u32,pub footprint_width:u8,pub footprint_height:u8,pub interior_width:u8,pub interior_height:u8,pub max_fixtures:u32,pub max_fixture_text:u32,pub kinds:Vec<String>,pub districts:Vec<String>}
#[derive(near_sdk::serde::Deserialize)]
#[serde(crate="near_sdk::serde")]
struct Point {x:usize,y:usize}
#[derive(near_sdk::serde::Deserialize)]
#[serde(crate="near_sdk::serde")]
struct Fixture {id:String,name:String,glyph:String,x:usize,y:usize,#[serde(default)] text:Option<String>}
/// `kind`/`edition` are optional so every interior saved before land-v1 still parses as a shop.
#[derive(near_sdk::serde::Deserialize)]
#[serde(crate="near_sdk::serde")]
struct Interior {tiles:Vec<String>,entry:Point,exit:Point,fixtures:Vec<Fixture>,#[serde(default)] kind:Option<String>,#[serde(default)] edition:Option<String>}
const DISTRICTS:[&str;9]=["center","nw","n","ne","w","e","sw","s","se"];
fn parse_interior(text:&str)->Option<Interior> {
 if text.len()>12000{return None;}
 let r=near_sdk::serde_json::from_str::<Interior>(text).ok()?;
 if r.tiles.len()!=9||r.tiles.iter().any(|s|s.len()!=11||!s.bytes().all(|b|b==b'.'||b==b'#'))||r.fixtures.len()>24||r.exit.y!=8||r.exit.x==0||r.exit.x>=10||r.entry.x>=11||r.entry.y>=9{return None;}
 let dungeon=match r.kind.as_deref(){None|Some("shop")=>false,Some("dungeon")=>true,_=>return None};
 if dungeon!=r.edition.is_some()||r.edition.as_ref().is_some_and(|e|e.is_empty()||e.len()>64){return None;}
 let mut ids=BTreeSet::new();let mut occupied=BTreeSet::new();
 for f in &r.fixtures {
  let named=f.id=="service"||f.id=="wallet"||(dungeon&&f.id=="portal");
  if f.x>=11||f.y>=9||f.name.encode_utf16().count()>80||f.glyph.encode_utf16().count()>4||f.text.as_ref().is_some_and(|t|t.encode_utf16().count()>MAX_FIXTURE_TEXT)||!(named||f.id.strip_prefix("decor-").is_some_and(|s|!s.is_empty()&&s.len()<=40&&s.bytes().all(|c|c.is_ascii_alphanumeric()||c==b'_'||c==b'-')))||!ids.insert(f.id.clone())||!occupied.insert((f.x,f.y))||r.tiles[f.y].as_bytes()[f.x]!=b'.'{return None;}
 }
 if !ids.contains("service")||!ids.contains("wallet")||dungeon!=ids.contains("portal"){return None;}
 for y in 0..9 {for x in 0..11 {if (x==0||x==10||y==0||y==8)&&(x,y)!=(r.exit.x,r.exit.y)&&r.tiles[y].as_bytes()[x]!=b'#'{return None;}}}
 let walk=|x:usize,y:usize|x<11&&y<9&&r.tiles[y].as_bytes()[x]==b'.'&&!occupied.contains(&(x,y));
 if !walk(r.entry.x,r.entry.y)||!walk(r.exit.x,r.exit.y){return None;}
 let mut seen=BTreeSet::from([(r.entry.x,r.entry.y)]);let mut queue=vec![(r.entry.x,r.entry.y)];let mut i=0;
 while i<queue.len(){let (x,y)=queue[i];i+=1;for (nx,ny) in [(x.wrapping_sub(1),y),(x+1,y),(x,y.wrapping_sub(1)),(x,y+1)] {if walk(nx,ny)&&seen.insert((nx,ny)){queue.push((nx,ny));}}}
 if !seen.contains(&(r.exit.x,r.exit.y)){return None;}
 for y in 0..9 {for x in 0..11 {if walk(x,y)&&!seen.contains(&(x,y)){return None;}}}
 if !r.fixtures.iter().all(|f|[(f.x.wrapping_sub(1),f.y),(f.x+1,f.y),(f.x,f.y.wrapping_sub(1)),(f.x,f.y+1)].iter().any(|p|seen.contains(p))){return None;}
 Some(r)
}
// Keep one tile around each footprint free; this protects doors and connected streets.
fn overlaps(a:(u8,u8,u8,u8),b:(u8,u8,u8,u8))->bool {
 let (x,y,w,h)=a;let (bx,by,bw,bh)=b;
 x<=bx+bw&&x+w>=bx&&y<=by+bh&&y+h>=by
}
pub fn land_rules()->LandRules {
 LandRules{version:LAND_RULES_VERSION.into(),max_buildings:MAX_BUILDINGS as u32,max_plots_per_owner:MAX_PLOTS_PER_OWNER as u32,footprint_width:3,footprint_height:2,interior_width:11,interior_height:9,max_fixtures:24,max_fixture_text:MAX_FIXTURE_TEXT as u32,kinds:vec!["shop".into(),"dungeon".into()],districts:DISTRICTS.iter().map(|d|d.to_string()).collect()}
}
impl Economy {
 pub(crate) fn save_shop(&mut self,actor:String,id:Option<String>,expected:U64,title:String,district:String,x:u8,y:u8,interior:String,open:bool)->Result<String,String>{
  let Some(room)=parse_interior(&interior) else {return Err("InvalidShopDefinition".into());};
  if title.trim().is_empty()||title.len()>80{return Err("InvalidShopDefinition".into());}
  if !DISTRICTS.contains(&district.as_str())||x<4||x>19||y<1||y>11{return Err("InvalidShopPlacement".into());}
  // A dungeon entrance may only point at the actor's own, still-open edition. It grants no admission or fee authority.
  if let Some(ref e)=room.edition {let ed=self.editions.get(e).ok_or("MissingEdition")?;if ed.maker!=actor{return Err("WrongEditionMaker".into());}if ed.closed{return Err("EditionClosed".into());}}
  let old=if let Some(ref id)=id {let s=self.shops.get(id).ok_or("MissingShop")?;if s.owner!=actor{return Err("WrongShopOwner".into());}if s.version!=expected{return Err("StaleShopVersion".into());}Some(s.clone())}else{
   if self.shops.len()>=MAX_BUILDINGS{return Err("ShopCapacity".into());}
   if self.shops.values().filter(|s|s.owner==actor).count()>=MAX_PLOTS_PER_OWNER{return Err("PlotLimit".into());}
   None};
  let starter=if district=="center"{vec![(5,2,4,3),(11,2,5,3),(6,10,4,3),(18,9,4,3),(19,1,4,3)]}else{vec![(10,4,5,3)]};
  if starter.into_iter().any(|b|overlaps((x,y,3,2),b))||self.shops.values().any(|s|s.district==district&&Some(&s.id)!=id.as_ref()&&overlaps((x,y,3,2),(s.x,s.y,3,2)))||(x<=12&&x+3>12&&y<=9&&y+2>9){return Err("OccupiedShopPlacement".into());}
  // Ids stay `shop-<n>`; after a demolition the next free number is used.
  let key=id.unwrap_or_else(||{let mut n=self.shops.len();while self.shops.contains_key(&format!("shop-{n}")){n+=1;}format!("shop-{n}")});
  self.shops.insert(key.clone(),Shopfront{id:key.clone(),owner:actor,title,district,x,y,interior,open,version:U64(old.as_ref().map_or(1,|s|s.version.0+1)),listing_ids:old.map_or(vec![],|s|s.listing_ids)});Ok(key)
 }
 pub(crate) fn stock_shop(&mut self,actor:String,id:String,ids:Vec<String>,price:U64)->Result<String,String>{
  let shop=self.shops.get(&id).ok_or("MissingShop")?;if shop.owner!=actor{return Err("WrongShopOwner".into());}
  let listing=self.list(actor,ids,price)?;self.shops.get_mut(&id).unwrap().listing_ids.push(listing.clone());Ok(listing)
 }
 /// Demolition frees the plot. Stock must be withdrawn first so no listing is orphaned from its shop.
 pub(crate) fn remove_shop(&mut self,actor:String,id:String,expected:U64)->Result<String,String>{
  let shop=self.shops.get(&id).ok_or("MissingShop")?;if shop.owner!=actor{return Err("WrongShopOwner".into());}if shop.version!=expected{return Err("StaleShopVersion".into());}
  if shop.listing_ids.iter().any(|l|self.listings.get(l).is_some_and(|l|l.status=="active")){return Err("ShopHasStock".into());}
  self.shops.remove(&id);Ok(id)
 }
}
