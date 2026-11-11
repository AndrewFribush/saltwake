use crate::*;
use std::collections::BTreeSet;
#[derive(near_sdk::serde::Deserialize)]
#[serde(crate="near_sdk::serde")]
struct Point {x:usize,y:usize}
#[derive(near_sdk::serde::Deserialize)]
#[serde(crate="near_sdk::serde")]
struct Fixture {id:String,name:String,glyph:String,x:usize,y:usize}
#[derive(near_sdk::serde::Deserialize)]
#[serde(crate="near_sdk::serde")]
struct Interior {tiles:Vec<String>,entry:Point,exit:Point,fixtures:Vec<Fixture>}
fn valid_interior(text:&str)->bool {
 if text.len()>12000{return false;}
 let Ok(r)=near_sdk::serde_json::from_str::<Interior>(text) else{return false;};
 if r.tiles.len()!=9||r.tiles.iter().any(|s|s.len()!=11||!s.bytes().all(|b|b==b'.'||b==b'#'))||r.fixtures.len()>24||r.exit.y!=8||r.exit.x==0||r.exit.x>=10||r.entry.x>=11||r.entry.y>=9{return false;}
 let mut ids=BTreeSet::new();let mut occupied=BTreeSet::new();
 for f in &r.fixtures {
  if f.x>=11||f.y>=9||f.name.encode_utf16().count()>80||f.glyph.encode_utf16().count()>4||!(f.id=="service"||f.id=="wallet"||f.id.strip_prefix("decor-").is_some_and(|s|!s.is_empty()&&s.len()<=40&&s.bytes().all(|c|c.is_ascii_alphanumeric()||c==b'_'||c==b'-')))||!ids.insert(f.id.clone())||!occupied.insert((f.x,f.y))||r.tiles[f.y].as_bytes()[f.x]!=b'.'{return false;}
 }
 if !ids.contains("service")||!ids.contains("wallet"){return false;}
 for y in 0..9 {for x in 0..11 {if (x==0||x==10||y==0||y==8)&&(x,y)!=(r.exit.x,r.exit.y)&&r.tiles[y].as_bytes()[x]!=b'#'{return false;}}}
 let walk=|x:usize,y:usize|x<11&&y<9&&r.tiles[y].as_bytes()[x]==b'.'&&!occupied.contains(&(x,y));
 if !walk(r.entry.x,r.entry.y)||!walk(r.exit.x,r.exit.y){return false;}
 let mut seen=BTreeSet::from([(r.entry.x,r.entry.y)]);let mut queue=vec![(r.entry.x,r.entry.y)];let mut i=0;
 while i<queue.len(){let (x,y)=queue[i];i+=1;for (nx,ny) in [(x.wrapping_sub(1),y),(x+1,y),(x,y.wrapping_sub(1)),(x,y+1)] {if walk(nx,ny)&&seen.insert((nx,ny)){queue.push((nx,ny));}}}
 if !seen.contains(&(r.exit.x,r.exit.y)){return false;}
 for y in 0..9 {for x in 0..11 {if walk(x,y)&&!seen.contains(&(x,y)){return false;}}}
 r.fixtures.iter().all(|f|[(f.x.wrapping_sub(1),f.y),(f.x+1,f.y),(f.x,f.y.wrapping_sub(1)),(f.x,f.y+1)].iter().any(|p|seen.contains(p)))
}
// Keep one tile around each footprint free; this protects doors and connected streets.
fn overlaps(a:(u8,u8,u8,u8),b:(u8,u8,u8,u8))->bool {
 let (x,y,w,h)=a;let (bx,by,bw,bh)=b;
 x<=bx+bw&&x+w>=bx&&y<=by+bh&&y+h>=by
}
impl Economy {
 pub(crate) fn save_shop(&mut self,actor:String,id:Option<String>,expected:U64,title:String,district:String,x:u8,y:u8,interior:String,open:bool)->Result<String,String>{
  if title.trim().is_empty()||title.len()>80||!valid_interior(&interior){return Err("InvalidShopDefinition".into());}
  if !["center","nw","n","ne","w","e","sw","s","se"].contains(&district.as_str())||x<4||x>19||y<1||y>11{return Err("InvalidShopPlacement".into());}
  let old=if let Some(ref id)=id {let s=self.shops.get(id).ok_or("MissingShop")?;if s.owner!=actor{return Err("WrongShopOwner".into());}if s.version!=expected{return Err("StaleShopVersion".into());}Some(s.clone())}else{if self.shops.len()>=32{return Err("ShopCapacity".into());}None};
  let starter=if district=="center"{vec![(5,2,4,3),(11,2,5,3),(6,10,4,3),(18,9,4,3),(19,1,4,3)]}else{vec![(10,4,5,3)]};
  if starter.into_iter().any(|b|overlaps((x,y,3,2),b))||self.shops.values().any(|s|s.district==district&&Some(&s.id)!=id.as_ref()&&overlaps((x,y,3,2),(s.x,s.y,3,2)))||(x<=12&&x+3>12&&y<=9&&y+2>9){return Err("OccupiedShopPlacement".into());}
  let key=id.unwrap_or_else(||format!("shop-{}",self.shops.len()));
  self.shops.insert(key.clone(),Shopfront{id:key.clone(),owner:actor,title,district,x,y,interior,open,version:U64(old.as_ref().map_or(1,|s|s.version.0+1)),listing_ids:old.map_or(vec![],|s|s.listing_ids)});Ok(key)
 }
 pub(crate) fn stock_shop(&mut self,actor:String,id:String,ids:Vec<String>,price:U64)->Result<String,String>{
  let shop=self.shops.get(&id).ok_or("MissingShop")?;if shop.owner!=actor{return Err("WrongShopOwner".into());}
  let listing=self.list(actor,ids,price)?;self.shops.get_mut(&id).unwrap().listing_ids.push(listing.clone());Ok(listing)
 }
}
