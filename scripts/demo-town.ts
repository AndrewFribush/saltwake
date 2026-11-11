/** Demonstration seed for a local world: demo characters claim plots, publish dungeons from the builder's generator
 * presets, furnish shops with display shelves, stock them from goods they already own, and settle a couple of runs.
 * Everything goes through the HTTP API's ordinary player commands (the same paths the web tools use).
 * Nothing is minted; plot limits and finite seeded goods apply. This is demonstration supply, not organic activity. */
import {generateDraft,generatorPresets,estimateDraft,type GeneratorPreset} from '../packages/game/src/draft-generator';
import {creatorSockets,type CreatorPlacement} from '../packages/shared/src/creator-rewards';
import {encodeCustomModule,type CustomFloor} from '../packages/shared/src/custom-layout';
import {usesDepth,enemyCost} from '../packages/shared/src/depth-components';
import {defaultExitRule} from '../packages/shared/src/exit-rules';
import {publicationSchedule} from '../packages/shared/src/operating-terms';
import {defaultInterior,type InteriorLayout} from '../packages/game/src/interiors';
import {withBuildingUse,displayId,freeFixtureTile} from '../packages/game/src/town-spaces';
import {footprintBlocked} from '../packages/game/src/town-discovery';
import type {DistrictId} from '../packages/game/src/town-districts';
import type {EditionTerms} from '../packages/shared/src/types';

/** Same floor shaping the drafting table applies before publication (FloorBuilder designFloor). */
const designFloor=(f:CustomFloor,depth:boolean):CustomFloor=>{const m={...f,tuning:f.tuning??[],devices:f.devices??[],exit_rule:f.exit_rule??{...defaultExitRule}};if(depth)return {...m,features:f.features??[]};const {features:_f,tide:_t,...rest}=m;return rest;};
export function presetPublication(seed:number,preset:GeneratorPreset,title:string,now:number,treasure=false){
 const draft=generateDraft(seed,{...generatorPresets[preset].options,treasure});const depth=usesDepth(draft.floors,draft.placements.flat().map(p=>p.enemy));
 const schedule=publicationSchedule({delayMinutes:'0',openMinutes:'1440',runMinutes:'15',capacity:'4'},now);
 const terms:EditionTerms={title,rules_version:depth?12:11,modules:draft.floors.map(f=>encodeCustomModule(designFloor(f,depth),depth?'depth':'missions')),sockets:creatorSockets(draft.placements),opens_at_ms:schedule.opens_at_ms,closes_at_ms:schedule.closes_at_ms,no_reward:!treasure,difficulty_tag:'standard',style_tag:'combat',run_duration_ms:schedule.run_duration_ms,max_runs:schedule.max_runs};
 return {terms,cost:estimateDraft(draft).coins,placements:draft.placements};
}
/** The showcase: the large three-floor preset, thinned to the proprietor's budget (easier first floor, the
 * strongest enemies kept deepest), with two fixed treasures funded from goods the proprietor already owns:
 * a fine tonic on floor 2 and a sword at the bottom. Same publication shape as the drafting table. */
/** Goods the demo shelves in shops; the showcase never takes these. */
const SHELVED=['maker-herb-0','maker-herb-1','maker-herb-2','maker-herb-3','maker-flask-0','maker-flask-1','maker-flask-2','maker-flask-3'];
export const SHOWCASE_COPIES=3;
export const SHOWCASE_SEEDS=[11,23,31,47,59,71,83,97,4242,9001],SHOWCASE_TITLE='The tide vaults';
/** Thins one draft to the budget: first optional hazards (oil, kegs, caches, altars, springs, chasms), then the most
 * expensive enemy or trap, shallowest floor first. Floor geometry, keys, locks, plates, cracked walls and devices
 * stay (those carry routes, doors and seals). Returns null if it cannot fit. */
function thinToBudget(draft:{floors:CustomFloor[];placements:CreatorPlacement[][]},budget:number){
 const cost=()=>estimateDraft(draft).coins;
 // Decorative hazards first (they never carry a route); keys, locks, plates and cracked walls stay put.
 const optional=['oil','barrel','cache','altar','fountain','pit'];
 while(cost()>budget){
  const fi=draft.floors.findIndex(f=>(f.features??[]).some(x=>optional.includes(x.kind)));
  if(fi>=0){const fs=draft.floors[fi].features!;const kind=optional.find(k=>fs.some(x=>x.kind===k))!;const at=fs.findIndex(x=>x.kind===kind);draft.floors[fi]={...draft.floors[fi],features:fs.filter((_,i)=>i!==at)};continue;}
  let best:{floor:number;slot:number;save:number}|null=null;
  draft.placements.forEach((ps,floor)=>ps.forEach((p,slot)=>{const save=enemyCost(p.enemy)+Number(p.trap);if(!save)return;
   // keep at least one enemy on the deepest floor so the showcase still has a fight at the bottom
   if(floor===draft.placements.length-1&&p.enemy!=='none'&&ps.filter(x=>x.enemy!=='none').length<=1&&!p.trap)return;
   if(!best||floor<best.floor||(floor===best.floor&&save>best.save))best={floor,slot,save};}));
  if(!best)return null;const {floor,slot}=best as {floor:number;slot:number};
  draft.placements[floor][slot]={...draft.placements[floor][slot],enemy:'none',trap:false};
 }
 return draft;
}
/** The showcase: the large three-floor preset, thinned to the proprietor's budget, with fixed treasures funded from
 * goods the proprietor already owns. Tries several seeds so generator changes cannot break seeding; returns null if
 * none fits (the caller skips the showcase with a note). Same publication shape as the drafting table. */
export function showcasePublication(title:string,now:number,budget:number,treasure:{floor:number;type:'sword'|'fineTonic'|'herb'|'flask'|'tonic'}[],seeds:readonly number[]=SHOWCASE_SEEDS){
 for(const seed of seeds){
  const base=generateDraft(seed,{...generatorPresets.large.options,treasure:true});
  if(base.floors.length<3)continue;
  const placements=base.placements.map(ps=>ps.map(p=>({...p,reward:null as CreatorPlacement['reward']})));
  let ok=true;
  for(const t of treasure){const f=Math.min(t.floor,placements.length-1);const ps=placements[f];const slot=ps.findIndex((p,i)=>base.placements[f][i].reward!==null&&p.reward===null);const at=slot>=0?slot:ps.findIndex(p=>p.reward===null);if(at<0){ok=false;break;}ps[at]={...ps[at],reward:t.type};}
  if(!ok)continue;
  try{
  const draft=thinToBudget({floors:base.floors.map(f=>({...f,features:[...(f.features??[])]})),placements},budget);if(!draft)continue;
  const depth=usesDepth(draft.floors,placements.flat().map(p=>p.enemy));
  const schedule=publicationSchedule({delayMinutes:'0',openMinutes:'1440',runMinutes:'20',capacity:'4'},now);
  const terms:EditionTerms={title,rules_version:depth?12:11,modules:draft.floors.map(f=>encodeCustomModule(designFloor(f,depth),depth?'depth':'missions')),sockets:creatorSockets(placements),opens_at_ms:schedule.opens_at_ms,closes_at_ms:schedule.closes_at_ms,no_reward:false,difficulty_tag:'standard',style_tag:'combat',run_duration_ms:schedule.run_duration_ms,max_runs:schedule.max_runs};
  return {seed,terms,cost:estimateDraft(draft).coins,draft};
  }catch{continue;} // a seed whose thinned floors fail validation is skipped
 }
 return null;
}
function room(edit:(r:InteriorLayout)=>InteriorLayout,shelves:number,note?:string){
 let r=edit(defaultInterior('market'));
 for(let i=0;i<shelves;i++){const f=freeFixtureTile(r,(x,y)=>({id:displayId(),name:'Display shelf',glyph:'▥',x,y}));if(f)r={...r,fixtures:[...r.fixtures,f]};}
 if(note){const n=freeFixtureTile(r,(x,y)=>({id:`decor-note-${displayId().slice(-8)}`,name:'Notice board',glyph:'✎',x,y,text:note}));if(n)r={...r,fixtures:[...r.fixtures,n]};}
 return r;
}
type Api=(profile:string,path:string,body?:unknown)=>Promise<any>;
/** One cookie jar per demo character, like separate browsers. */
export function apiClient(url:string):Api{
 const jars=new Map<string,string>();
 const raw=async(jar:string,path:string,body?:unknown)=>{const r=await fetch(url+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{Cookie:jars.get(jar)??'',Origin:url,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const c=r.headers.get('set-cookie');if(c)jars.set(jar,c.split(';')[0]);const v=await r.json() as any;if(r.status!==200)throw Error(`${path}: ${JSON.stringify(v).slice(0,200)}`);return v;};
 return async(profile,path,body)=>{if(!jars.has(profile)){await raw(profile,'session',{});await raw(profile,'profile',{profile});}return raw(profile,path,body);};
}
export async function seedDemoTown(api:Api,log:(s:string)=>void=()=>{}){
 const cmd=async(profile:string,id:string,action:any)=>{const r=await api(profile,'command',{id:'demo-'+id,action});if(r.status!=='Applied')throw Error(`Demo town step ${id} (${profile}): ${r.status} ${r.result??r.reason??''}`);return r.result as string;};
 const world=(p:string)=>api(p,'world');
 const now=Date.now();
 const shops=(await world('maker')).shops??[];
 const place=(district:DistrictId,x:number,y:number)=>{if(footprintBlocked(district,shops,x,y))throw Error(`Demo plot ${district} ${x},${y} is blocked`);return {district,x,y};};
 const build=async(profile:string,id:string,title:string,at:{district:DistrictId;x:number;y:number},interior:InteriorLayout,open:boolean)=>{const shopId=await cmd(profile,id,{type:'create_shop',title,...at,interior:JSON.stringify(interior),open});shops.push({id:shopId,owner:profile,title,...at,interior:'{}',version:'1',open,listing_ids:[]});return shopId;};
 // Dungeons: the proprietor's starter edition (gate only), the showcase, and two generator-preset editions.
 const tide=presetPublication(4242,'medium','The drowned stair',now);
 const tideId=await cmd('maker','pub-medium',{type:'publish',terms:tide.terms,fee:'3',funding:[]});
 // Showcase: three floors with real treasure, funded from goods the proprietor already holds. Seeding never fails
 // on it: if no seed fits the budget or the publish is refused, the town is seeded without it and the log says so.
 let showId:string|undefined;
 try{
  // Three funded copies: each run can win a herb on floor 2 and a fine tonic at the bottom (10 coins of goods against a 4-coin fee).
  const mw=await world('maker');const ownAll=(type:string)=>(mw.items as any[]).filter(i=>i.item_type===type&&i.location.kind==='owned'&&i.location.profile==='maker'&&!SHELVED.includes(i.id)).map(i=>i.id as string);
  const fines=ownAll('fineTonic').slice(0,SHOWCASE_COPIES),herbs=ownAll('herb').reverse().slice(0,SHOWCASE_COPIES);const enough=fines.length===SHOWCASE_COPIES&&herbs.length===SHOWCASE_COPIES;
  const show=enough?showcasePublication(SHOWCASE_TITLE,now,Number(mw.credits)-12,[{floor:1,type:'herb'},{floor:99,type:'fineTonic'}]):null;
  if(!show)log(`Demo town: showcase skipped (${!enough?`the proprietor lacks ${SHOWCASE_COPIES} fine tonics and herbs`:'no generator seed fits the proprietor’s budget'}).`);
  else{showId=await cmd('maker','pub-showcase',{type:'publish',terms:show.terms,fee:'4',funding:[...herbs,...fines]});log(`Demo town: showcase “${SHOWCASE_TITLE}” from seed ${show.seed}, ${show.cost} coins.`);}
 }catch(e){log(`Demo town: showcase skipped (${(e as Error).message}).`);}
 const p3=Number((await world('p3')).credits);const small=presetPublication(77,'small','Rat warren',now);
 if(small.cost>p3)throw Error(`Small preset needs ${small.cost} coins; the wayfarer has ${p3}`);
 const warrenId=await cmd('p3','pub-small',{type:'publish',terms:small.terms,fee:'1',funding:[]});
 if(showId)await build('maker','hall-showcase',SHOWCASE_TITLE,place('e',4,10),room(r=>withBuildingUse(r,'dungeon',showId!),0,'A deep dig, funded for three delvers: a herb on the second floor, a fine tonic at the bottom. Escape to keep them.'),true);
 await build('maker','hall-tide','The drowned stair',place('se',4,10),room(r=>withBuildingUse(r,'dungeon',tideId),0,'Two floors. The tide rises; keep moving.'),true);
 await build('p3','hall-warren','Rat warren',place('ne',4,10),room(r=>withBuildingUse(r,'dungeon',warrenId),0,'One floor, no treasure: a cheap warm-up.'),true);
 // Shops with display shelves, stocked from goods each owner already holds.
 const pantry=await build('maker','shop-pantry','Proprietor’s pantry',place('center',14,7),room(r=>r,3,'Ingredients for the kettle: two herbs and two flasks make a batch.'),true);
 await cmd('maker','stock-herbs',{type:'stock_shop',shop_id:pantry,item_ids:['maker-herb-0','maker-herb-1','maker-herb-2','maker-herb-3'],unit_price:'2'});
 await cmd('maker','stock-flasks',{type:'stock_shop',shop_id:pantry,item_ids:['maker-flask-0','maker-flask-1','maker-flask-2','maker-flask-3'],unit_price:'2'});
 {const spare=(await world('maker')).items.find((i:any)=>i.item_type==='sword'&&i.location.kind==='owned'&&i.location.profile==='maker');if(spare)await cmd('maker','stock-sword',{type:'stock_shop',shop_id:pantry,item_ids:[spare.id],unit_price:'12'});}
 const rack=await build('p2','shop-rack','Mercenary’s rack',place('s',4,10),room(r=>r,1,'Used but sound.'),true);
 await cmd('p2','stock-club',{type:'stock_shop',shop_id:rack,item_ids:['p2-club'],unit_price:'4'});
 const barrow=await build('p4','shop-barrow','Scavenger’s barrow',place('w',14,10),room(r=>r,1,'Found it below, priced to move.'),true);
 await cmd('p4','stock-club',{type:'stock_shop',shop_id:barrow,item_ids:['p4-club'],unit_price:'3'});
 // One escrowed commission so artisans see player demand on the notice board (the maker restocking tonics for a dungeon).
 await cmd('maker','commission-tonic',{type:'post_commission',item_type:'tonic',unit_price:'5',quantity:2});
 // A couple of settled runs so the notice board shows real records: visitors pay, go in bare-handed, then give up.
 // A veteran character only: the delver (default) and the newcomer keep a fresh start.
 for(const [profile,edition] of [['p2',warrenId],['p2',tideId]] as const){
  const e=(await world(profile)).editions.find((x:any)=>x.id===edition);
  await cmd(profile,`admit-${edition}`,{type:'admit',edition_id:edition,expected_version:e.version,expected_fee:e.fee,loadout_ids:[],seed:'0'});
  const run=(await world(profile)).runs.find((r:any)=>!r.terminal);if(!run)throw Error('Demo admission produced no run');
  await api(profile,`runs/${run.id}/abandon`,{});
 }
 log(`Demo town: 3 dungeon entrances (showcase “The tide vaults” with funded treasure, “The drowned stair” medium preset, “Rat warren” small preset; starter at the gate), 3 shops with display shelves, 1 open tonic commission, 2 settled runs. Demonstration supply from seeded assets only.`);
}

import type {AddressInfo} from 'node:net';
import {JsonRpcProvider,KeyPairSigner,type KeyPairString} from 'near-api-js';
import {Store} from '../apps/server/src/db';import {Outbox} from '../apps/server/src/outbox';import {NearChain} from '../apps/server/src/chain';import {Runs} from '../apps/server/src/runs';import {httpServer} from '../apps/server/src/http';import {CostJournal} from '../apps/server/src/cost-ledger';
/** Runs the seed against the epoch's own server database, through an in-process copy of the API on a loopback port. */
export async function runDemoTownSeed(config:{rpcUrl:string;accountId:string;privateKey:string;epoch:string},log:(s:string)=>void=console.log){
 const provider=new JsonRpcProvider({url:config.rpcUrl});const db=new Store('.state/'+config.epoch+'/server.sqlite');
 const chain=new NearChain(provider,KeyPairSigner.fromSecretKey(config.privateKey as KeyPairString),config.accountId,config.accountId);
 const snapshot=()=>provider.callFunction<any>({contractId:config.accountId,method:'snapshot',args:{},blockQuery:{finality:'final'}});
 const box=new Outbox(db,chain,new CostJournal(db,snapshot));const {server}=httpServer(box,new Runs(db,box),snapshot);
 try{await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));await seedDemoTown(apiClient('http://127.0.0.1:'+(server.address() as AddressInfo).port),log);}
 finally{await new Promise<void>(r=>server.close(()=>r()));db.close();}
}
