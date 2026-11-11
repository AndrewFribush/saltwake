import React, {useState, useSyncExternalStore} from 'react';
import './tileset.css';
type Skin={version:1;image:string;name:string;size:number;width:number;height:number;floor:number;wall:number;provenance:string};
const key='saltwake-tileset:v1';
let current:Skin|null=null;
try{const s=JSON.parse(localStorage.getItem(key)||'null');if(s?.version===1&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(s.image)&&s.image.length<3_000_000&&Number.isInteger(s.size)&&s.size>=8&&s.size<=128&&Number.isInteger(s.width)&&Number.isInteger(s.height)&&s.width>=8&&s.height>=8&&s.width<=2048&&s.height<=2048&&s.width/s.size*s.height/s.size<=1024&&typeof s.name==='string'&&s.name.length<=120&&typeof s.provenance==='string'&&s.provenance.length<=240&&s.width%s.size===0&&s.height%s.size===0&&[s.floor,s.wall].every(n=>Number.isInteger(n)&&n>=0&&n<(s.width/s.size)*(s.height/s.size)))current=s;}catch{}
const listeners=new Set<()=>void>();
const subscribe=(f:()=>void)=>{listeners.add(f);return()=>{listeners.delete(f);};};
function useSkin(){return useSyncExternalStore(subscribe,()=>current);}
function persist(s:Skin|null){if(s)localStorage.setItem(key,JSON.stringify(s));else localStorage.removeItem(key);current=s;listeners.forEach(f=>f());}
function art(s:Skin,index:number):React.CSSProperties {const cols=s.width/s.size,rows=s.height/s.size;return {backgroundImage:`url(${s.image})`,backgroundSize:`${cols*100}% ${rows*100}%`,backgroundPosition:`${cols===1?0:index%cols/(cols-1)*100}% ${rows===1?0:Math.floor(index/cols)/(rows-1)*100}%`};}
export function TileArt({wall=false}:{wall?:boolean}){const s=useSkin();return s?<span aria-hidden="true" className="custom-tile-art" style={art(s,wall?s.wall:s.floor)}/>:null;}
export function TilesetPanel({embedded=false}:{embedded?:boolean}){
 const [page,setPage]=useState(0),[source,setSource]=useState(false);
 const saved=useSkin(),[draft,setDraft]=useState<Skin|null>(saved),[notice,setNotice]=useState(''),[target,setTarget]=useState<'floor'|'wall'>('floor'),[loading,setLoading]=useState(false);
 async function upload(file?:File){if(!file)return;setLoading(true);setNotice('');try{
  if(file.type!=='image/png'||file.size>2_000_000)throw Error('Choose a PNG up to 2 MB.');
  const image=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(Error('Could not read the image.'));r.readAsDataURL(file);});
  const img=new Image();img.src=image;await img.decode();
  if(img.width>2048||img.height>2048||img.width<8||img.height<8)throw Error('Sheet dimensions must be between 8 and 2048 pixels.');
  const size=[32,16,8,64,128].find(n=>img.width%n===0&&img.height%n===0&&img.width/n*img.height/n<=1024);if(!size)throw Error('Use a grid of at most 1,024 tiles, each 8, 16, 32, 64, or 128 pixels square.');
  setPage(0);setDraft({version:1,image,name:file.name.slice(0,120),size,width:img.width,height:img.height,floor:0,wall:Math.min(1,img.width/size*img.height/size-1),provenance:''});setNotice('Choose floor and wall tiles, then Apply.');
 }catch(e){setNotice(e instanceof Error?e.message:String(e));}finally{setLoading(false);}}
 const count=draft?draft.width/draft.size*draft.height/draft.size:0,pages=Math.max(1,Math.ceil(count/12)),index=Math.min(page,pages-1);
 const content=<><div className="studio-row"><strong>Tileset studio</strong><button type="button" aria-pressed={source} onClick={()=>setSource(!source)}>{source?'Back to tiles':'Source / NFT'}</button></div>
 {source?<div className="art-source"><p>Art is saved on this browser and used in rooms and dungeons. It does not change geometry or encounters.</p>{draft?<label>Source / NFT reference<input maxLength={240} value={draft.provenance} placeholder="Creator, licence, or chain / contract / token ID" onChange={e=>setDraft({...draft,provenance:e.target.value})}/></label>:<p>Upload a sheet first to attach a reference.</p>}<p>Unverified attribution only; no mint or ownership check. Use art you have permission to use.</p></div>:<>
 <label>PNG · up to 2 MB <input aria-label="Upload tileset PNG" type="file" accept="image/png" disabled={loading} onChange={e=>{void upload(e.target.files?.[0]);e.target.value='';}}/></label>
 {draft&&<><label>Tile size <select value={draft.size} onChange={e=>setDraft({...draft,size:Number(e.target.value),floor:0,wall:0})}>{[8,16,24,32,48,64,128].filter(n=>draft.width%n===0&&draft.height%n===0&&draft.width/n*draft.height/n<=1024).map(n=><option key={n} value={n}>{n} × {n}</option>)}</select></label><div className="builder-tools">{(['floor','wall'] as const).map(t=><button type="button" key={t} aria-pressed={target===t} onClick={()=>setTarget(t)}>Assign {t} · tile {draft[t]+1}</button>)}</div><div className="atlas-picker" aria-label="Tileset tile selection">{Array.from({length:Math.min(12,count-index*12)},(_,n)=>{const i=index*12+n;return <button type="button" className="tile atlas-tile" key={i} style={art(draft,i)} aria-label={`Use tile ${i+1} for ${target}`} aria-pressed={draft[target]===i} onClick={()=>setDraft({...draft,[target]:i})}>{draft.floor===i?'F':''}{draft.wall===i?'W':''}</button>;})}</div><div className="studio-row"><button type="button" disabled={index===0} onClick={()=>setPage(index-1)}>Previous tiles</button><span>{index+1}/{pages}</span><button type="button" disabled={index===pages-1} onClick={()=>setPage(index+1)}>Next tiles</button></div></>}
 </>}
 <div className="studio-row art-actions">{draft&&<button type="button" disabled={loading} onClick={()=>{try{persist(draft);setNotice('Tileset applied and saved.');}catch{setNotice('Storage is full or disabled. Previous tileset kept. Try a smaller image.');}}}>Apply tileset</button>}<button type="button" disabled={loading} onClick={()=>{try{persist(null);setDraft(null);setNotice('Default art restored.');}catch{setNotice('Could not update browser storage.');}}}>Use default art</button></div><p role="status">{loading?'Reading image…':notice||`Active: ${saved?.name??'default art'}`}</p></>;
 return embedded?<section className="tileset-panel embedded-tileset" aria-label="Tileset studio">{content}</section>:<details className="tileset-panel"><summary>Tileset studio</summary>{content}</details>;
}
