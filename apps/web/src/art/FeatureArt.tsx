import React from 'react';
import type {FeatureState} from '../../../../packages/game/src/state';
import {Sprite} from './Sprite';
import {tintedSprite,type SpriteName} from './sprites';

const art:Partial<Record<FeatureState['kind'],SpriteName>>={barrel:'keg',crack:'crack',fountain:'fountain',altar:'altar',cache:'cache',plate:'plate'};

/** Dungeon feature drawing for one tile. Oil and chasms are drawn by CSS (skin.css) so they tile cleanly. */
export function FeatureArt({feature,lit,on=false}:{feature:FeatureState;lit:boolean;on?:boolean}){
 if(feature.kind==='key'||feature.kind==='lock')return <span aria-hidden="true" className={`feature-art f-${feature.kind} ${lit?'':'dim'}`}><span className="px-sprite feature-sprite" style={{backgroundImage:tintedSprite(feature.kind==='key'?'key':'lockedDoor',feature.color)}}/></span>;
 const litFuse=feature.kind==='barrel'&&!!feature.fuse,burning=feature.kind==='oil'&&!!feature.burning,name=art[feature.kind];
 return <span aria-hidden="true" className={`feature-art f-${feature.kind} ${lit?'':'dim'} ${litFuse?'lit':''} ${burning?'burning':''} ${on?'on':''}`}>
  {name&&<Sprite name={name} className="feature-sprite"/>}
  {(litFuse||burning)&&<span className="fx-flame"/>}
 </span>;
}
