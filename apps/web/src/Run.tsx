import {doorOpen,signalValue,type Device} from '../../../packages/shared/src/mechanisms';
import {floorViewport} from '../../../packages/game/src/floor-editing';
import {enemyTelegraph,visibleThreatTiles} from '../../../packages/game/src/telegraph';
import {itemUse} from '../../../packages/shared/src/equipment';
import {attackDamage} from '../../../packages/game/src/state';
import {appendPlayEvent,type PlayTrace} from '../../../packages/game/src/play-events';
import {freshLines} from './run-journal';
import {lootHere,equipChoice,supplyTarget} from '../../../packages/game/src/controls';
import {RunMinimap} from './RunMinimap';
import {Pages,Reading} from './GamePanels';
import {TileArt} from './tileset';
import {Sprite} from './art/Sprite';
import {ActorLayer,useRunFx} from './art/RunFx';
import {FeatureArt} from './art/FeatureArt';
import React, {useState, useRef, useEffect} from 'react';
import {distance} from '../../../packages/game/src/state';
import {keyAction} from '../../../packages/game/src/controls';
import {actWithMessages, type Action} from '../../../packages/game/src/actions';
import {practiceRun, roomTitle, roomExit, atClearedExit, canExtract, canContinue, exitHint, hasNextRoom} from '../../../packages/game/src/generation';
import {accessible, isConsumable} from '../../../packages/game/src/inventory';
import {roguelikeRun,visibleTiles} from '../../../packages/game/src/roguelike';
import {disposition} from '../../../packages/game/src/disposition';
import {ItemIcon} from './ItemIcon';
import {catalog} from '../../../packages/shared/src/catalog';
import {clockOn,enemyCatalog,featureCatalog,supplyCatalog,altarBoons,type SupplyKind} from '../../../packages/shared/src/depth-components';
import {featureAt,type FeatureState,type Enemy} from '../../../packages/game/src/state';
import {supplyTargetError,who} from '../../../packages/game/src/depth';
import './depth.css';
import {depthPractice} from '../../../packages/game/src/draft-generator';
const clockLabel=(f:{channel:string;period:number;on:number;offset:number},turn:number)=>{const on=clockOn(f,turn);let n=1;while(n<f.period&&clockOn(f,turn+n)===on)n++;return `Tide clock · channel ${f.channel} ${on?'on':'off'}, flips in ${n} turn${n>1?'s':''} (${f.on} on / ${f.period-f.on} off)`;};
const featureLabel=(f:FeatureState,turn=0)=>f.kind==='clock'?clockLabel(f,turn):f.kind==='barrel'?`Powder keg${f.fuse?' · lit, bursts next turn':' · bump to light'}`:f.kind==='crack'?`Cracked wall · ${f.hp} bump${f.hp>1?'s':''} to break`:f.kind==='oil'?(f.burning?`Burning oil · ${f.burning} turns`:'Oil slick · flammable'):f.kind==='pit'?'Chasm · shove enemies in':f.kind==='fountain'?`Salt spring · +${f.heal} health, ${f.charges} left`:f.kind==='altar'?`Blood altar · pay ${f.cost} health: ${altarBoons[f.boon]}`:f.kind==='cache'?`Supply cache · ${f.count} × ${supplyCatalog[f.supply].name}`:f.kind==='key'?`${f.color} key · step on it to pick up`:f.kind==='lock'?`${f.color} locked door · bump with a ${f.color} key`:`Pressure plate · channel ${f.channel} on while occupied`;

export function Run({remote,compact=false}:{compact?:boolean;remote?:{state:ReturnType<typeof practiceRun>;send:(a:Action)=>void;busy:boolean;title:string;roomCount:number;terminal:string|null;settlement:any;exit?:{x:number;y:number};canExtract?:boolean;canContinue?:boolean;hasNextRoom?:boolean}}) {
 const [local, set] = useState(()=>{const q=Number(new URLSearchParams(location.search).get('seed'));return depthPractice(Number.isSafeInteger(q)&&q>0?q:crypto.getRandomValues(new Uint32Array(1))[0]);});const s=remote?.state??local;
 const board = useRef<HTMLDivElement>(null);
 // Keys go to the board as soon as a run screen appears (including after a reload mid-run).
 useEffect(()=>{board.current?.focus({preventScroll:true});},[]);
 const [compactTab,setCompactTab]=useState<'Map'|'Bag'|'Journal'>('Map'),[itemPage,setItemPage]=useState(0);
 const [notice, setNotice] = useState('');
 const [shoving,setShoving]=useState(false),[aiming,setAiming]=useState<SupplyKind|null>(null);const trace=useRef<PlayTrace>({events:[],dropped:0});
 // The journal: every message the run produced, oldest first, like a roguelike message log. The engine keeps only the
 // last 8 lines on the state, so the view accumulates them here (exact lines locally; the log's new tail for server runs).
 const [journal,setJournal]=useState<{turn:number;line:string}[]>(()=>s.log.map(line=>({turn:s.turn,line})));const prevLog=useRef(s.log);const journalEl=useRef<HTMLOListElement>(null);
 const note=(lines:string[],turn:number)=>{if(lines.length)setJournal(j=>[...j,...lines.map(line=>({turn,line}))].slice(-400));};
 useEffect(()=>{if(!remote)return;const lines=freshLines(prevLog.current,s.log);prevLog.current=s.log;note(lines,s.turn);},[s]);
 useEffect(()=>{const el=journalEl.current;if(el)el.scrollTop=el.scrollHeight;},[journal.length]);
 const send = (a:Action) => {
  if(remote){if(!remote.busy&&!remote.terminal)remote.send(a);return;}
  let messages:string[]=[];const next=actWithMessages(s,a,lines=>{messages=lines;});trace.current=appendPlayEvent(trace.current,s,a,next,messages);if(next!==s){prevLog.current=next.log;note(messages,next.turn);}setNotice(next===s?'Cannot do that here, or no space. No turn spent.':'');set(next);board.current?.focus();
 };
 const canShove=!!s.depth||s.rulesVersion===4&&s.player.weapon==='club';
 const click=(x:number,y:number)=>{
  if(aiming){const err=supplyTargetError(s,aiming,{x,y},visibleTiles(s));if(err){setNotice(`${supplyCatalog[aiming].name}: ${err}.`);return;}send({type:'supply',supply:aiming,x,y});setAiming(null);setNotice('');return;}
  const enemy=s.enemies.find(e=>e.x===x&&e.y===y);
  send(enemy?{type:shoving&&canShove?'shove':'attack',enemyId:enemy.id}:{type:'move',x,y});
 };
 const saveRecord=()=>{const blob=new Blob([JSON.stringify({fixture:s.layout?.[0]?.id,kit:s.player.weapon,...trace.current},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='saltwake-practice-trace.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const restart=(armor=false,replay=false)=>{const fresh=depthPractice(replay?s.expeditionSeed??0:crypto.getRandomValues(new Uint32Array(1))[0],armor?'armored':'club');set(fresh);prevLog.current=fresh.log;setJournal(fresh.log.map(line=>({turn:0,line})));trace.current={events:[],dropped:0};setShoving(false);setItemPage(0);setNotice('');board.current?.focus();};
 const canGoDeeper=remote?(remote.canContinue??(s.exitRule===undefined&&(remote.canExtract??false)&&(remote.hasNextRoom??false))):canContinue(s);
 const canLeave=remote?(remote.canExtract??false):canExtract(s);
 const visible=visibleTiles(s);const visibleEnemies=s.enemies.filter(e=>visible.has(`${e.x},${e.y}`));
 const visibleDevices=(s.devices??[]).filter(d=>visible.has(`${d.x},${d.y}`));
 const deviceLabel=(d:Device)=>d.kind==='door'?`Door ${d.channel}: ${doorOpen(d,s.signals??{})?'open':'closed'}`:`Switch ${d.channel}: ${d.mode} · channel ${signalValue(s.signals,d.channel)?'on':'off'}`;
 const danger=new Set((s.incomingDanger??visibleThreatTiles(s)).map(p=>`${p.x},${p.y}`));
 const bag=Object.values(s.items).filter(i=>i.location.kind==='bag');
 const visibleItems=Object.values(s.items).filter(i=>accessible(s,i));
 const ended=s.status!=='active'||!!remote?.terminal;
 const report=ended&&!remote?disposition(s,s.status==='died'?'died':'extracted'):null;
 const nameOf=(e:Enemy)=>who(e);
 const targets=visibleEnemies.map(e=>`${nameOf(e)}: ${enemyTelegraph(s,e)}`).join(' ');
 // Way-out cue: once no threat is in sight, point at the stairs (or say they are still unfound).
 const exitTile=remote?.exit??roomExit(s);const exitSeen=!!exitTile&&(!s.roguelike||!!s.explored?.includes(`${s.roomIndex}:${exitTile.x},${exitTile.y}`));
 const calm=!ended&&visibleEnemies.length===0;
 const wayOut=!calm||!exitTile?'':exitSeen?(s.player.x===exitTile.x&&s.player.y===exitTile.y?(canLeave||canGoDeeper?'You are on the stairs: escape or continue below.':'You are on the stairs, but this exit is not ready yet. Check the exit conditions.'):`The way out: stairs ${Math.abs(exitTile.y-s.player.y)?`${Math.abs(exitTile.y-s.player.y)} ${exitTile.y<s.player.y?'north':'south'}`:''}${Math.abs(exitTile.y-s.player.y)&&Math.abs(exitTile.x-s.player.x)?', ':''}${Math.abs(exitTile.x-s.player.x)?`${Math.abs(exitTile.x-s.player.x)} ${exitTile.x<s.player.x?'west':'east'}`:''} (glowing steps).`):'Stairs not found yet: explore the dark edges of the map.';
 const viewport=floorViewport(s.room[0].length,s.room.length,s.player.x-6,s.player.y-4);
 const fx=useRunFx(s);
 return <section className={`expedition ${compact?`compact-run run-tab-${compactTab.toLowerCase()}`:''}`}>
 {compact&&<nav className="studio-tabs" aria-label="Rehearsal sections">{(['Map','Bag','Journal'] as const).map(t=><button type="button" key={t} aria-pressed={compactTab===t} onClick={()=>setCompactTab(t)}>{t}</button>)}</nav>}
  <div>
   <div className="status"><strong>{remote?.title??roomTitle(s)} · {s.roomIndex+1}/{remote?.roomCount??s.layout?.length??2}</strong><span>Health {s.player.hp}/12 · Turn {s.turn}{s.tide?` · ${(s.tideTurns??0)>=s.tide.turns?`Flooding −${s.tide.damage}/turn`:`Tide in ${s.tide.turns-(s.tideTurns??0)}`}`:''}{s.buffs?.might?` · Might +${s.buffs.might}`:''}{s.keys?.length?` · Keys: ${s.keys.join(', ')}`:''}{s.buffs?.ward?` · Ward +${s.buffs.ward}`:''}</span></div>
   <div className={`board ${fx.shake?(fx.shake%2?'shake-a':'shake-b'):''}`} style={{gridTemplateColumns:`repeat(${viewport.columns},1fr)`,gridTemplateRows:`repeat(${viewport.rows},minmax(0,1fr))`,aspectRatio:`${viewport.columns}/${viewport.rows}`}} ref={board} role="application" tabIndex={0} aria-label="Dungeon board. Arrow keys or WASD to move and attack. G guard, space wait. Select Shove mode to push instead of attack." onKeyDown={e=>{
    if(e.key==='Escape'&&aiming){e.preventDefault();setAiming(null);setNotice('');return;}
    const k=e.key.toLowerCase();const plain=!e.metaKey&&!e.ctrlKey&&!e.altKey&&!e.repeat;
    if(plain&&k==='v'&&canShove&&!ended){e.preventDefault();setShoving(!shoving);return;}
    if(plain&&compact&&(k==='['||k===']')){e.preventDefault();setItemPage(p=>k==='['?Math.max(0,p-1):Math.min(Math.max(0,visibleItems.length-1),p+1));return;}
    if(plain&&compact&&(k==='m'||k==='i'||k==='j')){e.preventDefault();setCompactTab(k==='m'?'Map':k==='i'?'Bag':'Journal');return;}
    if(plain&&!remote&&k==='p'){e.preventDefault();restart(e.shiftKey);return;}
    if(plain&&!remote&&k==='y'){e.preventDefault();restart(false,true);return;}
    if(plain&&!remote&&k==='l'){e.preventDefault();saveRecord();return;}
    const a=keyAction(s,e);if(a){e.preventDefault();if(ended)return;send(a.type==='attack'&&shoving&&canShove?{type:'shove',enemyId:a.enemyId}:a);}else if(plain&&['b','n','q','r','t','backspace','delete'].includes(k)){e.preventDefault();setNotice(k==='b'||k==='n'?'No enemy in range for that.':k==='q'?'Nothing to drink.':k==='r'?'Nothing better to equip.':k==='t'?'Nothing to take here.':'Nothing of the dungeon’s to drop.');}else if(e.repeat&&!e.metaKey&&!e.ctrlKey&&!e.altKey)e.preventDefault();
   }}>
    {s.room.slice(viewport.y,viewport.y+viewport.rows).flatMap((row,dy)=>[...row].slice(viewport.x,viewport.x+viewport.columns).map((tile,dx)=>{const x=viewport.x+dx,y=viewport.y+dy;
     const seen=!s.roguelike||s.explored?.includes(`${s.roomIndex}:${x},${y}`);const lit=visible.has(`${x},${y}`);
     const player=s.player.x===x&&s.player.y===y;
     const enemy=lit?s.enemies.find(e=>e.x===x&&e.y===y):undefined;
     const device=lit?visibleDevices.find(d=>d.x===x&&d.y===y):undefined;
     const trap=lit?s.traps.find(t=>t.x===x&&t.y===y):undefined;
     const on=(ps:{x:number;y:number}[]|undefined)=>!!ps?.some(p=>p.x===x&&p.y===y);const threat=!lit?'':visibleEnemies.some(e=>e.kind==='archer'&&e.aim&&on(e.lane))?'warn-bolt':(s.features??[]).some(f=>!f.spent&&f.kind==='barrel'&&f.fuse&&Math.abs(f.x-x)<=1&&Math.abs(f.y-y)<=1)||visibleEnemies.some(e=>e.kind==='bomber'&&e.primed&&on(e.lane))?'warn-blast':visibleEnemies.some(e=>e.kind==='brute'&&on(e.lane))?'warn-smash':'';
     const feature=seen?(s.features??[]).find(f=>!f.spent&&f.x===x&&f.y===y):undefined;const blasted=!!s.blasts?.some(b=>b.x===x&&b.y===y);const hatch=lit&&s.enemies.some(e=>e.hatch?.x===x&&e.hatch?.y===y);
     const warning=lit&&danger.has(`${x},${y}`)||!!trap?.armed;
     const loot=lit&&Object.values(s.items).some(i=>i.location.kind==='floor'&&i.location.room===s.roomIndex&&i.location.x===x&&i.location.y===y);
     const connection=s.connections?.find(l=>l.x===x&&l.y===y);
     const exit=remote?.exit??roomExit(s);const isExit=exit?.x===x&&exit?.y===y;
     const label=`${x},${y} ${!seen?'unexplored':!lit?(isExit?'remembered exit':'remembered'):tile==='#'?'wall':player?'you':enemy?nameOf(enemy):trap?'spikes':loot?'loot':connection?`passage to floor ${connection.to+1}${connection.require_clear&&s.enemies.length?' · clear room first':''}${connection.to!==s.roomIndex&&!s.layout?.[connection.to]?.links?.some(l=>l.to===s.roomIndex)?' · one way, no return':''}`:isExit?'exit':'floor'}${feature?` · ${featureLabel(feature,s.floorTurn??0)}`:''}${hatch?' · rat hatching here':''}${device?` · ${deviceLabel(device)}`:''}${warning?' danger next turn':''}`;
     return <button key={`${x},${y}`} className={`tile ${(x*7+y*13)%5<2?'alt':''} ${!seen?'unexplored':!lit?'remembered':''} ${tile==='#'?'wall':''} ${player?'player':''} ${enemy?'enemy':''} ${warning?'warning':''} ${blasted?'blasted':''} ${threat} ${calm&&exitSeen&&isExit?'exit-cue':''} ${aiming&&lit?'aimable':''}`} tabIndex={-1} disabled={!seen||tile==='#'&&feature?.kind!=='crack'} aria-label={label} title={label} onClick={()=>click(x,y)}>
      {seen&&<TileArt wall={tile==='#'}/>}
      {seen&&(lit||isExit||!!connection)&&(connection||isExit?<Sprite name={connection&&connection.to>s.roomIndex?'hatch':'stairs'} className={`tile-thing stairs-art ${connection?(connection.to>s.roomIndex?'passage down':'passage up'):''}`}/>:trap?<Sprite name={trap.armed?'spikesArmed':'spikesSafe'} className={`tile-thing spikes-art ${trap.armed?'armed':''}`}/>:null)}
      {feature&&<FeatureArt feature={feature} lit={lit} on={(feature.kind==='plate'||feature.kind==='clock')&&signalValue(s.signals,feature.channel)} turn={s.floorTurn??0}/>}
      {seen&&lit&&loot&&<Sprite name="loot" className="tile-thing loot-art"/>}
      {hatch&&<span aria-hidden="true" className="depth-hatch"/>}
      {device&&<Sprite name={device.kind==='switch'?(signalValue(s.signals,device.channel)?'leverOn':'leverOff'):doorOpen(device,s.signals??{})?'gateOpen':'gateClosed'} className={`tile-thing device-art ${device.kind}`}/>}
      {(warning||!!threat)&&<span aria-hidden="true" className="threat-mark"/>}
     </button>;
    }))}
    <ActorLayer s={s} fx={fx} visible={visible} viewport={viewport} danger={danger.has(`${s.player.x},${s.player.y}`)} ended={ended} dangerSet={danger} canLeave={canLeave}/>
   </div>
   <RunMinimap s={s} roomCount={remote?.roomCount??s.layout?.length} exit={exitTile??undefined}/>
   <div className="controls key-prompts" aria-label="Actions available now">
    {!ended&&<>
    {canShove&&<Key k="V" on={shoving}>Shove mode {shoving?'on':'off'}</Key>}
    <Key k="G">Guard</Key><Key k="Space">Wait</Key>
    {s.enemies.some(e=>distance(e,s.player)===1)&&<Key k="↑↓←→">{shoving&&canShove?'Shove':'Attack'} {s.enemies.filter(e=>distance(e,s.player)===1).map(nameOf).join(', ')}</Key>}
    {s.depth&&(()=>{const f=featureAt(s,s.player);return f?.kind==='fountain'?<Key k="E" on={s.player.hp<12}>Drink spring +{f.heal}</Key>:f?.kind==='altar'?<Key k="E" on={s.player.hp>f.cost}>Blood pact: −{f.cost} health for {f.boon}</Key>:null;})()}
    {s.depth&&(['bomb','dart','flash'] as SupplyKind[]).filter(k=>(s.supplies?.[k]??0)>0).map(k=><Key key={k} k={k==='bomb'?'B':k==='dart'?'N':'F'} on={k==='flash'||!!supplyTarget(s,k)}>{k==='flash'?'Use':'Throw'} {supplyCatalog[k].name.toLowerCase()} ×{s.supplies![k]}{k!=='flash'&&!supplyTarget(s,k)?' (no target)':''}</Key>)}
    {canLeave&&<Key k="X">{s.exitRule!==undefined||s.rulesVersion===4?'Escape · enemies act':'Escape'}</Key>}
    {(remote?(remote.hasNextRoom??false):hasNextRoom(s))&&canGoDeeper&&<Key k="C">Continue deeper</Key>}
    {lootHere(s).length>0&&<Key k="T">Take {catalog[lootHere(s)[0].type].name.toLowerCase()}{bag.length>=6?' (bag full: drop first)':''}</Key>}
    {(()=>{const drink=['fineTonic','tonic'].map(t=>bag.find(i=>i.type===t)).find(Boolean);return drink&&s.player.hp<12?<Key k="Q">Drink {catalog[drink.type].name.toLowerCase()}</Key>:null;})()}
    {(()=>{const g=equipChoice(s);return g?<Key k="R">Equip {catalog[g.type].name.toLowerCase()}</Key>:null;})()}
    {bag.some(i=>i.origin==='dungeon')&&<Key k="⌫">Drop {catalog[[...bag].reverse().find(i=>i.origin==='dungeon')!.type].name.toLowerCase()}</Key>}
    </>}
   </div>
   <p className="legend">{s.roguelike&&<>{remote?'Uncharted descent':s.rulesVersion===4?'Experimental rules rehearsal':`Descent #${s.expeditionSeed}`}  · {s.exitRule===undefined&&<>{s.boon?`Shrine: ${s.boon}`:'No shrine blessing'} · </>}Unexplored ground is hidden.<br/></>}Gold cloak: you · Grey: rat · Tusks: charging boar ·{s.depth&&' Crossbow: sentry · Red shell: powder crab · Hulk: brute · Mound: nest · Keg, oil, chasm, spring, altar, cache are features · Gold edge: bolt line · Red edge: blast · Orange edge: brute smash ·'} Spikes: bright armed, dark safe · ◆ Loot · Steps: exit</p>
   <p className="legend">{s.exitRule!==undefined?'Exit conditions govern departure. Enemies and hazards act before you leave.':s.connections!==undefined?'Walk onto a passage to travel; enemies act before you leave. Cleared rooms stay cleared when revisited. Reach extraction stairs in a cleared room to return home.':s.rulesVersion===4?'Reach the exit to escape; enemies and hazards act before you leave. Club shoves; sword hits harder.':'Kill the enemies, then reach the stairs to extract or continue. Charges hit the first creature; spikes hurt both sides. Recovery lasts one turn.'}</p>
   {s.exitRule===undefined&&s.roguelike&&s.roomIndex===0&&canLeave&&(remote?remote.hasNextRoom:atClearedExit(s)&&hasNextRoom(s))&&!s.boon&&!ended&&<section className="shrine"><h2>The threshold shrine</h2><p>One choice for this descent. Leave safely now, or prepare for the deeper vault.</p><Key k="1">Rest: recover 4 health</Key><Key k="2" on={s.player.hp>3}>Blood edge: lose 3 health, gain +1 damage</Key></section>}
   <section className="inventory" aria-label="Run inventory">
    <h2>Equipment & loot</h2><p>Bag {bag.length}/6 · Weapon: {s.player.weapon} · Armor: {s.player.armor?'equipped':'none'}</p>
    {(compact?visibleItems.slice(Math.min(itemPage,Math.max(0,visibleItems.length-1)),Math.min(itemPage,Math.max(0,visibleItems.length-1))+1):visibleItems).map(i=><div className="item" key={i.id} data-item-id={i.id}>
     <span className="item-description"><ItemIcon type={i.type}/><strong>{catalog[i.type].name}</strong><small>{itemUse[i.type]}</small><small>{i.origin} · {i.location.kind} · {i.id}</small></span>
     <div className="controls">
      <small className="item-keys">{i.location.kind==='floor'?'On the floor here: step on it or press T':isConsumable(i.type)?'Q drinks the best tonic':['club','sword','armor'].includes(i.type)&&!['weapon','armor'].includes(i.location.kind)?'R equips the best gear':i.origin==='dungeon'&&i.location.kind==='bag'?'⌫ drops the last find':''}</small>
     </div>
    </div>)}
   {compact&&visibleItems.length>1&&<div className="studio-row"><Key k="[ ]">Item {Math.min(itemPage+1,visibleItems.length)}/{visibleItems.length}</Key></div>}
   </section>
  </div>
  <aside>
   {!ended&&<h2>{remote?'Watch the shadows':s.enemies.length?'Read the threat':'Room cleared.'}</h2>}
   {!ended&&<p>Moving into an enemy attacks it. Attacks deal {attackDamage(s)} damage ({s.player.weapon}). Each valid action spends a turn, including using or equipping loot.</p>}
   <div className="turn-feedback" role="status" aria-live="polite">{wayOut&&<p className="way-out">{wayOut}</p>}<Reading text={`Health ${s.player.hp}. Position ${s.player.x}, ${s.player.y}. Turn ${s.turn}. ${s.exitRule!==undefined?exitHint(s)+' ':''}${notice} ${danger.has(`${s.player.x},${s.player.y}`)?'Your tile is marked for danger. Consider moving or guarding. ':''}${s.log.at(-1)??''} ${targets}`}/></div>
   {!ended&&<Pages items={visibleEnemies} label="Visible enemies" render={e=><p key={e.id}><strong>{s.depth?who(e):`${enemyCatalog[e.kind??'pursuer'].name} ${e.id}`}</strong>: {e.hp} health · {Math.ceil(e.hp/attackDamage(s))} hits with {s.player.weapon}. {enemyTelegraph(s,e)}</p>}/>}
   {s.depth&&(()=>{const fs=(s.features??[]).filter(f=>!f.spent&&visible.has(`${f.x},${f.y}`));return fs.length?<Pages items={fs} label="Visible features" render={f=><p>{featureLabel(f,s.floorTurn??0)} · {f.x},{f.y}. {featureCatalog[f.kind].summary}</p>}/>:null;})()}
   {!!visibleDevices.length&&<Pages items={visibleDevices} label="Visible devices" render={d=><p>{deviceLabel(d)} · {d.x},{d.y}{d.kind==='switch'?' · Walk onto it to activate.':''}</p>}/>}
   <ol className="run-log" ref={journalEl} aria-label="Journal: everything that happened this run, oldest first">{journal.map((e,i)=><li key={i} className={`${i===journal.length-1?'newest':''} ${i>0&&journal[i-1].turn!==e.turn?'turn-break':''}`}><small>T{e.turn}</small>{e.line}</li>)}</ol>
   {ended&&<RunSummary s={s} remote={remote} report={report??(remote&&!remote.terminal?safeDisposition(s):null)}/>}
   {!remote&&<><div className="key-prompts"><Key k="P">New practice · tonic kit</Key><Key k="Shift+P">New practice · armor kit</Key><Key k="Y">Retry this seed</Key><Key k="L">Save practice record</Key><Key k="H">Return to the inn</Key></div>
   <p className="legend">Practice uses synthetic gear. Create and rehearse your own floors at the guild. No gear carries between attempts. Town gear cannot be dropped. Found gear returns to the dungeon on death; used potions stay spent.</p></>}


  </aside>
 </section>;
}

/** A key prompt: what pressing it does right now. `on` false dims it (shown but not currently useful). */
function Key({k,on=true,children}:{k:string;on?:boolean;children:React.ReactNode}){return <span className={`key-hint ${on?'':'off'}`}><kbd>{k}</kbd> {children}</span>;}

const outcomeText:Record<string,[string,string]>={
 dungeonExtracted:['Carried out','Dungeon finds you brought home are now yours.'],dungeon_extracted:['Carried out','Dungeon finds you brought home are now yours.'],
 townReturned:['Gear kept','Your packed town gear returns to storage.'],town_returned:['Gear kept','Your packed town gear returns to storage.'],
 townForfeited:['Gear lost to the bank','Death, abandonment or timeout forfeits packed town gear.'],town_forfeited:['Gear lost to the bank','Death, abandonment or timeout forfeits packed town gear.'],
 dungeonReturned:['Left in the dungeon','Unused finds go back to the dungeon for the next delver.'],dungeon_returned:['Left in the dungeon','Unused finds go back to the dungeon for the next delver.'],
 townConsumed:['Used up (yours)','Consumables you drank stay spent.'],town_consumed:['Used up (yours)','Consumables you drank stay spent.'],
 dungeonConsumed:['Used up (found)','Found consumables you drank stay spent.'],dungeon_consumed:['Used up (found)','Found consumables you drank stay spent.'],
};
function safeDisposition(s:ReturnType<typeof practiceRun>){try{return disposition(s,s.status==='died'?'died':'extracted');}catch{return null;}}
/** End-of-run summary: how it ended, what came home, what was lost and why. */
function RunSummary({s,remote,report}:{s:ReturnType<typeof practiceRun>;remote?:{terminal:string|null;settlement:any};report:Record<string,string[]>|null}){
 const name=(id:string)=>s.items[id]?catalog[s.items[id].type].name:id;
 const real=!!remote?.terminal,disp:Record<string,string[]>|null=real?remote!.settlement?.disposition??null:report;
 const withheld:Record<string,number>=real?remote!.settlement?.withheldCounts??{}:{};
 const died=s.status==='died'||/died|expired|abandon/i.test(remote?.terminal??'');
 const groups=disp?Object.entries(disp).filter(([k,ids])=>ids.length||withheld[k]>0):[];
 return <section className="run-summary" aria-label="Run summary">
  <h2>{died?'You fell.':'You made it out.'}</h2>
  <p>{died?`${s.killedBy?`Killed by ${s.killedBy}`:'Your run ended'} on floor ${s.roomIndex+1}, turn ${s.turn}.`:`Escaped from floor ${s.roomIndex+1} on turn ${s.turn} with ${s.player.hp} health.`}{s.depth&&s.supplies&&Object.values(s.supplies).some(n=>n)?' Unused supplies stay in the dungeon.':''}</p>
  {real&&<p>Settlement: {remote!.settlement?.status??'Pending'}.{remote!.settlement?.status!=='Applied'&&' Goods stay locked until the chain confirms.'}</p>}
  {!real&&<p><small>{remote?'Rehearsal':'Practice'} only: nothing really moves.</small></p>}
  {groups.length?<ul>{groups.map(([k,ids])=>{const [title,why]=outcomeText[k]??[k.replaceAll('_',' '),''];return <li key={k}><strong>{title}:</strong> {ids.map(name).join(', ')}{withheld[k]>0?`${ids.length?' + ':''}${withheld[k]} unseen item${withheld[k]>1?'s':''}`:''}. <small>{why}</small></li>;})}</ul>:disp?<p>No goods changed hands.</p>:null}
 </section>;
}
