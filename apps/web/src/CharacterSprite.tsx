import React from 'react';

/** One character drawing shared by the town, house interiors and dungeon tiles. */
export function CharacterSprite({x,y,width='100%',height='100%'}:{x?:number;y?:number;width?:number|string;height?:number|string}){
 return <svg className="character-sprite" aria-hidden="true" focusable="false" x={x} y={y} width={width} height={height} viewBox="-22 -22 44 46" style={{display:'block',pointerEvents:'none'}}><ellipse cy="14" rx="13" ry="6" fill="#17271d" opacity=".7"/><path d="M-7-4-12 14Q0 20 12 14L7-4" fill="#c4aa66" stroke="#382d22" strokeWidth="2"/><path d="M-7 14-5 20m12-6-2 6" stroke="#292b29" strokeWidth="4"/><circle cy="-9" r="7" fill="#d4ad7b"/><path d="M-8-10q8-15 16 0" fill="#5e4334"/><path d="m10 4 10 8" stroke="#d5d4b6" strokeWidth="3"/></svg>;
}
