import React from 'react';
import {HeroSvg,useMoving,type Facing} from './art/Sprite';

/** One character drawing shared by the town, house interiors and dungeon tiles (pixel art in art/sprites.ts). */
/** Pass `at` (the grid position) to animate a two-frame walk while it changes. */
export function CharacterSprite({x,y,width='100%',height='100%',facing='down',at,look}:{x?:number;y?:number;width?:number|string;height?:number|string;facing?:Facing;at?:{x:number;y:number};look?:number}){
 const walking=useMoving(at?.x,at?.y);
 return <HeroSvg facing={facing} x={x} y={y} width={width} height={height} walking={walking} look={look}/>;
}
