import React,{useEffect,useRef,useState} from 'react';
import type {CraftView} from '../../server/src/craft';
export function Crafting({world,selected,refresh}:{world:any;selected:string[];refresh:()=>Promise<void>}){
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [now,setNow]=useState(Date.now());const lock=useRef(false);const pending=useRef<{path:string;body:any}|null>(null);const c=world.craft as CraftView|null;
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),30);return()=>clearInterval(t);},[]);
 const send=async(path:string,body:any)=>{if(lock.current)return;lock.current=true;setBusy(true);try{
  pending.current??={path,body};const p=pending.current;const response=await fetch('/api/craft/'+p.path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p.body)});const value=await response.json();
  if(!response.ok){pending.current=null;throw Error(value.error);}pending.current=null;await refresh();setError('');
 }catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}};
 const begin=(recovery=false)=>{const herbs=(world.bankItems??[]).filter((i:any)=>i.item_type==='herb').slice(0,2);const flasks=(world.bankItems??[]).filter((i:any)=>i.item_type==='flask').slice(0,2);void send('begin',{id:crypto.randomUUID(),inputIds:recovery?[...herbs,...flasks].map(i=>i.id):selected,recovery});};
 const active=c&&['pending','active','finishing'].includes(c.status);const elapsed=c?.startedAtMs===null?0:Math.max(0,now-(c?.startedAtMs??now));
 return <section aria-label="Paid batch crafting"><h2>Artisan workbench</h2><p>Two herbs + two flasks make two tonics. Hit the marked window on all three steps for fine quality. The server measures timing. A timeout yields normal tonics; ingredients stay locked until settlement.</p>
 <p role="status">{error||c?.error||''}</p>{!active&&<><button disabled={busy||selected.length!==4} onClick={()=>begin()}>Craft selected ingredients</button><button disabled={busy||Number(world.recovery?.budget??0)<2} onClick={()=>begin(true)}>Recovery job · bank supplies · wage 2</button><p>Recovery requires holdings below 6, at most 3 jobs per profile, and remaining labor funds. Bank keeps the output. Remaining labor budget: {world.recovery?.budget??'unavailable'}.</p></>}
 {c&&<><p>{c.status} · {c.recovery?'Bank recovery job':'Your batch'} · Step {Math.min(c.step+1,3)}/3 · {c.tier??'unscored'}</p>{c.status==='active'&&<>
 <div style={{height:24,background:'#151d22',position:'relative',maxWidth:560,border:'1px solid #73817f'}}><span style={{position:'absolute',left:`${c.target.startMs/c.stepMs*100}%`,width:`${(c.target.endMs-c.target.startMs)/c.stepMs*100}%`,height:'100%',background:'#987742'}}/><span style={{position:'absolute',left:`${Math.min(elapsed/c.stepMs,1)*100}%`,height:'100%',width:4,background:'#fff'}}/></div>
 <p>{c.startedAtMs===null?'Start when ready.':`${Math.min(elapsed,c.stepMs)} ms · target ${c.target.startMs}–${c.target.endMs} ms`}</p>
 <button disabled={busy} onClick={()=>void send(c.startedAtMs===null?'start':'input',{batch:c.id,id:crypto.randomUUID(),seq:c.seq,step:c.step})}>{c.startedAtMs===null?'Start step':'Strike / mix now'}</button></>}
 {c.status==='finished'&&<p>Confirmed outputs: {c.outputIds.join(', ')}. {c.recovery?'Bank owns these; your wage is paid.':'Select them in town to list in your shop.'}</p>}</>}
 </section>;
}
