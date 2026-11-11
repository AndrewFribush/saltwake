import React from 'react';
import type {FeatureState} from '../../../../packages/game/src/state';
import {Sprite} from './Sprite';
import type {SpriteName} from './sprites';

const art:Partial<Record<FeatureState['kind'],SpriteName>>={barrel:'keg',crack:'crack',fountain:'fountain',altar:'altar',cache:'cache'};

/** Dungeon feature drawing for one tile. Oil and chasms are drawn by CSS (skin.css) so they tile cleanly. */
export function FeatureArt({feature,lit}:{feature:FeatureState;lit:boolean}){
 const litFuse=feature.kind==='barrel'&&!!feature.fuse,burning=feature.kind==='oil'&&!!feature.burning,name=art[feature.kind];
 return <span aria-hidden="true" className={`feature-art f-${feature.kind} ${lit?'':'dim'} ${litFuse?'lit':''} ${burning?'burning':''}`}>
  {name&&<Sprite name={name} className="feature-sprite"/>}
  {(litFuse||burning)&&<span className="fx-flame"/>}
 </span>;
}
