import {neighbor,type DistrictId} from '../../../packages/game/src/town-districts';
/** Ground under a town tile, as drawn by the town map. Shared so the shop-site picker shows the same streets. */
export function townTerrain(district:DistrictId,tx:number,ty:number):'wall'|'water'|'road'|'grass'{
 const boundaryWall=tx===0&&!neighbor(district,-1,0)||tx===23&&!neighbor(district,1,0)||ty===0&&!neighbor(district,0,-1)||ty===15&&!neighbor(district,0,1);
 if(boundaryWall)return 'wall';
 if(district==='center'&&tx<3&&ty!==8)return 'water';
 return ty===5||ty===8||ty===13||tx===8||tx===12||tx===13||tx===20?'road':'grass';
}
