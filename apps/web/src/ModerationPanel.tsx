import React,{useEffect,useState} from 'react';
import {playerLabel} from './presence-names';
type Report={at:number;reporter:string;from:string;messageId:string;text:string;space:string|null};
/** Local operator moderation (demo custody only): recent chat reports and chat time-outs. No economic authority. */
export function ModerationPanel(){
 const [data,setData]=useState<{reports:Report[];timeouts:{player:string;until:number}[]}>(),[notice,setNotice]=useState('');
 const load=()=>fetch('/api/moderation/reports').then(r=>r.ok?r.json():Promise.reject(Error('Moderation is only available in the local demo.'))).then(setData).catch(e=>setNotice(e.message));
 useEffect(()=>{void load();},[]);
 const timeout=async(player:string,minutes:number)=>{const r=await fetch('/api/moderation/timeout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({player,minutes})});setNotice(r.ok?`${playerLabel(player)} cannot chat for ${minutes} minutes.`:(await r.json()).error);void load();};
 return <section className="moderation" aria-label="Chat moderation"><h3>Chat moderation (operator)</h3><p className="trade-note">Reports and time-outs affect chat only, never goods or coins.</p>{notice&&<p role="status">{notice}</p>}
  {data?.timeouts.length?<p>Timed out: {data.timeouts.map(t=>`${playerLabel(t.player)} until ${new Date(t.until).toLocaleTimeString()}`).join(', ')}</p>:null}
  {!data?.reports.length?<p>No reports.</p>:<ul>{data.reports.slice(0,8).map(r=><li key={r.at+r.messageId}><b>{playerLabel(r.from)}</b>: “{r.text}” <small>reported by {playerLabel(r.reporter)} · {new Date(r.at).toLocaleTimeString()}</small> <button onClick={()=>void timeout(r.from,10)}>Time out 10 min</button></li>)}</ul>}
  <button onClick={()=>void load()}>Refresh</button></section>;
}
