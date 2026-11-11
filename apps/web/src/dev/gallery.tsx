/** Dev-only art gallery (http://127.0.0.1:<port>/gallery.html). Not part of the production build.
 * Renders every sprite plus a fixed dungeon scene through the real Run component, playable locally. */
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import '../game-screen.css';
import '../fixed-windows.css';
import '../saltwake-polish.css';
import '../navigation.css';
import '../style.css';
import '../art/skin.css';
import {Run} from '../Run';
import {WalletOnboarding} from '../WalletOnboarding';
import {Sprite} from '../art/Sprite';
import {spriteMaps,type SpriteName} from '../art/sprites';
import {depthPractice} from '../../../../packages/game/src/draft-generator';
import {actWithMessages} from '../../../../packages/game/src/actions';
import type {RunState} from '../../../../packages/game/src/state';

function scene():RunState{
 const s=depthPractice(7);
 s.roguelike=false;s.roomIndex=0;
 s.room=['#############','#...........#','#...........#','#...#.......#','#...........#','#.......#...#','#...........#','#...........#','#############'];
 if(s.layout?.[0])s.layout=[{...s.layout[0],tiles:s.room} as any,...s.layout.slice(1)];
 s.player={...s.player,x:6,y:4,hp:9};
 const e=(id:string,kind:any,x:number,y:number,hp:number,extra:any={})=>({id,kind,x,y,hp,intent:{x,y},alerted:true,...extra});
 s.enemies=[
  e('rat-1','pursuer',8,4,3,{intent:{x:7,y:4}}),
  e('boar-1','charger',2,2,5,{lane:[{x:3,y:2},{x:4,y:2},{x:5,y:2}]}),
  e('sentry-1','archer',11,2,4,{aim:true,lane:[{x:10,y:2},{x:9,y:2},{x:8,y:2},{x:7,y:2}]}),
  e('crab-1','bomber',5,6,2,{primed:true,lane:[{x:4,y:5},{x:5,y:5},{x:6,y:5},{x:4,y:6},{x:6,y:6},{x:4,y:7},{x:5,y:7},{x:6,y:7}]}),
  e('brute-1','brute',10,6,9),
  e('nest-1','nest',2,7,6),
  e('rat-2','pursuer',3,7,1,{minion:true,stunned:2}),
  e('rat-3','pursuer',11,7,3,{alerted:false}),
 ] as any;
 s.features=[
  {id:'k1',kind:'barrel',damage:4,x:8,y:1},{id:'k2',kind:'barrel',damage:4,x:1,y:5,fuse:1},
  {id:'c1',kind:'crack',hp:2,x:12,y:4},{id:'o1',kind:'oil',x:3,y:4},{id:'o2',kind:'oil',x:3,y:5,burning:2},
  {id:'p1',kind:'pit',x:8,y:7},{id:'f1',kind:'fountain',heal:4,charges:2,x:11,y:4},
  {id:'a1',kind:'altar',boon:'might',cost:3,x:1,y:1},{id:'s1',kind:'cache',supply:'bomb',count:2,x:9,y:5},
 ] as any;
 s.traps=[{id:'t1',x:7,y:3,armed:true},{id:'t2',x:5,y:3,armed:false}] as any;
 const loot=Object.values(s.items).find(i=>i.location.kind==='floor');
 if(loot)loot.location={kind:'floor',room:0,x:2,y:4} as any;
 s.log=['Gallery scene: every enemy, feature and telegraph.'];
 return s;
}

function Gallery(){
 const [s,set]=useState<RunState>(scene);const [lastBlast,setBlast]=useState(false);
 const send=(a:any)=>set(prev=>actWithMessages(prev,a,()=>{}));
 return <main className="saltwake" style={{height:'auto',minHeight:0,overflow:'visible'}}>
  <section className="gallery-sheet" style={{display:'flex',flexWrap:'wrap',gap:8,padding:8}}>
   {(Object.keys(spriteMaps) as SpriteName[]).map(n=><figure key={n} style={{margin:0,width:72,textAlign:'center',fontSize:10}}><div style={{width:64,height:64,margin:'auto',background:'var(--tx-floor-a) center/100% 100%',imageRendering:'pixelated'}}><Sprite name={n} style={{width:64,height:64}}/></div>{n}</figure>)}
   {['--tx-floor-a','--tx-floor-b','--tx-wall','--tx-grass-a','--tx-road-a','--tx-water','--tx-plank-a','--tx-plaster','--tx-slate'].map(v=><figure key={v} style={{margin:0,width:72,textAlign:'center',fontSize:10}}><div style={{width:64,height:64,margin:'auto',background:`var(${v}) center/100% 100%`,imageRendering:'pixelated'}}/>{v}</figure>)}
  </section>
  <div style={{display:'flex',gap:8,padding:8}}><button onClick={()=>set(scene())}>Reset scene</button><button onClick={()=>set(p=>({...p,status:'died',player:{...p.player,hp:0},killedBy:'powder crab #crab-1'} as RunState))}>End run (summary)</button><button onClick={()=>{setBlast(!lastBlast);set(p=>({...p,turn:p.turn+1,blasts:[{x:4,y:5},{x:5,y:5},{x:6,y:5},{x:4,y:6},{x:5,y:6},{x:6,y:6},{x:4,y:7},{x:5,y:7},{x:6,y:7}],player:{...p.player,hp:p.player.hp-3}}));}}>Fake blast</button></div>
  <div className="game-shell" style={{height:760,flex:'none'}}><div className="game-stage"><Run compact remote={{state:s,send,busy:false,title:'Gallery',roomCount:1,terminal:null,settlement:null,canExtract:true}}/></div></div>
 </main>;
}
if(!location.search.includes('arrival')){document.body.style.overflow='auto';document.documentElement.style.height='auto';}
const picker=<div className="wallet-picker"><p>Connect a NEAR <strong>testnet</strong> wallet. No real money: testnet accounts are free.</p><button>MyNearWallet <small>(web)</small></button><button>Meteor Wallet <small>(extension)</small></button><button>Nightly <small>(extension)</small></button><p><small>No testnet account? MyNearWallet creates one for free at testnet.mynearwallet.com.</small></p></div>;
const onboarding=<main className="saltwake"><WalletOnboarding network="testnet" contractId="saltwake-example.testnet" connected={false} authenticated={false} busy={false} connectControls={picker}/></main>;
createRoot(document.getElementById('root')!).render(location.search.includes('arrival')?onboarding:<Gallery/>);
