/** Demonstration seed for a local world: demo characters claim plots, publish dungeons from the builder's generator
 * presets, furnish shops with display shelves, stock them from goods they already own, and settle a couple of runs.
 * Everything goes through the HTTP API's ordinary player commands (the same paths the web tools use).
 * Nothing is minted; plot limits and finite seeded goods apply. This is demonstration supply, not organic activity. */
import {generateDraft,generatorPresets,estimateDraft,type GeneratorPreset} from '../packages/game/src/draft-generator';
import {creatorSockets,type CreatorPlacement} from '../packages/shared/src/creator-rewards';
import {encodeCustomModule,type CustomFloor} from '../packages/shared/src/custom-layout';
import {usesDepth} from '../packages/shared/src/depth-components';
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
export const SHOWCASE_SEED=11,SHOWCASE_TITLE='The tide vaults';
export function showcasePublication(seed:number,title:string,now:number,budget:number,treasure:{floor:number;type:'sword'|'fineTonic'}[]){
 const base=generateDraft(seed,{...generatorPresets.large.options,treasure:true});
 const placements=base.placements.map(ps=>ps.map(p=>({...p,reward:null as CreatorPlacement['reward']})));
 for(const t of treasure){const ps=placements[Math.min(t.floor,placements.length-1)];const slot=ps.findIndex((p,i)=>base.placements[Math.min(t.floor,placements.length-1)][i].reward!==null&&p.reward===null);const at=slot>=0?slot:ps.findIndex(p=>p.reward===null);if(at<0)throw Error('Showcase floor has no free spot for treasure');ps[at]={...ps[at],reward:t.type};}
 const draft={floors:base.floors,placements};
 // Thin enemies from the shallowest floor first until the publication fits the budget.
 for(let floor=0;estimateDraft(draft).coins>budget&&floor<placements.length;){const ps=placements[floor];const i=ps.findIndex(p=>p.enemy!=='none'&&p.reward===null)>=0?ps.findIndex(p=>p.enemy!=='none'&&p.reward===null):ps.findIndex(p=>p.trap);if(i<0){floor++;continue;}ps[i]={...ps[i],enemy:'none',trap:false};if(ps.filter(p=>p.enemy!=='none').length<=1)floor++;}
 if(estimateDraft(draft).coins>budget)throw Error(`Showcase needs ${estimateDraft(draft).coins} coins; budget ${budget}`);
 const depth=usesDepth(draft.floors,placements.flat().map(p=>p.enemy));
 const schedule=publicationSchedule({delayMinutes:'0',openMinutes:'1440',runMinutes:'20',capacity:'4'},now);
 const terms:EditionTerms={title,rules_version:depth?12:11,modules:draft.floors.map(f=>encodeCustomModule(designFloor(f,depth),depth?'depth':'missions')),sockets:creatorSockets(placements),opens_at_ms:schedule.opens_at_ms,closes_at_ms:schedule.closes_at_ms,no_reward:false,difficulty_tag:'standard',style_tag:'combat',run_duration_ms:schedule.run_duration_ms,max_runs:schedule.max_runs};
 return {terms,cost:estimateDraft(draft).coins,draft};
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
 // Showcase: three floors with real treasure, funded from goods the proprietor already holds.
 const mw=await world('maker');const shelved=['maker-fine-tonic-2','maker-fine-tonic-3'];const own=(type:string)=>mw.items.find((i:any)=>i.item_type===type&&!shelved.includes(i.id)&&i.location.kind==='owned'&&i.location.profile==='maker')?.id as string|undefined;
 const sword=own('sword'),fine=own('fineTonic');if(!sword||!fine)throw Error('Showcase needs the proprietor’s sword and a fine tonic');
 const show=showcasePublication(SHOWCASE_SEED,SHOWCASE_TITLE,now,Number(mw.credits)-12,[{floor:1,type:'fineTonic'},{floor:2,type:'sword'}]);
 const showId=await cmd('maker','pub-showcase',{type:'publish',terms:show.terms,fee:'4',funding:[fine,sword]});
 const p3=Number((await world('p3')).credits);const small=presetPublication(77,'small','Rat warren',now);
 if(small.cost>p3)throw Error(`Small preset needs ${small.cost} coins; the wayfarer has ${p3}`);
 const warrenId=await cmd('p3','pub-small',{type:'publish',terms:small.terms,fee:'1',funding:[]});
 await build('maker','hall-showcase',SHOWCASE_TITLE,place('e',4,10),room(r=>withBuildingUse(r,'dungeon',showId),0,'Three floors. A fine tonic waits on the second, a sword at the bottom. Escape to keep them.'),true);
 await build('maker','hall-tide','The drowned stair',place('se',4,10),room(r=>withBuildingUse(r,'dungeon',tideId),0,'Two floors. The tide rises; keep moving.'),true);
 await build('p3','hall-warren','Rat warren',place('ne',4,10),room(r=>withBuildingUse(r,'dungeon',warrenId),0,'One floor, no treasure: a cheap warm-up.'),true);
 // Shops with display shelves, stocked from goods each owner already holds.
 const pantry=await build('maker','shop-pantry','Proprietor’s pantry',place('center',14,7),room(r=>r,3,'Ingredients for the kettle: two herbs and two flasks make a batch.'),true);
 await cmd('maker','stock-herbs',{type:'stock_shop',shop_id:pantry,item_ids:['maker-herb-0','maker-herb-1','maker-herb-2','maker-herb-3'],unit_price:'2'});
 await cmd('maker','stock-flasks',{type:'stock_shop',shop_id:pantry,item_ids:['maker-flask-0','maker-flask-1','maker-flask-2','maker-flask-3'],unit_price:'2'});
 await cmd('maker','stock-fine',{type:'stock_shop',shop_id:pantry,item_ids:['maker-fine-tonic-2','maker-fine-tonic-3'],unit_price:'6'});
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
