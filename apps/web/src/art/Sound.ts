/** Optional sound for Saltwake, synthesised with the Web Audio API: no audio files, no external assets.
 * Off by default. A speaker toggle and volume slider are added to the top bar (remembered per browser).
 * Game code never calls this directly: art components emit `saltwake:sfx` events, and a few HUD/DOM
 * observers cover the rest. Nothing here reads or changes game state. */

export type Sfx='step'|'coin'|'coinIn'|'bubble'|'door'|'hit'|'hurt'|'blast'|'death'|'tide'|'slam'|'pickup'|'open';
const KEY='saltwake.sound';
type Settings={on:boolean;vol:number};
function load():Settings{try{const s=JSON.parse(localStorage.getItem(KEY)??'null');if(s&&typeof s.on==='boolean'&&typeof s.vol==='number')return {on:s.on,vol:Math.min(1,Math.max(0,s.vol))};}catch{}return {on:false,vol:.5};}
let settings:Settings=typeof localStorage!=='undefined'?load():{on:false,vol:.5};
function save(){try{localStorage.setItem(KEY,JSON.stringify(settings));}catch{}}

/** Art components call this; it is a no-op unless the player turned sound on. */
export function emit(name:Sfx){if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('saltwake:sfx',{detail:name}));}

let ctx:AudioContext|null=null,master:GainNode|null=null,noiseBuf:AudioBuffer|null=null,ambient:{stop:()=>void}|null=null;
function audio(){
 if(!settings.on)return null;
 if(!ctx){const AC=(window as any).AudioContext??(window as any).webkitAudioContext;if(!AC)return null;ctx=new AC() as AudioContext;master=ctx.createGain();master.connect(ctx.destination);
  noiseBuf=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}
 if(ctx.state==='suspended')void ctx.resume();
 master!.gain.value=settings.vol*.6;return ctx;
}
const env=(g:GainNode,t:number,a:number,peak:number,d:number)=>{g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+a);g.gain.exponentialRampToValueAtTime(.0001,t+a+d);};
function tone(type:OscillatorType,f0:number,f1:number,dur:number,peak:number,delay=0){const c=audio();if(!c)return;const t=c.currentTime+delay,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);env(g,t,.005,peak,dur);o.connect(g).connect(master!);o.start(t);o.stop(t+dur+.05);}
function noise(dur:number,peak:number,filter:BiquadFilterType,f0:number,f1=f0,q=1,delay=0){const c=audio();if(!c)return;const t=c.currentTime+delay,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=noiseBuf;f.type=filter;f.Q.value=q;f.frequency.setValueAtTime(f0,t);f.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);env(g,t,.004,peak,dur);s.connect(f).connect(g).connect(master!);s.start(t,Math.random());s.stop(t+dur+.05);}

let stepAlt=false,lastStep=0;
const play:Record<Sfx,()=>void>={
 step:()=>{const n=performance.now();if(n-lastStep<110)return;lastStep=n;stepAlt=!stepAlt;noise(.05,.18,'lowpass',stepAlt?520:420,200,1.2);},
 coin:()=>{tone('triangle',1850,1800,.12,.18);tone('triangle',2480,2400,.18,.14,.06);},
 coinIn:()=>{tone('triangle',2480,2400,.1,.14);tone('triangle',1850,1800,.16,.16,.07);tone('sine',3300,3200,.12,.06,.12);},
 bubble:()=>{const f=180+Math.random()*160;tone('sine',f,f*2.6,.09,.12);},
 door:()=>{const c=audio();if(!c)return;const t=c.currentTime,o=c.createOscillator(),f=c.createBiquadFilter(),g=c.createGain();o.type='sawtooth';o.frequency.setValueAtTime(140,t);o.frequency.linearRampToValueAtTime(210,t+.18);o.frequency.linearRampToValueAtTime(120,t+.38);f.type='bandpass';f.frequency.value=900;f.Q.value=6;env(g,t,.03,.07,.4);o.connect(f).connect(g).connect(master!);o.start(t);o.stop(t+.5);noise(.06,.12,'lowpass',300,120,1,.38);},
 hit:()=>{tone('sine',150,55,.12,.35);noise(.03,.15,'highpass',1800,1200);},
 hurt:()=>{tone('square',110,60,.16,.12);tone('sine',90,40,.2,.35);},
 blast:()=>{noise(.7,.5,'lowpass',2200,80,.7);tone('sine',70,30,.6,.5);},
 death:()=>{tone('triangle',420,140,.35,.12);noise(.25,.12,'bandpass',900,300,2,.05);},
 tide:()=>{noise(1.4,.22,'lowpass',160,60,.8);tone('sine',48,40,1.3,.18);},
 slam:()=>{tone('sine',90,40,.25,.45);noise(.18,.3,'lowpass',900,120,1);},
 pickup:()=>{tone('square',880,880,.05,.06);tone('square',1320,1320,.08,.06,.05);},
 open:()=>{tone('sine',220,330,.6,.12);tone('sine',330,495,.8,.08,.15);},
};

function startAmbient(){
 const c=audio();if(!c||ambient)return;
 if(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches)return; // keep it to event sounds only
 const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain(),lfo=c.createOscillator(),lg=c.createGain();
 s.buffer=noiseBuf;s.loop=true;f.type='lowpass';f.frequency.value=480;g.gain.value=.05;lfo.frequency.value=.09;lg.gain.value=.04;lfo.connect(lg).connect(g.gain);
 s.connect(f).connect(g).connect(master!);s.start();lfo.start();
 let gull=0;const chirp=()=>{if(!document.querySelector('.town-world')||document.hidden)return;const f0=1700+Math.random()*500;tone('sine',f0,f0*.7,.18,.035);tone('sine',f0*.95,f0*.68,.22,.03,.24);};
 const loop=()=>{gull=window.setTimeout(()=>{chirp();loop();},6000+Math.random()*9000);};loop();
 const duck=window.setInterval(()=>{const inTown=!!document.querySelector('.town-world')&&!document.querySelector('.expedition');g.gain.setTargetAtTime(inTown?.05:.012,c.currentTime,.6);},1000);
 ambient={stop:()=>{try{s.stop();lfo.stop();}catch{}clearTimeout(gull);clearInterval(duck);ambient=null;}};
}

function watchKettle(){
 // Bubble while a brewing scene or the practice track is on screen.
 setInterval(()=>{if(!settings.on)return;const brewing=document.querySelector('.alchemy-scene,section[aria-label="Alchemy crafting practice"]');if(brewing&&!document.hidden&&Math.random()<.7)play.bubble();},420);
}

function controls(){
 const hud=document.querySelector('.game-shell>.player-hud');if(!hud||hud.querySelector('.sound-ctl'))return;
 const wrap=document.createElement('div');wrap.className='sound-ctl';
 const btn=document.createElement('button');btn.type='button';btn.className='sound-toggle';
 const range=document.createElement('input');range.type='range';range.min='0';range.max='100';range.setAttribute('aria-label','Sound volume');range.className='sound-volume';
 const sync=()=>{btn.setAttribute('aria-pressed',String(settings.on));btn.setAttribute('aria-label',settings.on?'Sound on (click to mute)':'Sound off (click to turn on)');btn.title=btn.getAttribute('aria-label')!;btn.textContent=settings.on?'🔊':'🔈';range.value=String(Math.round(settings.vol*100));range.hidden=!settings.on;};
 btn.onclick=()=>{settings.on=!settings.on;save();sync();if(settings.on){audio();startAmbient();play.coin();}else{ambient?.stop();void ctx?.suspend();}};
 range.oninput=()=>{settings.vol=Number(range.value)/100;save();if(master&&ctx)master.gain.setTargetAtTime(settings.vol*.6,ctx.currentTime,.05);};
 range.onchange=()=>play.coin();
 sync();wrap.append(btn,range);
 const help=Array.from(hud.querySelectorAll('button')).find(b=>b.textContent==='Help');
 if(help&&help.parentElement===hud)hud.insertBefore(wrap,help);else hud.appendChild(wrap);
}

export function installSound(){
 if(typeof window==='undefined')return;
 window.addEventListener('saltwake:sfx',e=>{if(!settings.on)return;const n=(e as CustomEvent).detail as Sfx;play[n]?.();});
 // Browsers allow audio only after a gesture: the toggle click starts it; later gestures resume a suspended context.
 window.addEventListener('pointerdown',()=>{if(settings.on){audio();startAmbient();}},{passive:true});
 window.addEventListener('keydown',()=>{if(settings.on){audio();startAmbient();}});
 let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;controls();});}).observe(document.body,{childList:true,subtree:true});
 watchKettle();
 // Footsteps: the player sprites' positions change (town avatar transform, room hero and dungeon hero left/top).
 let lastSeen=0;new MutationObserver(ms=>{if(!settings.on)return;for(const m of ms){const t=m.target as Element;if(t.classList?.contains('town-avatar')||t.classList?.contains('room-hero')||t.classList?.contains('hero-actor')){const n=performance.now();if(n-lastSeen>60){lastSeen=n;play.step();}break;}}}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['style']});
}
