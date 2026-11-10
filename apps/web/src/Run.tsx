import React, {useState, useRef} from 'react';
import {distance} from '../../../packages/game/src/state';
import {keyAction} from '../../../packages/game/src/controls';
import {act, type Action} from '../../../packages/game/src/actions';
import {practiceRun, roomTitle, roomExit, atClearedExit, hasNextRoom} from '../../../packages/game/src/generation';
import {accessible, isConsumable} from '../../../packages/game/src/inventory';
import {disposition} from '../../../packages/game/src/disposition';
import {catalog} from '../../../packages/shared/src/catalog';

export function Run() {
 const [s, set] = useState(()=>practiceRun());
 const board = useRef<HTMLDivElement>(null);
 const [notice, setNotice] = useState('');
 const send = (a:Action) => {
  const next=act(s,a);setNotice(next===s?'Cannot do that here, or no space. No turn spent.':'');set(next);board.current?.focus();
 };
 const click=(x:number,y:number)=>{
  const enemy=s.enemies.find(e=>e.x===x&&e.y===y);
  send(enemy?{type:'attack',enemyId:enemy.id}:{type:'move',x,y});
 };
 const restart=(armor=false)=>{set(practiceRun(armor));setNotice('');board.current?.focus();};
 const bag=Object.values(s.items).filter(i=>i.location.kind==='bag');
 const visibleItems=Object.values(s.items).filter(i=>accessible(s,i));
 const ended=s.status!=='active';
 const report=ended?disposition(s,s.status==='died'?'died':'extracted'):null;
 const targets=s.enemies.map(e=>e.recovering?`${e.id} is recovering.`:e.lane?.length?`${e.id} will charge the marked lane.`:`${e.id} targets ${e.intent.x}, ${e.intent.y}.`).join(' ');
 return <section className="expedition">
  <div>
   <div className="status"><strong>{roomTitle(s)} · {s.roomIndex+1}/2</strong><span>Health {s.player.hp}/12 · Turn {s.turn}</span></div>
   <div className="board" ref={board} role="application" tabIndex={0} aria-label="Dungeon board. Arrow keys or WASD to move and attack. G guard, space wait." onKeyDown={e=>{
    const a=keyAction(s,e);if(a){e.preventDefault();send(a);}else if(e.repeat&&!e.metaKey&&!e.ctrlKey&&!e.altKey)e.preventDefault();
   }}>
    {s.room.flatMap((row,y)=>[...row].map((tile,x)=>{
     const player=s.player.x===x&&s.player.y===y;
     const enemy=s.enemies.find(e=>e.x===x&&e.y===y);
     const trap=s.traps.find(t=>t.x===x&&t.y===y);
     const warning=s.enemies.some(e=>!e.recovering&&(e.lane?.length?e.lane.some(p=>p.x===x&&p.y===y):e.intent.x===x&&e.intent.y===y))||!!trap?.armed;
     const loot=Object.values(s.items).some(i=>i.location.kind==='floor'&&i.location.room===s.roomIndex&&i.location.x===x&&i.location.y===y);
     const exit=roomExit(s);const isExit=exit?.x===x&&exit?.y===y;
     const label=`${x},${y} ${tile==='#'?'wall':player?'you':enemy?enemy.id:trap?'spikes':loot?'loot':isExit?'exit':'floor'}${warning?' danger next turn':''}`;
     return <button key={`${x},${y}`} className={`tile ${tile==='#'?'wall':''} ${player?'player':''} ${enemy?'enemy':''} ${warning?'warning':''}`} tabIndex={-1} disabled={tile==='#'} aria-label={label} onClick={()=>click(x,y)}>
      {tile==='#'?'▪':player?'@':enemy?enemy.kind==='charger'?'B':'R':trap?trap.armed?'▲':'△':loot?'◆':isExit?'E':warning?'!':'·'}
      {player&&warning&&<span className="danger-badge" aria-hidden="true">!</span>}
      {enemy&&<small className="enemy-health">{enemy.hp} HP</small>}
     </button>;
    }))}
   </div>
   <div className="controls">
    <button onClick={()=>send({type:'guard'})} disabled={ended}>Guard [G]</button>
    <button onClick={()=>send({type:'wait'})} disabled={ended}>Wait [Space]</button>
    {s.enemies.filter(e=>distance(e,s.player)===1).map(e=><button key={e.id} disabled={ended} onClick={()=>send({type:'attack',enemyId:e.id})}>Attack {e.id}</button>)}
    <button onClick={()=>send({type:'extract'})} disabled={ended||!atClearedExit(s)}>Extract</button>
    {hasNextRoom(s)&&<button onClick={()=>send({type:'continue'})} disabled={ended||!atClearedExit(s)}>Enter spike hall</button>}
   </div>
   <p className="legend">@ You · R Rat · B Charging boar · ▲ Armed spikes · △ Safe spikes · ◆ Loot · E Exit</p>
   <p className="legend">Kill the enemies, then reach E to extract or continue. Charges hit the first creature; spikes hurt both sides. Recovery lasts one turn.</p>
   <section className="inventory" aria-label="Run inventory">
    <h2>Equipment & loot</h2><p>Bag {bag.length}/6 · Weapon: {s.player.weapon} · Armor: {s.player.armor?'equipped':'none'}</p>
    {visibleItems.map(i=><div className="item" key={i.id} data-item-id={i.id}>
     <span><strong>{catalog[i.type].name}</strong><small>{i.origin} · {i.location.kind} · {i.id}</small></span>
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
   <h2>{s.status==='died'?'You fell.':s.status==='extracted'?'You made it out.':s.enemies.length?'Read the threat':'Room cleared.'}</h2>
   <p>Moving into an enemy attacks it. Your {s.player.weapon} deals {s.player.weapon==='sword'?3:2} damage. Each valid action spends a turn, including using or equipping loot.</p>
   <div className="turn-feedback" role="status" aria-live="polite">Health {s.player.hp}. Position {s.player.x}, {s.player.y}. Turn {s.turn}. {notice} {s.log.at(-1)} {targets}</div>
   {s.enemies.map(e=><p key={e.id}>{e.id}: {e.hp} health · {e.recovering?'Recovering':e.lane?.length?'CHARGING — leave the striped lane':'Pursuing'}</p>)}
   <ol className="log" aria-label="Combat history">{s.log.map((line,i)=><li key={i}>{line}</li>)}</ol>
   {report&&<section aria-label="Practice item outcomes"><h2>What goes where</h2><p>Practice only: these transfers are a preview, not a bank transaction.</p>{Object.entries(report).map(([group,ids])=><p key={group}><strong>{({townConsumed:'Town supplies spent',townReturned:'Town gear kept',townForfeited:'Town gear to bank',dungeonConsumed:'Found supplies spent',dungeonExtracted:'Loot carried out',dungeonReturned:'Loot returned to dungeon'} as Record<string,string>)[group]}</strong><br/>{ids.join(', ')||'None'}</p>)}</section>}
   <button className="primary" onClick={()=>restart()}>Restart practice</button>
   <button className="primary secondary" onClick={()=>restart(true)}>Restart with armor</button>
   <p className="legend">All items are practice fixtures. Town gear cannot be dropped. Found gear returns to the dungeon on death; used potions stay spent.</p>
  </aside>
 </section>;
}
