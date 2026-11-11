/** Sound-free HUD juice, purely presentational: watches the HUD purse and satchel counts and plays a short
 * animation when they change (coins clink out or in; a parcel flies to the satchel). No component state is read
 * or changed; it only adds temporary classes and decorative elements. Disabled under reduced motion. */
import {spriteUrl} from './sprites';
import {emit} from './Sound';

const num=(el:Element|null)=>{const m=el?.textContent?.match(/-?\d+/);return m?Number(m[0]):null;};

function burst(target:Element,kind:'spend'|'earn'){
 const r=target.getBoundingClientRect();
 for(let i=0;i<5;i++){const c=document.createElement('span');c.className=`juice-coin ${kind}`;c.setAttribute('aria-hidden','true');
  c.style.left=`${r.left+18+Math.random()*12}px`;c.style.top=`${r.top+r.height/2}px`;c.style.setProperty('--dx',`${(Math.random()*2-1)*40}px`);c.style.animationDelay=`${i*45}ms`;c.style.backgroundImage='var(--tx-coin)';
  document.body.appendChild(c);setTimeout(()=>c.remove(),900);}
 target.classList.remove('juice-spend','juice-earn');void (target as HTMLElement).offsetWidth;target.classList.add(kind==='spend'?'juice-spend':'juice-earn');
}
function fly(target:Element){
 const r=target.getBoundingClientRect(),p=document.createElement('span');p.className='juice-parcel';p.setAttribute('aria-hidden','true');
 p.style.backgroundImage=spriteUrl('loot');p.style.left=`${innerWidth/2-18}px`;p.style.top=`${innerHeight/2-18}px`;
 p.style.setProperty('--tx',`${r.left+20-innerWidth/2}px`);p.style.setProperty('--ty',`${r.top+r.height/2-innerHeight/2}px`);
 document.body.appendChild(p);setTimeout(()=>{p.remove();target.classList.remove('juice-catch');void (target as HTMLElement).offsetWidth;target.classList.add('juice-catch');},620);
}

export function installHudJuice(){
 if(typeof document==='undefined'||typeof MutationObserver==='undefined')return;
 const still=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 let purse:number|null=null,goods:number|null=null,lastProfile='';
 const check=()=>{
  const p=document.querySelector('.player-hud .purse'),g=document.querySelector('.player-hud .hud-stock'),who=document.querySelector('.player-hud .character-token')?.textContent??'';
  if(who!==lastProfile){lastProfile=who;purse=num(p);goods=num(g);return;}
  const np=num(p),ng=num(g);
  if(p&&np!==null&&purse!==null&&np!==purse){emit(np<purse?'coin':'coinIn');if(!still)burst(p,np<purse?'spend':'earn');}
  if(g&&ng!==null&&goods!==null&&ng>goods){emit('pickup');if(!still)fly(g);}
  purse=np;goods=ng;
 };
 let queued=false;
 new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;check();});}).observe(document.body,{subtree:true,childList:true,characterData:true});
}
