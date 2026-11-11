import {doorOpen,signalValue,type Device} from '../../../packages/shared/src/mechanisms';
import {floorViewport} from '../../../packages/game/src/floor-editing';
import {enemyTelegraph,visibleThreatTiles} from '../../../packages/game/src/telegraph';
import {itemUse} from '../../../packages/shared/src/equipment';
import {attackDamage} from '../../../packages/game/src/state';
import {appendPlayEvent,type PlayTrace} from '../../../packages/game/src/play-events';
import {Pages,Reading} from './GamePanels';
import {TileArt} from './tileset';
import {CharacterSprite} from './CharacterSprite';
import React, {useState, useRef} from 'react';
import {distance} from '../../../packages/game/src/state';
import {keyAction} from '../../../packages/game/src/controls';
import {actWithMessages, type Action} from '../../../packages/game/src/actions';
import {practiceRun, roomTitle, roomExit, atClearedExit, canExtract, canContinue, exitHint, hasNextRoom} from '../../../packages/game/src/generation';
import {accessible, isConsumable} from '../../../packages/game/src/inventory';
import {roguelikeRun,visibleTiles} from '../../../packages/game/src/roguelike';
import {disposition} from '../../../packages/game/src/disposition';
import {ItemIcon} from './ItemIcon';
import {catalog} from '../../../packages/shared/src/catalog';

export function Run({remote,compact=false}:{compact?:boolean;remote?:{state:ReturnType<typeof practiceRun>;send:(a:Action)=>void;busy:boolean;title:string;roomCount:number;terminal:string|null;settlement:any;exit?:{x:number;y:number};canExtract?:boolean;canContinue?:boolean;hasNextRoom?:boolean}}) {
 const [local, set] = useState(()=>roguelikeRun(crypto.getRandomValues(new Uint32Array(1))[0]));const s=remote?.state??local;
 const board = useRef<HTMLDivElement>(null);
 const [compactTab,setCompactTab]=useState<'Map'|'Bag'|'Journal'>('Map'),[itemPage,setItemPage]=useState(0);
 const [notice, setNotice] = useState('');
 const [shoving,setShoving]=useState(false);const trace=useRef<PlayTrace>({events:[],dropped:0});
 const send = (a:Action) => {
  if(remote){if(!remote.busy&&!remote.terminal)remote.send(a);return;}
  let messages:string[]=[];const next=actWithMessages(s,a,lines=>{messages=lines;});trace.current=appendPlayEvent(trace.current,s,a,next,messages);setNotice(next===s?'Cannot do that here, or no space. No turn spent.':'');set(next);board.current?.focus();
 };
 const click=(x:number,y:number)=>{
  const enemy=s.enemies.find(e=>e.x===x&&e.y===y);
  send(enemy?{type:shoving&&s.rulesVersion===4?'shove':'attack',enemyId:enemy.id}:{type:'move',x,y});
 };
 const restart=(armor=false,replay=false)=>{set(roguelikeRun(replay?s.expeditionSeed??0:crypto.getRandomValues(new Uint32Array(1))[0],armor));trace.current={events:[],dropped:0};setShoving(false);setItemPage(0);setNotice('');board.current?.focus();};
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
 const targets=visibleEnemies.map(e=>`${e.id}: ${enemyTelegraph(s,e)}`).join(' ');
 const viewport=floorViewport(s.room[0].length,s.room.length,s.player.x-6,s.player.y-4);
 return <section className={`expedition ${compact?`compact-run run-tab-${compactTab.toLowerCase()}`:''}`}>
 {compact&&<nav className="studio-tabs" aria-label="Rehearsal sections">{(['Map','Bag','Journal'] as const).map(t=><button type="button" key={t} aria-pressed={compactTab===t} onClick={()=>setCompactTab(t)}>{t}</button>)}</nav>}
  <div>
   <div className="status"><strong>{remote?.title??roomTitle(s)} · {s.roomIndex+1}/{remote?.roomCount??s.layout?.length??2}</strong><span>Health {s.player.hp}/12 · Turn {s.turn}</span></div>
   <div className="board" style={{gridTemplateColumns:`repeat(${viewport.columns},1fr)`,gridTemplateRows:`repeat(${viewport.rows},minmax(0,1fr))`,aspectRatio:`${viewport.columns}/${viewport.rows}`}} ref={board} role="application" tabIndex={0} aria-label="Dungeon board. Arrow keys or WASD to move and attack. G guard, space wait. Select Shove mode to push instead of attack." onKeyDown={e=>{
    const a=keyAction(s,e);if(a){e.preventDefault();send(a.type==='attack'&&shoving&&s.rulesVersion===4?{type:'shove',enemyId:a.enemyId}:a);}else if(e.repeat&&!e.metaKey&&!e.ctrlKey&&!e.altKey)e.preventDefault();
   }}>
    {s.room.slice(viewport.y,viewport.y+viewport.rows).flatMap((row,dy)=>[...row].slice(viewport.x,viewport.x+viewport.columns).map((tile,dx)=>{const x=viewport.x+dx,y=viewport.y+dy;
     const seen=!s.roguelike||s.explored?.includes(`${s.roomIndex}:${x},${y}`);const lit=visible.has(`${x},${y}`);
     const player=s.player.x===x&&s.player.y===y;
     const enemy=lit?s.enemies.find(e=>e.x===x&&e.y===y):undefined;
     const device=lit?visibleDevices.find(d=>d.x===x&&d.y===y):undefined;
     const trap=lit?s.traps.find(t=>t.x===x&&t.y===y):undefined;
     const warning=lit&&danger.has(`${x},${y}`)||!!trap?.armed;
     const loot=lit&&Object.values(s.items).some(i=>i.location.kind==='floor'&&i.location.room===s.roomIndex&&i.location.x===x&&i.location.y===y);
     const connection=s.connections?.find(l=>l.x===x&&l.y===y);
     const exit=remote?.exit??roomExit(s);const isExit=exit?.x===x&&exit?.y===y;
     const label=`${x},${y} ${!seen?'unexplored':!lit?(isExit?'remembered exit':'remembered'):tile==='#'?'wall':player?'you':enemy?enemy.id:trap?'spikes':loot?'loot':connection?`passage to floor ${connection.to+1}${connection.require_clear&&s.enemies.length?' · clear room first':''}`:isExit?'exit':'floor'}${device?` · ${deviceLabel(device)}`:''}${warning?' danger next turn':''}`;
     return <button key={`${x},${y}`} className={`tile ${!seen?'unexplored':!lit?'remembered':''} ${tile==='#'?'wall':''} ${player?'player':''} ${enemy?'enemy':''} ${warning?'warning':''}`} tabIndex={-1} disabled={!seen||tile==='#'} aria-label={label} title={label} onClick={()=>click(x,y)}>
      {seen&&<TileArt wall={tile==='#'}/>}
      {seen&&(lit||isExit||!!connection)&&(player?<CharacterSprite/>:<span aria-hidden="true" className={`game-sprite ${player?'delver':enemy?enemy.kind==='charger'?'boar':'rat':trap?trap.armed?'spikes':'safe-spikes':loot?'loot':connection?'stairs':isExit?'stairs':tile==='#'?'stone':'ground'}`}>{player?'':enemy?'':trap?'':loot?'◆':connection?'↪':isExit?'≡':''}</span>)}
      {device&&<span aria-hidden="true" style={{position:'absolute',right:2,bottom:2,color:device.kind==='switch'?'#ffe08a':doorOpen(device,s.signals??{})?'#8df0c5':'#ff9696',background:'#16202b',borderRadius:3,padding:'0 3px',fontWeight:700,zIndex:2}}>{device.kind==='switch'?'⚡':doorOpen(device,s.signals??{})?'▯':'▣'}</span>}
      {player&&warning&&<span className="danger-badge" aria-hidden="true">!</span>}
      {enemy&&<small className="enemy-health">{enemy.hp} HP</small>}
     </button>;
    }))}
   </div>
   <div className="controls">
    {s.rulesVersion===4&&s.player.weapon==='club'&&<button aria-pressed={shoving} disabled={ended} onClick={()=>{setShoving(!shoving);board.current?.focus();}}>Shove mode {shoving?'on':'off'}</button>}
    <button title="Spend a turn to halve the first incoming hit, after armor, rounded up." onClick={()=>send({type:'guard'})} disabled={ended}>Guard [G]</button>
    <button onClick={()=>send({type:'wait'})} disabled={ended}>Wait [Space]</button>
    {s.enemies.filter(e=>distance(e,s.player)===1).map(e=><button key={e.id} disabled={ended} onClick={()=>send({type:shoving&&s.rulesVersion===4?'shove':'attack',enemyId:e.id})}>{shoving&&s.rulesVersion===4?'Shove':'Attack'} {e.id}</button>)}
    <button onClick={()=>send({type:'extract'})} disabled={ended||!canLeave}>{s.exitRule!==undefined||s.rulesVersion===4?'Escape · enemies act':'Extract'}</button>
    {(remote?(remote.hasNextRoom??false):hasNextRoom(s))&&<button onClick={()=>send({type:'continue'})} disabled={ended||!canGoDeeper}>Continue deeper</button>}
   </div>
   <p className="legend">{s.roguelike&&<>{remote?'Uncharted descent':s.rulesVersion===4?'Experimental rules rehearsal':`Descent #${s.expeditionSeed}`}  · {s.exitRule===undefined&&<>{s.boon?`Shrine: ${s.boon}`:'No shrine blessing'} · </>}Unexplored ground is hidden.<br/></>}Gold cloak: you · Grey: rat · Tusks: charging boar · Spikes: bright armed, dark safe · ◆ Loot · Steps: exit</p>
   <p className="legend">{s.exitRule!==undefined?'Exit conditions govern departure. Enemies and hazards act before you leave.':s.connections!==undefined?'Walk onto a passage to travel; enemies act before you leave. Cleared rooms stay cleared when revisited. Reach extraction stairs in a cleared room to return home.':s.rulesVersion===4?'Reach the exit to escape; enemies and hazards act before you leave. Club shoves; sword hits harder.':'Kill the enemies, then reach the stairs to extract or continue. Charges hit the first creature; spikes hurt both sides. Recovery lasts one turn.'}</p>
   {s.exitRule===undefined&&s.roguelike&&s.roomIndex===0&&canLeave&&(remote?remote.hasNextRoom:atClearedExit(s)&&hasNextRoom(s))&&!s.boon&&!ended&&<section className="shrine"><h2>The threshold shrine</h2><p>One choice for this descent. Leave safely now, or prepare for the deeper vault.</p><button onClick={()=>send({type:'boon',choice:'rest'})}>Rest: recover 4 health</button><button disabled={s.player.hp<=3} onClick={()=>send({type:'boon',choice:'edge'})}>Blood edge: lose 3 health, gain +1 damage</button></section>}
   <section className="inventory" aria-label="Run inventory">
    <h2>Equipment & loot</h2><p>Bag {bag.length}/6 · Weapon: {s.player.weapon} · Armor: {s.player.armor?'equipped':'none'}</p>
    {(compact?visibleItems.slice(Math.min(itemPage,Math.max(0,visibleItems.length-1)),Math.min(itemPage,Math.max(0,visibleItems.length-1))+1):visibleItems).map(i=><div className="item" key={i.id} data-item-id={i.id}>
     <span className="item-description"><ItemIcon type={i.type}/><strong>{catalog[i.type].name}</strong><small>{itemUse[i.type]}</small><small>{i.origin} · {i.location.kind} · {i.id}</small></span>
     <div className="controls">
      {i.location.kind==='floor'&&<button disabled={ended} onClick={()=>send({type:'pickup',itemId:i.id})}>Take {catalog[i.type].name}</button>}
      {isConsumable(i.type)&&<button disabled={ended||s.player.hp===12} onClick={()=>send({type:'use',itemId:i.id})}>Drink {catalog[i.type].name}</button>}
      {['club','sword','armor'].includes(i.type)&&!['weapon','armor'].includes(i.location.kind)&&<button disabled={ended} onClick={()=>send({type:'equip',itemId:i.id})}>Equip {catalog[i.type].name}</button>}
      {i.origin==='dungeon'&&i.location.kind==='bag'&&<button disabled={ended} onClick={()=>send({type:'drop',itemId:i.id})}>Drop {catalog[i.type].name}</button>}
     </div>
    </div>)}
   {compact&&<div className="studio-row"><button disabled={itemPage===0} onClick={()=>setItemPage(Math.max(0,itemPage-1))}>Previous item</button><span>{Math.min(itemPage+1,visibleItems.length)}/{visibleItems.length}</span><button disabled={itemPage>=visibleItems.length-1} onClick={()=>setItemPage(itemPage+1)}>Next item</button></div>}
   </section>
  </div>
  <aside>
   <h2>{s.status==='died'?'You fell.':s.status==='extracted'?'You made it out.':remote?'Watch the shadows':s.enemies.length?'Read the threat':'Room cleared.'}</h2>
   {!ended&&<p>Moving into an enemy attacks it. Attacks deal {attackDamage(s)} damage ({s.player.weapon}). Each valid action spends a turn, including using or equipping loot.</p>}
   <div className="turn-feedback" role="status" aria-live="polite"><Reading text={`Health ${s.player.hp}. Position ${s.player.x}, ${s.player.y}. Turn ${s.turn}. ${s.exitRule!==undefined?exitHint(s)+' ':''}${notice} ${danger.has(`${s.player.x},${s.player.y}`)?'Your tile is marked for danger. Consider moving or guarding. ':''}${s.log.at(-1)??''} ${targets}`}/></div>
   {!ended&&<Pages items={visibleEnemies} label="Visible enemies" render={e=><p key={e.id}>{e.id}: {e.hp} health · {Math.ceil(e.hp/attackDamage(s))} hits with {s.player.weapon}. {enemyTelegraph(s,e)}</p>}/>}
   {!!visibleDevices.length&&<Pages items={visibleDevices} label="Visible devices" render={d=><p>{deviceLabel(d)} · {d.x},{d.y}{d.kind==='switch'?' · Walk onto it to activate.':''}</p>}/>}
   <div className="log" aria-label="Combat history"><Pages items={s.log.slice().reverse()} size={2} label="Combat history" render={line=><p>{line}</p>}/></div>
   {report&&<section aria-label="Practice item outcomes"><h2>Your practice result</h2><Pages items={Object.entries(report)} label="Practice outcome categories" render={([group,ids])=><Reading limit={160} text={`${({townConsumed:'Town supplies spent',townReturned:'Town gear kept',townForfeited:'Town gear to bank',dungeonConsumed:'Found supplies spent',dungeonExtracted:'Loot carried out',dungeonReturned:'Loot returned to dungeon'} as Record<string,string>)[group]}: ${ids.map(id=>catalog[s.items[id].type].name).join(', ')||'None'}. Practice only; no real transfers.`}/>}/></section>}
   {!remote&&<><button className="primary" onClick={()=>restart()}>New practice · tonic kit</button>
   <button className="primary secondary" onClick={()=>restart(true)}>New practice · armor kit</button><button className="primary secondary" onClick={()=>restart(false,true)}>Retry this seed</button>
   <button onClick={()=>{const blob=new Blob([JSON.stringify({fixture:s.layout?.[0]?.id,kit:s.player.weapon,...trace.current},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='saltwake-practice-trace.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>Save practice record</button>
   <p className="legend">Practice uses synthetic gear. Create and rehearse your own floors at the guild. No gear carries between attempts. Town gear cannot be dropped. Found gear returns to the dungeon on death; used potions stay spent.</p></>}
   {remote?.terminal&&<section aria-label="Settlement"><h2>{remote.terminal}</h2><p>Settlement: {remote.settlement?.status??'Pending'}. {remote.settlement?.status!=='Applied'&&'Inventory remains locked until confirmed.'}</p>{remote.settlement?.disposition&&<Pages items={Object.entries(remote.settlement.disposition)} label="Settlement categories" render={([label,ids])=><Reading text={`${label.replaceAll('_',' ')}: ${(ids as string[]).join(', ')||'None'}${remote.settlement.withheldCounts?.[label]>0?` + ${remote.settlement.withheldCounts[label]} undiscovered items (identities withheld)`:''}`}/>}/>}</section>}

  </aside>
 </section>;
}
