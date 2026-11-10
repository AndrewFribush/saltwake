import {CharacterSprite} from './CharacterSprite';
import React, {useState, useRef} from 'react';
import {distance} from '../../../packages/game/src/state';
import {keyAction} from '../../../packages/game/src/controls';
import {act, type Action} from '../../../packages/game/src/actions';
import {practiceRun, roomTitle, roomExit, atClearedExit, hasNextRoom} from '../../../packages/game/src/generation';
import {accessible, isConsumable} from '../../../packages/game/src/inventory';
import {roguelikeRun,visibleTiles} from '../../../packages/game/src/roguelike';
import {disposition} from '../../../packages/game/src/disposition';
import {ItemIcon} from './ItemIcon';
import {catalog} from '../../../packages/shared/src/catalog';

export function Run({remote}:{remote?:{state:ReturnType<typeof practiceRun>;send:(a:Action)=>void;busy:boolean;title:string;roomCount:number;terminal:string|null;settlement:any;exit?:{x:number;y:number};canExtract?:boolean;hasNextRoom?:boolean}}) {
 const [local, set] = useState(()=>roguelikeRun(crypto.getRandomValues(new Uint32Array(1))[0]));const s=remote?.state??local;
 const board = useRef<HTMLDivElement>(null);
 const [notice, setNotice] = useState('');
 const send = (a:Action) => {
  if(remote){if(!remote.busy&&!remote.terminal)remote.send(a);return;}
  const next=act(s,a);setNotice(next===s?'Cannot do that here, or no space. No turn spent.':'');set(next);board.current?.focus();
 };
 const click=(x:number,y:number)=>{
  const enemy=s.enemies.find(e=>e.x===x&&e.y===y);
  send(enemy?{type:'attack',enemyId:enemy.id}:{type:'move',x,y});
 };
 const restart=(armor=false,replay=false)=>{set(roguelikeRun(replay?s.expeditionSeed??0:crypto.getRandomValues(new Uint32Array(1))[0],armor));setNotice('');board.current?.focus();};
 const canLeave=remote?(remote.canExtract??false):atClearedExit(s);
 const visible=visibleTiles(s);const visibleEnemies=s.enemies.filter(e=>visible.has(`${e.x},${e.y}`));
 const bag=Object.values(s.items).filter(i=>i.location.kind==='bag');
 const visibleItems=Object.values(s.items).filter(i=>accessible(s,i));
 const ended=s.status!=='active'||!!remote?.terminal;
 const report=ended&&!remote?disposition(s,s.status==='died'?'died':'extracted'):null;
 const targets=visibleEnemies.map(e=>e.recovering?`${e.id} is recovering.`:e.lane?.length?`${e.id} will charge the marked lane.`:`${e.id} targets ${e.intent.x}, ${e.intent.y}.`).join(' ');
 return <section className="expedition">
  <div>
   <div className="status"><strong>{remote?.title??roomTitle(s)} · {s.roomIndex+1}/{remote?.roomCount??2}</strong><span>Health {s.player.hp}/12 · Turn {s.turn}</span></div>
   <div className="board" style={{gridTemplateColumns:`repeat(${s.room[0].length},1fr)`}} ref={board} role="application" tabIndex={0} aria-label="Dungeon board. Arrow keys or WASD to move and attack. G guard, space wait." onKeyDown={e=>{
    const a=keyAction(s,e);if(a){e.preventDefault();send(a);}else if(e.repeat&&!e.metaKey&&!e.ctrlKey&&!e.altKey)e.preventDefault();
   }}>
    {s.room.flatMap((row,y)=>[...row].map((tile,x)=>{
     const seen=!s.roguelike||s.explored?.includes(`${s.roomIndex}:${x},${y}`);const lit=visible.has(`${x},${y}`);
     const player=s.player.x===x&&s.player.y===y;
     const enemy=lit?s.enemies.find(e=>e.x===x&&e.y===y):undefined;
     const trap=lit?s.traps.find(t=>t.x===x&&t.y===y):undefined;
     const warning=lit&&s.enemies.some(e=>!e.recovering&&(e.lane?.length?e.lane.some(p=>p.x===x&&p.y===y):e.intent.x===x&&e.intent.y===y))||!!trap?.armed;
     const loot=lit&&Object.values(s.items).some(i=>i.location.kind==='floor'&&i.location.room===s.roomIndex&&i.location.x===x&&i.location.y===y);
     const exit=remote?.exit??roomExit(s);const isExit=exit?.x===x&&exit?.y===y;
     const label=`${x},${y} ${!seen?'unexplored':!lit?(isExit?'remembered exit':'remembered'):tile==='#'?'wall':player?'you':enemy?enemy.id:trap?'spikes':loot?'loot':isExit?'exit':'floor'}${warning?' danger next turn':''}`;
     return <button key={`${x},${y}`} className={`tile ${!seen?'unexplored':!lit?'remembered':''} ${tile==='#'?'wall':''} ${player?'player':''} ${enemy?'enemy':''} ${warning?'warning':''}`} tabIndex={-1} disabled={!seen||tile==='#'} aria-label={label} onClick={()=>click(x,y)}>
      {seen&&(lit||isExit)&&(player?<CharacterSprite/>:<span aria-hidden="true" className={`game-sprite ${player?'delver':enemy?enemy.kind==='charger'?'boar':'rat':trap?trap.armed?'spikes':'safe-spikes':loot?'loot':isExit?'stairs':tile==='#'?'stone':'ground'}`}>{player?'':enemy?'':trap?'':loot?'◆':isExit?'≡':''}</span>)}
      {player&&warning&&<span className="danger-badge" aria-hidden="true">!</span>}
      {enemy&&<small className="enemy-health">{enemy.hp} HP</small>}
     </button>;
    }))}
   </div>
   <div className="controls">
    <button onClick={()=>send({type:'guard'})} disabled={ended}>Guard [G]</button>
    <button onClick={()=>send({type:'wait'})} disabled={ended}>Wait [Space]</button>
    {s.enemies.filter(e=>distance(e,s.player)===1).map(e=><button key={e.id} disabled={ended} onClick={()=>send({type:'attack',enemyId:e.id})}>Attack {e.id}</button>)}
    <button onClick={()=>send({type:'extract'})} disabled={ended||!canLeave}>Extract</button>
    {(remote?(remote.hasNextRoom??false):hasNextRoom(s))&&<button onClick={()=>send({type:'continue'})} disabled={ended||!canLeave}>Continue deeper</button>}
   </div>
   <p className="legend">{s.roguelike&&<>{remote?'Uncharted descent':`Descent #${s.expeditionSeed}`}  · {s.boon?`Shrine: ${s.boon}`:'No shrine blessing'} · Unexplored ground is hidden.<br/></>}Gold cloak: you · Grey: rat · Tusks: charging boar · Spikes alternate · ◆ Loot · Steps: exit</p>
   <p className="legend">Kill the enemies, then reach the stairs to extract or continue. Charges hit the first creature; spikes hurt both sides. Recovery lasts one turn.</p>
   {s.roguelike&&s.roomIndex===0&&canLeave&&!s.boon&&!ended&&<section className="shrine"><h2>The threshold shrine</h2><p>One choice for this descent. Leave safely now, or prepare for the deeper vault.</p><button onClick={()=>send({type:'boon',choice:'rest'})}>Rest: recover 4 health</button><button disabled={s.player.hp<=3} onClick={()=>send({type:'boon',choice:'edge'})}>Blood edge: lose 3 health, gain +1 damage</button></section>}
   <section className="inventory" aria-label="Run inventory">
    <h2>Equipment & loot</h2><p>Bag {bag.length}/6 · Weapon: {s.player.weapon} · Armor: {s.player.armor?'equipped':'none'}</p>
    {visibleItems.map(i=><div className="item" key={i.id} data-item-id={i.id}>
     <span className="item-description"><ItemIcon type={i.type}/><strong>{catalog[i.type].name}</strong><small>{i.origin} · {i.location.kind} · {i.id}</small></span>
     <div className="controls">
      {i.location.kind==='floor'&&<button disabled={ended} onClick={()=>send({type:'pickup',itemId:i.id})}>Take {catalog[i.type].name}</button>}
      {isConsumable(i.type)&&<button disabled={ended||s.player.hp===12} onClick={()=>send({type:'use',itemId:i.id})}>Drink {catalog[i.type].name}</button>}
      {['club','sword','armor'].includes(i.type)&&!['weapon','armor'].includes(i.location.kind)&&<button disabled={ended} onClick={()=>send({type:'equip',itemId:i.id})}>Equip {catalog[i.type].name}</button>}
      {i.origin==='dungeon'&&i.location.kind==='bag'&&<button disabled={ended} onClick={()=>send({type:'drop',itemId:i.id})}>Drop {catalog[i.type].name}</button>}
     </div>
    </div>)}
   </section>
  </div>
  <aside>
   <h2>{s.status==='died'?'You fell.':s.status==='extracted'?'You made it out.':remote?'Watch the shadows':s.enemies.length?'Read the threat':'Room cleared.'}</h2>
   <p>Moving into an enemy attacks it. Your {s.player.weapon} deals {(s.player.weapon==='sword'?3:2)+(s.boon==='edge'?1:0)} damage. Each valid action spends a turn, including using or equipping loot.</p>
   <div className="turn-feedback" role="status" aria-live="polite">Health {s.player.hp}. Position {s.player.x}, {s.player.y}. Turn {s.turn}. {notice} {s.log.at(-1)} {targets}</div>
   {visibleEnemies.map(e=><p key={e.id}>{e.id}: {e.hp} health · {e.recovering?'Recovering':e.lane?.length?'CHARGING — leave the striped lane':e.alerted===false?'Unaware':'Pursuing'}</p>)}
   <ol className="log" aria-label="Combat history">{s.log.map((line,i)=><li key={i}>{line}</li>)}</ol>
   {report&&<section aria-label="Practice item outcomes"><h2>What goes where</h2><p>Practice only: these transfers are a preview, not a bank transaction.</p>{Object.entries(report).map(([group,ids])=><p key={group}><strong>{({townConsumed:'Town supplies spent',townReturned:'Town gear kept',townForfeited:'Town gear to bank',dungeonConsumed:'Found supplies spent',dungeonExtracted:'Loot carried out',dungeonReturned:'Loot returned to dungeon'} as Record<string,string>)[group]}</strong><br/>{ids.join(', ')||'None'}</p>)}</section>}
   {!remote&&<><button className="primary" onClick={()=>restart()}>New descent · tonic kit</button>
   <button className="primary secondary" onClick={()=>restart(true)}>New descent · armor kit</button><button className="primary secondary" onClick={()=>restart(false,true)}>Retry this seed</button>
   <p className="legend">Seeded practice: layouts, threats and treasure change each descent. No gear carries between attempts. Town gear cannot be dropped. Found gear returns to the dungeon on death; used potions stay spent.</p></>}
   {remote?.terminal&&<section aria-label="Settlement"><h2>{remote.terminal}</h2><p>Settlement: {remote.settlement?.status??'Pending'}. {remote.settlement?.status!=='Applied'&&'Inventory remains locked until confirmed.'}</p>{remote.settlement?.disposition&&Object.entries(remote.settlement.disposition).map(([label,ids])=><p key={label}>{label.replaceAll('_',' ')}: {(ids as string[]).join(', ')||(remote.settlement.withheldCounts?.[label]?'':'None')}{remote.settlement.withheldCounts?.[label]>0&&` ${(ids as string[]).length?'+ ':''}${remote.settlement.withheldCounts[label]} undiscovered items (identities withheld)`}</p>)}</section>}
  </aside>
 </section>;
}
