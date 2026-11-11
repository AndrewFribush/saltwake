import React from 'react';
import {HeroSvg,type Facing} from './art/Sprite';

/** One character drawing shared by the town, house interiors and dungeon tiles (pixel art in art/sprites.ts). */
export function CharacterSprite({x,y,width='100%',height='100%',facing='down'}:{x?:number;y?:number;width?:number|string;height?:number|string;facing?:Facing}){
 return <HeroSvg facing={facing} x={x} y={y} width={width} height={height}/>;
}
