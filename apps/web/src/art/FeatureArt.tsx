import React from 'react';
import type {FeatureState} from '../../../../packages/game/src/state';
import {Sprite} from './Sprite';
import {tintedSprite,type SpriteName} from './sprites';
import {clockOn} from '../../../../packages/shared/src/depth-components';
import {TurnClock} from './RunFx';

const art:Partial<Record<FeatureState['kind'],SpriteName>>={barrel:'keg',crack:'crack',fountain:'fountain',altar:'altar',cache:'cache',plate:'plate',clock:'hourglass'};

/** Dungeon feature drawing for one tile. Oil and chasms are drawn by CSS (skin.css) so they tile cleanly. */
export function FeatureArt({feature,lit,on=false,turn}:{feature:FeatureState;lit:boolean;on?:boolean;turn?:number}){
 if(feature.kind==='clock'){const f=feature;const t=turn??0,now=clockOn(f,t);let n=1;while(n<f.period&&clockOn(f,t+n)===now)n++;const phase=now?f.on:f.period-f.on;
  return <span aria-hidden="true" className={`feature-art f-clock ${lit?'':'dim'} ${now?'on':'off'}`}><Sprite name="hourglass" className="feature-sprite"/>{lit&&turn!==undefined&&<TurnClock className="gate-clock" left={n} total={phase} label={`${now?'On':'Off'}; flips in ${n}`}/>}</span>;}
 if(feature.kind==='key'||feature.kind==='lock')return <span aria-hidden="true" className={`feature-art f-${feature.kind} ${lit?'':'dim'}`}><span className="px-sprite feature-sprite" style={{backgroundImage:tintedSprite(feature.kind==='key'?'key':'lockedDoor',feature.color)}}/></span>;
 const litFuse=lit&&feature.kind==='barrel'&&!!feature.fuse,burning=lit&&feature.kind==='oil'&&!!feature.burning,name=art[feature.kind];
 return <span aria-hidden="true" className={`feature-art f-${feature.kind} ${lit?'':'dim'} ${litFuse?'lit':''} ${burning?'burning':''} ${on&&lit?'on':''}`}>
  {name&&<Sprite name={name} className="feature-sprite"/>}
  {(litFuse||burning)&&<span className="fx-flame"/>}
 </span>;
}
