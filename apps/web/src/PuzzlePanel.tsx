// Puzzle & passages: every piece a gate puzzle or a drop needs, in one builder panel.
// Data is unchanged: plates/keys/locks stay features, switches/gates stay devices, passages stay floor links.
import type {CustomFloor} from '../../../packages/shared/src/custom-layout';
import {puzzlePieces,puzzleAt,placePuzzlePiece,removePuzzleThing,connectRooms,oneWay,isSealedArena,makeSealedArena,deadEndFloors,channelWiring,type PuzzlePiece,type PlaceOptions} from '../../../packages/game/src/puzzle-editing';

export type PuzzleState=Omit<PlaceOptions,'id'>&{piece:PuzzlePiece;selected:{x:number;y:number}|null};
export const initialPuzzle:PuzzleState={piece:'plate',channel:'gate',color:'brass',mode:'toggle',openWhen:true,to:1,requireClear:false,selected:null};

/** Board click in the Puzzle panel: select a piece, or place the chosen one. Returns a repair hint when placement fails. */
export function puzzleClick(floors:CustomFloor[],index:number,state:PuzzleState,x:number,y:number,edit:(change:(floors:CustomFloor[])=>void)=>void):{selected:{x:number;y:number}|null;notice:string}{
 if(puzzleAt(floors[index],x,y))return {selected:{x,y},notice:''};
 const id=crypto.randomUUID().slice(0,12),options={...state,id};
 const trial=structuredClone(floors),error=placePuzzlePiece(trial,index,state.piece,x,y,options);
 if(error)return {selected:state.selected,notice:error};
 edit(f=>{placePuzzlePiece(f,index,state.piece,x,y,options);});
 return {selected:{x,y},notice:''};
}

const pieces:PuzzlePiece[]=['plate','switch','door','clock','key','lock','passage'];
const at=(p:{x:number;y:number})=>`${p.x},${p.y}`;

export function PuzzlePanel({floors,index,state,setState,edit}:{floors:CustomFloor[];index:number;state:PuzzleState;setState:(s:PuzzleState)=>void;edit:(change:(floors:CustomFloor[])=>void)=>void}){
 const floor=floors[index];const set=(patch:Partial<PuzzleState>)=>setState({...state,...patch});
 const thing=state.selected?puzzleAt(floor,state.selected.x,state.selected.y):null;
 const channels=[...new Set(floors.flatMap(f=>[...(f.devices??[]).map(d=>d.channel),...(f.features??[]).flatMap(x=>x.kind==='plate'||x.kind==='clock'?[x.channel]:[])]))];
 const connected=floor.links!==undefined;const wiring=channelWiring(floors,index);
 const incoming=floors.some((f,i)=>i!==index&&(f.links??[]).some(l=>l.to===index));
 const usesChannel=state.piece==='plate'||state.piece==='clock'||state.piece==='switch'||state.piece==='door';
 return <>
  <h3>Puzzle & passages</h3>
  <p className="studio-hint">Plates, levers, gates, keys, locks and passages in one place. Pick a piece and click a free floor tile; click a piece on the board to edit it. Pieces with the same channel name are wired together.</p>
  <div className="studio-row" role="group" aria-label="Puzzle piece">{pieces.map(p=><button type="button" key={p} aria-pressed={state.piece===p} onClick={()=>set({piece:p})}>{puzzlePieces[p].glyph} {puzzlePieces[p].name}</button>)}</div>
  <p className="studio-hint">{puzzlePieces[state.piece].summary}</p>
  <datalist id="puzzle-channels">{channels.map(c=><option key={c} value={c}/>)}</datalist>
  <div className="studio-row">
   {usesChannel&&<label>Channel <input aria-label="Puzzle channel" list="puzzle-channels" maxLength={32} value={state.channel} onChange={e=>set({channel:e.target.value})}/></label>}
   {state.piece==='switch'&&<label>Mode <select aria-label="Puzzle switch mode" value={state.mode} onChange={e=>set({mode:e.target.value as PuzzleState['mode']})}><option value="toggle">Toggle on/off</option><option value="set">Set on (trip)</option><option value="clear">Clear off</option></select></label>}
   {state.piece==='door'&&<label>Opens when <select aria-label="Puzzle gate opens when" value={String(state.openWhen)} onChange={e=>set({openWhen:e.target.value==='true'})}><option value="true">Channel on</option><option value="false">Channel off</option></select></label>}
   {(state.piece==='key'||state.piece==='lock')&&<label>Colour <input aria-label="Puzzle colour" maxLength={32} value={state.color} onChange={e=>set({color:e.target.value})}/></label>}
   {state.piece==='passage'&&connected&&<><label>To <select aria-label="Puzzle passage destination" value={state.to} onChange={e=>set({to:Number(e.target.value)})}>{floors.map((_,i)=><option key={i} value={i}>Floor {i+1}</option>)}</select></label><label><input type="checkbox" aria-label="Puzzle passage requires clear" checked={state.requireClear} onChange={e=>set({requireClear:e.target.checked})}/> Clear room first</label></>}
  </div>
  {state.piece==='passage'&&!connected&&<p>Passages need connected rooms. Turning them on keeps your floor order as stairs beside each exit. <button type="button" onClick={()=>edit(f=>connectRooms(f))}>Use connected rooms</button></p>}
  {thing&&<fieldset className="studio-feature"><legend>{thing.kind==='feature'?puzzlePieces[thing.feature.kind as PuzzlePiece].name:thing.kind==='device'?(thing.device.kind==='switch'?'Switch':'Gate'):'Passage'} at {state.selected!.x},{state.selected!.y}</legend>
   {thing.kind==='feature'&&thing.feature.kind==='plate'&&<label>Channel <input aria-label="Selected plate channel" list="puzzle-channels" maxLength={32} value={thing.feature.channel} onChange={e=>edit(f=>{const x=f[index].features!.find(x=>x.id===thing.feature.id);if(x?.kind==='plate')x.channel=e.target.value;})}/></label>}
   {thing.kind==='feature'&&thing.feature.kind==='clock'&&<>{(['channel','period','on','offset'] as const).map(k=><label key={k}>{k==='channel'?'Channel':k==='period'?'Cycle (turns)':k==='on'?'On for (turns)':'Start offset'} <input aria-label={`Selected clock ${k}`} {...(k==='channel'?{maxLength:32,list:'puzzle-channels'}:{type:'number',min:k==='period'?2:k==='on'?1:0,max:k==='period'?12:11})} value={(thing.feature as any)[k]} onChange={e=>edit(f=>{const x=f[index].features!.find(x=>x.id===thing.feature.id) as any;if(x?.kind==='clock')x[k]=k==='channel'?e.target.value:Number(e.target.value);})}/></label>)}<p className="studio-hint">Clocks need rules v14; the cycle starts when a player arrives on this floor.</p></>}
   {thing.kind==='feature'&&(thing.feature.kind==='key'||thing.feature.kind==='lock')&&<label>Colour <input aria-label="Selected colour" maxLength={32} value={thing.feature.color} onChange={e=>edit(f=>{const x=f[index].features!.find(x=>x.id===thing.feature.id);if(x?.kind==='key'||x?.kind==='lock')x.color=e.target.value;})}/></label>}
   {thing.kind==='device'&&<label>Channel <input aria-label="Selected device channel" list="puzzle-channels" maxLength={32} value={thing.device.channel} onChange={e=>edit(f=>{f[index].devices!.find(d=>d.id===thing.device.id)!.channel=e.target.value;})}/></label>}
   {thing.kind==='device'&&thing.device.kind==='switch'&&<label>Mode <select aria-label="Selected switch mode" value={thing.device.mode} onChange={e=>edit(f=>{const d=f[index].devices!.find(d=>d.id===thing.device.id);if(d?.kind==='switch')d.mode=e.target.value as 'toggle'|'set'|'clear';})}><option value="toggle">Toggle on/off</option><option value="set">Set on (trip)</option><option value="clear">Clear off</option></select></label>}
   {thing.kind==='device'&&thing.device.kind==='door'&&<label>Opens when <select aria-label="Selected gate opens when" value={String(thing.device.open_when)} onChange={e=>edit(f=>{const d=f[index].devices!.find(d=>d.id===thing.device.id);if(d?.kind==='door')d.open_when=e.target.value==='true';})}><option value="true">Channel on</option><option value="false">Channel off</option></select></label>}
   {thing.kind==='passage'&&<><label>To <select aria-label="Selected passage destination" value={thing.link.to} onChange={e=>edit(f=>{f[index].links!.find(l=>l.id===thing.link.id)!.to=Number(e.target.value);})}>{floors.map((_,i)=><option key={i} value={i}>Floor {i+1}</option>)}</select></label><label><input type="checkbox" aria-label="Selected passage requires clear" checked={thing.link.require_clear} onChange={e=>edit(f=>{f[index].links!.find(l=>l.id===thing.link.id)!.require_clear=e.target.checked;})}/> Clear room first</label>
    <p className="studio-hint">{oneWay(floors,index,thing.link)?`One-way: Floor ${thing.link.to+1} has no passage back here.`:`Floor ${thing.link.to+1} has a passage back.`}</p></>}
   <button type="button" onClick={()=>{edit(f=>removePuzzleThing(f[index],thing));set({selected:null});}}>Remove</button>
  </fieldset>}
  <h4>Wiring on this floor</h4>
  {wiring.length?<ul className="puzzle-wiring">{wiring.map(w=><li key={w.channel}><b>{w.channel}</b>: {[...w.plates.map(p=>`${floor.features?.find(x=>x.x===p.x&&x.y===p.y)?.kind==='clock'?'clock':'plate'} ${at(p)}`),...w.switches.map(s=>`${s.mode} switch ${at(s)}`)].join(', ')||'no driver here'} → {[...w.doors.map(d=>`gate ${at(d)} (opens when ${d.openWhen?'on':'off'})`),...(w.exit?['exit condition']:[])].join(', ')||'nothing here'}{w.issues.map(i=><span key={i} className="studio-hint"> ⚠ {i}</span>)}</li>)}</ul>:<p className="studio-hint">No channels yet. A plate and a gate with the same channel make a gate held open by weight.</p>}
  {connected&&<><h4>Sealed arena</h4>{isSealedArena(floors,index)?<p>This floor is a sealed arena: no passage leads back, and the exit opens only once every enemy is down.</p>:<p>{incoming?'Make arrivals commit: remove passages back to the floors that lead here, and open the exit only once every enemy is down.':'Add a passage into this floor from another floor first (a one-way drop).'} <button type="button" disabled={!incoming} onClick={()=>edit(f=>makeSealedArena(f,index))}>Make this floor a sealed arena</button></p>}</>}
  {deadEndFloors(floors).includes(index)&&<p className="studio-hint">⚠ No way out of this floor: no passage leads elsewhere and extraction is off. Players who arrive here can only die.</p>}
 </>;
}
