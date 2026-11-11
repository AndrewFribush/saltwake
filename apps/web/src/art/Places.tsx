/** Town and interior art helpers: SVG patterns for the town map and furniture sprites for rooms. */
import React from 'react';
import {Sprite} from './Sprite';
import {textureVars,keeperUrl,type SpriteName} from './sprites';

const href=(v:string)=>textureVars[v].slice(5,-2);

/** <defs> with tile patterns for the town SVG (one 40px tile each). Use fill="url(#sw-grass-a)" etc. */
export function TownPatterns({cell}:{cell:number}){
 const still=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 const tile=(id:string,v:string)=><pattern key={id} id={id} width={cell} height={cell} patternUnits="userSpaceOnUse"><image href={href(v)} width={cell} height={cell} preserveAspectRatio="none" style={{imageRendering:'pixelated'}}/></pattern>;
 return <defs>
  {tile('sw-grass-a','--tx-grass-a')}{tile('sw-grass-b','--tx-grass-b')}
  {tile('sw-road-a','--tx-road-a')}{tile('sw-road-b','--tx-road-b')}
  <pattern id="sw-water" width={cell} height={cell} patternUnits="userSpaceOnUse"><image href={href('--tx-water')} width={cell} height={cell} preserveAspectRatio="none" style={{imageRendering:'pixelated'}}/>{!still&&<animateTransform attributeName="patternTransform" type="translate" from="0 0" to={`${cell} 0`} dur="7s" repeatCount="indefinite"/>}</pattern>{tile('sw-wall','--tx-wall')}
  {tile('sw-shingle','--tx-shingle')}{tile('sw-timber','--tx-timber')}{tile('sw-slate','--tx-slate')}
 </defs>;
}

/** Sprite for a placed room fixture; unknown furniture falls back to its text glyph. */
export function fixtureSprite(f:{id:string;name:string;glyph:string}):SpriteName|null{
 const n=f.name.toLowerCase();
 if(f.id==='wallet'||n.includes('account book'))return 'book';
 if(n.includes('bed'))return 'bed';if(n.includes('shel'))return 'shelves';if(n.includes('barrel'))return 'barrels';if(n.includes('chest'))return 'chest';
 const byGlyph:Record<string,SpriteName>={'☷':'counter','⚖':'scales','♨':'kettle','⚑':'banner','⚔':'swords','▰':'bed','▤':'shelves','▣':'chest'};
 return byGlyph[f.glyph]??(f.id==='service'?'counter':null);
}
export function FixtureArt({fixture}:{fixture:{id:string;name:string;glyph:string}}){
 const s=fixtureSprite(fixture);
 return <>{fixture.id==='service'&&<span aria-hidden="true" className="px-sprite fixture-keeper" style={{backgroundImage:keeperUrl}}/>}{s?<Sprite name={s} className={`fixture-sprite ${fixture.id==='service'?'with-keeper':''}`}/>:<span className="fixture-glyph">{fixture.glyph}</span>}</>;
}
export function DoorArt(){return <Sprite name="door" className="fixture-sprite door-sprite"/>;}
