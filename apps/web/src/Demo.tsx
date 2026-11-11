import {ExpeditionOffer} from './ExpeditionOffer';
import {itemUse,planLoadout,weaponDamage} from '../../../packages/shared/src/equipment';
import {ShopBuilder} from './ShopBuilder';
import {MyBuildings} from './MyBuildings';
import {BusinessLedger} from './BusinessLedger';
import {PlayerShop} from './PlayerShop';
import type {DistrictId} from '../../../packages/game/src/town-districts';
import type {Shopfront} from '../../../packages/shared/src/types';
import type {EditionRecord as EditionRecordData} from '../../../packages/shared/src/edition-record';
import {Desk,Pages,Reading} from './GamePanels';
import React,{useEffect,useState,useRef} from 'react';
import {Run} from './Run';
import {matchEditions,type MatchPreferences} from '../../../packages/shared/src/matcher';
import {Shop} from './Shop';
import {Crafting, type CraftSend} from './Crafting';
import type {Command} from '../../../packages/shared/src/types';
import type {CommandResult} from './wallet-transport';
import {Maker} from './Maker';
import {FloorBuilder} from './FloorBuilder';
import {Town} from './Town';
import {Interior} from './Interior';
import {Wallet} from './Wallet';
import type {WalletView} from '../../../packages/shared/src/wallet';
import {ItemIcon} from './ItemIcon';
import {places,type PlaceId} from '../../../packages/game/src/town';
import {catalog} from '../../../packages/shared/src/catalog';
import {Workbench} from './Workbench';
import {FirstSteps} from './FirstSteps';
import {BuyInContext} from './BuyCoins';
import {StackRows,stacksOf,countOf} from './TradeRows';
import type {Action} from '../../../packages/game/src/actions';
import type {RunState} from '../../../packages/game/src/state';
const PENDING_NOTICE='Pending confirmation.';
import type {Item,EditionTerms} from '../../../packages/shared/src/types';
type RunView={id:string;seq:number;state:RunState;deadline:string;roomTitle:string;roomCount:number;exit?:{x:number;y:number};canExtract?:boolean;canContinue?:boolean;hasNextRoom?:boolean;terminal:string|null;settlement:any};
type World={shops?:Shopfront[];shopContract?:boolean;wallet?:WalletView;listings?:unknown[];npc_order?:unknown;profile:string;credits:string;items:Item[];editions:{record?:EditionRecordData;id:string;maker:string;terms:EditionTerms;fee:string;version:string;closed:boolean;active:number;status:string;bundles:number;remainingValue:number;reservedValue:number;extractedValue?:string;consumedValue?:string;bankedValue?:string;pendingConsumptionValue:number;valueBalanced:boolean|null;originalValue:string;refreshValue:string}[];runs:RunView[];operations:{id:string;status:string;reason?:string;result?:string}[]};
class ApiError extends Error{constructor(message:string,readonly status:number){super(message);}}
async function demoApi(path:string,body?:unknown){const r=await fetch('/api/'+path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw new ApiError(data.error??'Request failed',r.status);return data;}
export type WalletDemoConnection = {
 profile: string; storageScope: string; sessionControls: React.ReactNode;
 request: (path:string,body?:unknown)=>Promise<any>;
 buyCoins?: (requestId:string,coins:number)=>Promise<void>;
 execute: (id:string,action:Command['action'])=>Promise<CommandResult>;
 craft: CraftSend;
 operationId: (requestId:string)=>Promise<string>;
};
export function Demo({walletConnection}:{walletConnection?:WalletDemoConnection}={}){
 const api=walletConnection?.request??demoApi;
 const pendingCommandKey=(profile?:string)=>walletConnection?'saltwake.wallet-command:'+walletConnection.storageScope:'dungeon-pending-command:'+profile;
const [place,setPlace]=useState<PlaceId>();const [shopId,setShopId]=useState<string>();const [buildingDistrict,setBuildingDistrict]=useState<DistrictId>();const [walletOpen,setWalletOpen]=useState(false);const [helpOpen,setHelpOpen]=useState(false);const [sessionOpen,setSessionOpen]=useState(false);const [personalOpen,setPersonalOpen]=useState(false);const [practice,setPractice]=useState(false);const [craftPractice,setCraftPractice]=useState(false);const [drafting,setDrafting]=useState(false);const [revising,setRevising]=useState<any>(null);const [world,setWorld]=useState<World>();const [notice,setNotice]=useState('');const [mainBusy,setBusy]=useState(false);const [childBusy,setChildBusy]=useState(false);const busy=mainBusy||childBusy;const worldGeneration=useRef(0);const refreshSequence=useRef(0),polling=useRef(false);const [selected,setSelected]=useState<string[]>([]);const [runId,setRunId]=useState<string>();const [preferences,setPreferences]=useState<MatchPreferences>({maxFee:10,style:'any',difficulty:'any',rewards:'any'});const [rotation,setRotation]=useState(0);const [showArchive,setShowArchive]=useState(false);const inflight=useRef(false);const pendingAction=useRef<{run:string;id:string;seq:number;action:Action}|undefined>(undefined);
 // Inspector overlays own keyboard focus while the world remains visible.
 useEffect(()=>{
  if(!walletOpen&&!personalOpen&&!sessionOpen&&!helpOpen)return;
  const previous=document.activeElement as HTMLElement|null;
  const stage=document.querySelector('.game-stage');
  const covered=Array.from(stage?.children??[]).filter(el=>!el.classList.contains('purse-drawer')) as HTMLElement[];
  const states=covered.map(el=>el.inert);covered.forEach(el=>{el.inert=true;});
  const drawer=stage?.querySelector<HTMLElement>('.purse-drawer');drawer?.querySelector<HTMLElement>('button')?.focus({preventScroll:true});
  const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();setWalletOpen(false);setPersonalOpen(false);setSessionOpen(false);setHelpOpen(false);}if(event.key==='Tab'&&drawer){const controls=Array.from(drawer.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled),input:not(:disabled),[tabindex="0"]')).filter(el=>el.getClientRects().length&&!el.closest('[hidden]'));const first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}};
  drawer?.addEventListener('keydown',onKey);return()=>{covered.forEach((el,i)=>{el.inert=states[i];});drawer?.removeEventListener('keydown',onKey);if(previous?.isConnected)previous.focus({preventScroll:true});};
 },[walletOpen,personalOpen,sessionOpen,helpOpen]);
 const refresh=async()=>{const generation=worldGeneration.current;const sequence=++refreshSequence.current;const w=await api('world') as World;if(generation!==worldGeneration.current||sequence!==refreshSequence.current)return;setWorld(w);setRunId(current=>current??w.runs.find(r=>!r.terminal)?.id);const pendingKey=pendingCommandKey(w.profile);const pending=sessionStorage.getItem(pendingKey);if(pending){const id=walletConnection?await walletConnection.operationId(JSON.parse(pending).id):w.profile+'-'+JSON.parse(pending).id;if(generation!==worldGeneration.current||sequence!==refreshSequence.current)return;if(w.operations.some(o=>o.id===id&&['Applied','Rejected'].includes(o.status)))sessionStorage.removeItem(pendingKey);}
 setSelected(ids=>ids.filter(id=>w.items.some(i=>i.id===id)));
 // A retried/recovered command resolves outside this component; drop its stale banner once nothing is pending.
 if(!sessionStorage.getItem(pendingKey))setNotice(n=>n.startsWith(PENDING_NOTICE)?'':n);};
 useEffect(()=>{let stopped=false;(walletConnection?Promise.resolve():api('session',{})).then(()=>{if(!stopped)return refresh();}).catch(e=>setNotice(e.message));const timer=setInterval(()=>{if(!inflight.current&&!polling.current){polling.current=true;void refresh().catch(e=>setNotice(e.message)).finally(()=>{polling.current=false;});}},3000);return()=>{stopped=true;worldGeneration.current++;clearInterval(timer);};},[]);
 const work=async(fn:()=>Promise<unknown>)=>{if(inflight.current||childBusy)return;inflight.current=true;setBusy(true);try{await fn();await refresh();setNotice('');}catch(e){setNotice((e as Error).message);}finally{inflight.current=false;setBusy(false);}};
 const command=async(action:unknown)=>{
  const key=pendingCommandKey(world?.profile);const saved=sessionStorage.getItem(key);const pending=saved?JSON.parse(saved):{id:crypto.randomUUID(),action};
  if(saved&&JSON.stringify(pending.action)!==JSON.stringify(action))throw Error('Retry or reconcile the earlier command before changing it.');
  sessionStorage.setItem(key,JSON.stringify(pending));const r=walletConnection?await walletConnection.execute(pending.id,pending.action):await api('command',{...pending,expectedProfile:world?.profile});
  if(r.status==='Applied'||r.status==='Rejected')sessionStorage.removeItem(key);
  if(r.status==='Rejected'){await refresh();throw Error(r.result);}if(r.status==='Unknown'||r.status==='Pending')throw Error(PENDING_NOTICE+' Keep the same request; do not enter again.');
 };
 const loadout=planLoadout(selected.flatMap(id=>world?.items.find(i=>i.id===id)??[]));
 const suggestions=world?matchEditions(world.editions,world.profile,{...preferences,maxFee:Math.min(preferences.maxFee,Number(world.credits))},rotation):[];
 const run=world?.runs.find(r=>r.id===runId)??world?.runs.find(r=>!r.terminal);
 const act=(action:Action)=>void work(async()=>{if(!run)return;const p=pendingAction.current??{run:run.id,id:crypto.randomUUID(),seq:run.seq,action};pendingAction.current=p;try{await api('runs/'+p.run+'/action',{id:p.id,seq:p.seq,action:p.action});pendingAction.current=undefined;}catch(e){if(e instanceof ApiError&&e.status>=400&&e.status<500&&e.status!==408)pendingAction.current=undefined;throw e;}});
 const toggle=(id:string)=>setSelected(ids=>ids.includes(id)?ids.filter(i=>i!==id):[...ids,id]);
 const satchel=(purpose:string)=><section className="satchel" aria-label="Your satchel"><h3>{purpose}</h3><p>{selected.length} selected · {place==='gate'?'Only selected gear goes below. Everything else stays safe in town.':'Choose the goods you want to use here.'}</p>{place==='gate'&&selected.filter(id=>world?.items.some(i=>i.id===id&&(i.item_type==='club'||i.item_type==='sword'))).length>1&&<label>Starting weapon<select disabled={busy} value={loadout.slots.find(s=>s.kind==='weapon')?.id} onChange={e=>{const id=e.target.value;setSelected(ids=>[id,...ids.filter(i=>i!==id)]);}}>{selected.flatMap(id=>{const i=world?.items.find(i=>i.id===id);return i&&(i.item_type==='club'||i.item_type==='sword')?[<option key={id} value={id}>{catalog[i.item_type].name} · {id.length>20?id.slice(-12):id}</option>]:[];})}</select></label>}<div className="satchel-grid"><Pages items={world?.items??[]} size={8} label="Stored goods" render={i=><button key={i.id} className={selected.includes(i.id)?'packed':''} aria-pressed={selected.includes(i.id)} onClick={()=>toggle(i.id)} disabled={busy}><ItemIcon type={i.item_type}/><span title={i.id}>{catalog[i.item_type].name}<small>{itemUse[i.item_type]}</small></span>{selected.includes(i.id)&&<b aria-hidden="true">✓</b>}</button>}/></div>{!world?.items.length&&<p>Your satchel is empty. Ivo offers bank-supplied work at the Copper Kettle.</p>}</section>;
 const openPlace=(id:PlaceId)=>{setSelected([]);setPlace(id);};
 // A demolished building disappears from contract state; step back into the street instead of leaving a blank stage.
 useEffect(()=>{if(shopId&&world?.shops&&!world.shops.some(s=>s.id===shopId))setShopId(undefined);},[shopId,world?.shops]);
 const offer=(e:World['editions'][number],after?:()=>void)=><ExpeditionOffer key={e.id+':'+e.version} edition={e} packed={selected.length} disabled={!world||busy||e.maker===world.profile||!loadout.valid||e.valueBalanced===false||e.status!=='open'||BigInt(e.fee)>BigInt(world.credits)||world.operations.some(o=>['Unknown','Pending'].includes(o.status))} onAdmit={()=>void work(async()=>{await command({type:'admit',edition_id:e.id,expected_version:e.version,expected_fee:e.fee,loadout_ids:selected,seed:'0'});setPlace(undefined);after?.();})}/>;
 // A maker's own building opens exactly their linked edition, through the same admission check as the catacombs.
 const hallExpedition=(editionId:string)=>{const e=world?.editions.find(e=>e.id===editionId);if(!e||!world)return <p>This dungeon edition is no longer listed.</p>;return <>{offer(e,()=>setShopId(undefined))}{e.maker===world.profile?<p>This is your dungeon. Other players descend from here; rehearse it at the guild drafting table.</p>:packPanel}</>;};
 const finished=world?.runs.filter(r=>r.terminal&&r.settlement?.status==='Applied')??[];
 const location=places.find(p=>p.id===place);
 const lastPurse=useRef<{profile:string;credits:bigint}|null>(null);const [purseDelta,setPurseDelta]=useState<{n:bigint;key:number}|null>(null);
 useEffect(()=>{if(!world)return;const now={profile:world.profile,credits:BigInt(world.credits)};const before=lastPurse.current;lastPurse.current=now;if(before&&before.profile===now.profile&&before.credits!==now.credits){const n=now.credits-before.credits;setPurseDelta({n,key:Date.now()});const t=setTimeout(()=>setPurseDelta(d=>d&&d.n===n?null:d),4500);return()=>clearTimeout(t);}},[world?.profile,world?.credits]);
 const ownedNow=(world?.items??[]).filter(i=>i.location.kind==='owned'&&i.location.profile===world?.profile);
 const packOrder=['sword','club','armor','fineTonic','tonic'];const rank=(t:string)=>{const i=packOrder.indexOf(t);return i<0?99:i;};
 const packStacks=stacksOf(ownedNow).sort((a,b)=>rank(a.type)-rank(b.type));
 const packCounts=Object.fromEntries(packStacks.map(s=>[s.key,s.ids.filter(id=>selected.includes(id)).length]));
 const setPack=(type:string,n:number)=>setSelected(ids=>{const stack=packStacks.find(s=>s.key===type);if(!stack)return ids;const rest=ids.filter(id=>!stack.ids.includes(id));const add=stack.ids.slice(0,n);return (type==='club'||type==='sword')?[...add,...rest]:[...rest,...add];});
 const packPanel=<section className="pack-panel" aria-label="Pack for the descent"><h3>Your pack</h3><p className={loadout.weapon==='unarmed'?'pack-warn':''}>{selected.length?`${loadout.weapon==='unarmed'?'No weapon: you will fight bare-handed':`Wielding a ${loadout.weapon} (${weaponDamage[loadout.weapon]} damage)`}${loadout.armor?' · armor on':''} · bag ${loadout.bag}/6.`:'Nothing packed. You would go in bare-handed. Add gear below.'} {!loadout.valid&&loadout.reason}</p><StackRows stacks={packStacks} counts={packCounts} onCount={setPack} disabled={busy} empty="You own nothing to take. You can still enter bare-handed."/><p className="trade-note">Packed gear is lost if you die. Everything else stays safe in town.</p></section>;
 const profileNames:Record<string,string>={buyer:'The delver',maker:'The proprietor',worker:'The apprentice',worker2:'The journeyman',p2:'The mercenary',p3:'The wayfarer',p4:'The scavenger',p5:'The newcomer'};

 const buyIn=walletConnection?.buyCoins&&(world as any)?.buyIn?{buy:walletConnection.buyCoins,refresh}:null;
 return <BuyInContext.Provider value={buyIn}><section className={`game-shell ${walletOpen||personalOpen?'wallet-visible':''}`}>
 <div className="player-hud"><button className="character-token" disabled={!world||busy||!!run} onClick={()=>{setPersonalOpen(!personalOpen);setWalletOpen(false);setSessionOpen(false);setHelpOpen(false);}} aria-label="Open inventory and journal" aria-expanded={personalOpen}>{world?(profileNames[world.profile]??world.profile.replace(/^wallet:/,'')):'Loading…'} <small>satchel · journal</small></button><button className="purse" disabled={!world} aria-label="Open wallet and receipts" aria-expanded={walletOpen} onClick={()=>{setWalletOpen(!walletOpen);setPersonalOpen(false);setSessionOpen(false);setHelpOpen(false);}}>Wallet · {world?.credits??'—'} <small>test coins · receipts</small>{purseDelta&&<span key={purseDelta.key} className={`purse-delta ${purseDelta.n>0n?'up':'down'}`} aria-live="polite">{purseDelta.n>0n?'+':''}{purseDelta.n.toString()}</span>}</button><div className="hud-stock">{world?.items.length??0} {world?.items.length===1?'good':'goods'} in your satchel <small>{finished.length} {finished.length===1?'expedition':'expeditions'} completed</small></div><button className="help-launch" aria-expanded={helpOpen} onClick={()=>{setHelpOpen(!helpOpen);setWalletOpen(false);setPersonalOpen(false);setSessionOpen(false);}}>Help</button><button className="session-launch" aria-expanded={sessionOpen} onClick={()=>{setSessionOpen(!sessionOpen);setWalletOpen(false);setPersonalOpen(false);setHelpOpen(false);}}>Session</button></div>

 <div className={`game-notice ${notice?'has-notice':''}`} role="status">{!(busy||notice)&&<p className="world-hint"><span>Saltwake</span> {run?'Plan your next move. Every turn counts.':place||shopId?'Walk to a counter · Leave house returns to town':'Walk into doors to enter · Arrow keys / WASD to walk'}</p>}{(busy||notice)&&<Reading limit={80} text={busy?'The steward is recording your action…':notice}/>}</div>

 <div className="game-stage">
 {helpOpen&&<div className="purse-drawer navigation-help" role="region" aria-label="How to play"><button onClick={()=>setHelpOpen(false)}>Close help</button><h2>Find your way</h2><Pages label="Help topics" items={[
 {title:'Town & buildings',text:'Explore the town with arrow keys or WASD when the map is focused, or click a floor tile to walk. Walk into a doorway to enter. Inside, approach a counter and press Enter to interact.'},
 {title:'Your menus',text:'Inventory opens stored goods and your journal. Wallet opens balances and receipts. Inside a service, use the labeled tabs to switch tasks. Back to room closes the counter; Leave house returns to town. Escape closes an open account panel.'},
 {title:'Spaces and services',text:'Explore buildings and interact with the furnishings placed inside them. Services belong to their locations. The account controls above open your own inventory and records.'},
 {title:'On an expedition',text:'Movement and actions take turns. Read enemy intentions, use your bag, and reach the exit. Death forfeits town gear; unused dungeon loot returns to its pool. Opening an account menu does not pause a paid run’s deadline.'}
 ]} render={entry=><><h3>{entry.title}</h3><p>{entry.text}</p></>}/></div>}
 {sessionOpen&&<div className="purse-drawer"><button onClick={()=>setSessionOpen(false)}>Close session</button>{walletConnection?walletConnection.sessionControls:< ><p>Local sandbox. Operator-controlled characters, synthetic coins. This is not wallet authentication.</p>{world&&<label>Play as <select value={world.profile} disabled={busy} onChange={e=>void work(async()=>{worldGeneration.current++;setWorld(undefined);await api('profile',{profile:e.target.value});setRunId(undefined);setPlace(undefined);setShopId(undefined);setBuildingDistrict(undefined);setPractice(false);setCraftPractice(false);setPersonalOpen(false);setSelected([]);pendingAction.current=undefined;})}>{Object.entries(profileNames).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>}<button disabled={busy} onClick={()=>void work(async()=>{await api('session',{});})}>Reconnect</button></>}<button disabled={busy||!world} onClick={()=>void work(async()=>{const saved=sessionStorage.getItem(pendingCommandKey(world?.profile));if(saved)await command(JSON.parse(saved).action);})}>Retry interrupted action</button></div>}
 {world&&<FirstSteps world={world} hidden={!!place||!!shopId||!!run||practice||!!buildingDistrict||helpOpen||sessionOpen||walletOpen||personalOpen}/>}
 {personalOpen&&world&&<div className="purse-drawer"><button onClick={()=>setPersonalOpen(false)}>Close belongings</button><Desk locked={busy} panels={[{name:'Stored goods',content:satchel('Your stored belongings')},{name:'Journal',content:<Pages empty="No expeditions recorded. Visit the inn for a free training run." items={finished} label="Journal entries" render={r=><button onClick={()=>{setRunId(r.id);setPersonalOpen(false);}}>{r.roomTitle} · {r.terminal}</button>}/>},{name:'Business',content:<BusinessLedger ledger={(world as any).businessLedger}/>},{name:'Buildings',content:<MyBuildings shops={world.shops??[]} profile={world.profile} editions={world.editions}/>}]}/></div>}
 {walletOpen&&world&&<div className="purse-drawer"><button onClick={()=>setWalletOpen(false)}>Close purse</button><Wallet world={world} busy={busy} refresh={refresh}/></div>}
 {!world?<section className="arrival"><h1>Saltwake awaits</h1>{walletConnection?<p>Loading your town from NEAR testnet…</p>:<><p>Connecting to your local world…</p><p>If the harbor is offline, start <code>npm run sandbox</code> and <code>npm run server</code>.</p></>}<button onClick={()=>void work(async()=>{if(!walletConnection)await api('session',{});})}>Try the harbor again</button></section>:practice?<><Run compact/><button className="practice-return" onClick={()=>setPractice(false)}>← Return to the inn</button></>:run?<>
 <div className="expedition-heading"><span>The catacombs / {run.roomTitle}</span><span>Gear at risk · {Math.max(0,Math.ceil((Number(run.deadline)-Date.now())/60000))} minutes left</span></div>
 <Run compact remote={{state:run.state,send:act,busy,title:run.roomTitle,roomCount:run.roomCount,terminal:run.terminal,settlement:run.settlement,exit:run.exit,canExtract:run.canExtract,canContinue:run.canContinue,hasNextRoom:run.hasNextRoom}}/>
 {run.terminal?<section className="homecoming"><h2>{run.terminal==='extracted'?'Back in the daylight.':'The town takes you back.'}</h2><p>{run.settlement?.status==='Applied'?'Your belongings have been accounted for. Visit the market to sell your finds, or the kettle to rebuild.':'Your result is being confirmed. Reserved goods remain locked until it is settled.'}</p><RunSummary run={run}/><button className="primary" onClick={()=>{setRunId(undefined);setPlace(undefined);}}>Return to Saltwake</button><details><summary>Tell the gatewarden about this run</summary>{['fun','confusing','too-hard'].map(choice=><button key={choice} disabled={busy} onClick={()=>void work(()=>api('feedback',{run:run.id,choice}))}>{choice}</button>)}</details></section>:<><LootPrompt run={run} busy={busy} act={act}/><details className="retreat"><summary>Give up this expedition</summary><p>Abandoning loses your town equipment to the bank. Unused dungeon finds return to their funded pool.</p><button disabled={busy} onClick={()=>void work(()=>api('runs/'+run.id+'/abandon',{}))}>Abandon and forfeit gear</button></details></>}
 </>:<><div className="town-stage" hidden={!!place||!!shopId}><Town trade={{world,busy,command,refresh,onBusyChange:setChildBusy}} shops={world.shops??[]} onEnterShop={id=>{setSelected([]);setShopId(id);}} onBuild={world.shopContract&&!busy?setBuildingDistrict:undefined} onEnter={openPlace} disabled={!!place||!!shopId||!!buildingDistrict} openings={world.editions.filter(e=>e.status==='open'&&e.maker!==world.profile).reduce((n,e)=>n+e.bundles,0)} stock={((world as any).bankItems?.length??0)+(((world as any).listedItems??[]) as Item[]).filter(i=>i.location.kind!=='listed'||!(world.shops??[]).some(s=>s.listing_ids.includes((i.location as {listing:string}).listing))).length}>
 </Town></div>
 {buildingDistrict&&<ShopBuilder district={buildingDistrict} shops={world.shops??[]} profile={world.profile} editions={world.editions} command={command} refresh={refresh} onBusyChange={setChildBusy} onClose={()=>setBuildingDistrict(undefined)}/>}
 {shopId&&world.shops?.find(s=>s.id===shopId)&&<PlayerShop key={`${world.profile}:${shopId}`} shop={world.shops.find(s=>s.id===shopId)!} world={world} busy={busy} command={command} refresh={refresh} onBusyChange={setChildBusy} expedition={hallExpedition} onExit={()=>{setShopId(undefined);setSelected([]);}}/>}
 {drafting&&place==='guild'&&<FloorBuilder world={world} busy={busy} selected={selected} onToggleFunding={toggle} command={command} refresh={refresh} onBusyChange={setChildBusy} startOpen reviseFrom={revising} onClosed={()=>{setDrafting(false);setRevising(null);}}/>}
 {place&&location&&<Interior key={place} place={place} busy={busy} onBuilder={place==='guild'?()=>setDrafting(true):undefined} idleHint={place==='guild'?<><p><b>✎ Drafting table:</b> build your own dungeon. Draw it, rehearse it for free, then open it to other players.</p><p><b>⚑ Steward:</b> manage dungeons you have opened: results, fees, restocking.</p></>:undefined} onExit={()=>{setPlace(undefined);setCraftPractice(false);setDrafting(false);}} wallet={<Wallet world={world} busy={busy} refresh={refresh}/>}>
 {place==='inn'&&<Desk locked={busy} storage={satchel('Your stored belongings')} panels={[{name:'Innkeeper',content:<><h3>Make a living in Saltwake</h3><p>Delve for treasure, craft at the kettle, trade at the market, or fund your own dungeon.</p><button disabled={busy} onClick={()=>setPractice(true)}>Train in the cellar · free</button></>},{name:'Journal',content:finished.length?<Pages items={finished} label="Settled expeditions" render={r=><button className="journal-entry" onClick={()=>setRunId(r.id)}>{r.roomTitle} · {r.terminal}<span>Read the item account</span></button>}/>:<p>No settled expeditions yet.</p>}]}/>}
 {place==='market'&&<Desk locked={busy} panels={[{name:'Market counter',content:world.listings&&world.npc_order?<Shop onBusyChange={setChildBusy} world={world} busy={busy} selected={selected} command={command} refresh={refresh}/>:<p>Loading stock…</p>}]}/>}
 {place==='workshop'&&<Desk locked={busy} panels={[{name:'Working bench',content:<Crafting key={world.profile} onSelect={setSelected} sendCraft={walletConnection?.craft} storageScope={walletConnection?.storageScope} blocked={busy} onBusyChange={setChildBusy} onChange={value=>{worldGeneration.current++;setWorld(w=>w&&w.profile===value.profile?{...w,craft:value}:w);}} world={world} selected={selected} refresh={refresh}/>},{name:'Free practice',content:<Workbench/>}]}/>}
 {place==='guild'&&<Desk locked={busy} storage={satchel('Treasure for existing editions')} panels={[{name:'Build a dungeon',content:<FloorBuilder world={world} busy={busy} selected={selected} onToggleFunding={toggle} command={command} refresh={refresh} onBusyChange={setChildBusy}/>},{name:'Manage editions',content:<Maker onRevise={e=>{setRevising(e);setDrafting(true);}} onBusyChange={setChildBusy} world={world} busy={busy} selected={selected} command={command} refresh={refresh}/>},{name:'Receipts & recovery',content:<><button disabled={busy} onClick={()=>void work(async()=>{const saved=sessionStorage.getItem(pendingCommandKey(world.profile));if(saved)await command(JSON.parse(saved).action);})}>Resolve interrupted action</button><Pages items={world.operations.slice().reverse()} label="Steward receipts" render={o=><Reading text={`${o.status}: ${o.result??o.reason??o.id}`}/>}/></>}]}/>}
 {place==='gate'&&<Desk locked={busy} panels={[{name:'Expeditions',content:<>{packPanel}<Pages items={showArchive?world.editions:suggestions} label="Dungeon openings" className="dungeon-list" noun="Dungeon" prevLabel="← Previous dungeon" nextLabel="Next dungeon →" empty="No matching openings. Change preferences in Preparation or browse all editions and history." render={e=>offer(e)}/>{!world.editions.some(e=>e.status==='open')&&<p>No funded openings. Visit the guild to fund one.</p>}</>},{name:'Preparation',content:<><label>Browse<select aria-label="Browse editions" value={showArchive?'all':'matching'} onChange={e=>setShowArchive(e.target.value==='all')}><option value="matching">Matching openings</option><option value="all">All editions &amp; history</option></select></label><label>Rewards<select aria-label="Reward preference" value={preferences.rewards} onChange={e=>setPreferences({...preferences,rewards:e.target.value as MatchPreferences['rewards']})}><option value="any">Any</option><option value="treasure">Treasure</option><option value="none">No treasure</option></select></label><p className="gate-warning">Death forfeits packed gear. Start: {loadout.weapon} ({weaponDamage[loadout.weapon]} damage) · armor {loadout.armor?'equipped':'none'} · bag {loadout.bag}/6. {!loadout.valid&&loadout.reason}</p><div className="controls"><label>Max fee <input type="number" min="0" value={preferences.maxFee} onChange={e=>setPreferences({...preferences,maxFee:Number(e.target.value)})}/></label><button onClick={()=>setRotation(rotation+1)}>Other openings</button></div><p>Use Choose stored goods to pack your loadout. Only selected goods enter the dungeon. Check the selected offer’s rules and track record before paying.</p></>},{name:'Funding accounts',content:<Pages items={world.editions} label="Edition funding records" render={e=><><h3>{e.terms.title}</h3><Reading text={`Original ${e.originalValue}; refreshed ${e.refreshValue}; reserved ${e.reservedValue}; extracted ${e.extractedValue}; consumed ${e.consumedValue}; banked ${e.bankedValue}; remaining ${e.remainingValue}. Catalog values, not resale promises.`}/></>}/>}]}/>}


 </Interior>}
 </>}
 </div></section></BuyInContext.Provider>;
}

/** Plain-language account of what a settled run did to the player's goods. */
function RunSummary({run}:{run:RunView}){
 const d=run.settlement?.disposition as Record<string,string[]>|undefined;
 if(run.settlement?.status!=='Applied'||!d)return <div className="run-summary"><b>Confirming your result…</b><p>Goods stay locked until the steward records it.</p></div>;
 const items=(run.state as any).items as Record<string,{type:string}>;
 const list=(ids:string[]=[])=>{const by=new Map<string,number>();for(const id of ids){const t=items?.[id]?.type??'item';by.set(t,(by.get(t)??0)+1);}return [...by].map(([t,n])=>countOf(n,t)).join(', ');};
 const found=d.dungeon_extracted??[],kept=d.town_returned??[],lost=d.town_forfeited??[],used=[...(d.town_consumed??[]),...(d.dungeon_consumed??[])];
 const left=(d.dungeon_returned?.length??0)+(run.settlement.withheldCounts?.dungeon_returned??0);
 return <div className="run-summary"><b>{run.terminal==='extracted'?'You made it out.':run.terminal==='abandoned'?'You gave up and were led out.':run.terminal==='expired'?'Time ran out below.':'You fell in the dark.'}</b><ul>
  <li className={found.length?'gain':''}>Treasure found: {found.length?list(found):'none'}</li>
  {kept.length>0&&<li>Your gear came home: {list(kept)}</li>}
  {lost.length>0&&<li className="loss">Lost to the bank: {list(lost)}</li>}
  {used.length>0&&<li>Used up: {list(used)}</li>}
  {left>0&&<li>{left} treasure {left===1?'item stays':'items stay'} below for the next delver.</li>}
 </ul>{found.length>0&&<p>Sell finds at the market, or offer them to other players.</p>}</div>;
}

/** When you stand on loot, say so and offer the one-click actions; otherwise it hides in the Bag tab. */
function LootPrompt({run,busy,act}:{run:RunView;busy:boolean;act:(a:Action)=>void}){
 const st=run.state as any,p=st.player;
 const here=Object.values(st.items??{}).filter((i:any)=>i.location.kind==='floor'&&i.location.room===st.roomIndex&&i.location.x===p.x&&i.location.y===p.y) as {id:string;type:string}[];
 if(!here.length)return null;
 const bag=Object.values(st.items).filter((i:any)=>i.location.kind==='bag').length;
 return <div className="loot-prompt" role="status">{here.map(i=>{const gear=i.type==='sword'||i.type==='club'||i.type==='armor';const heal=i.type==='tonic'||i.type==='fineTonic';return <div key={i.id} className="loot-row"><ItemIcon type={i.type}/><span>You found <b>{catalog[i.type as keyof typeof catalog]?.name??i.type}</b>{bag>=6?' · bag full':''}</span>
  <button className="primary" disabled={busy||bag>=6} onClick={()=>act({type:'pickup',itemId:i.id})}>Take</button>
  {gear&&<button disabled={busy} onClick={()=>act({type:'equip',itemId:i.id})}>Equip</button>}
  {heal&&p.hp<12&&<button disabled={busy} onClick={()=>act({type:'use',itemId:i.id})}>Drink</button>}</div>;})}
  <small>Taking or using spends a turn. Treasure only becomes yours if you get out alive.</small></div>;
}
