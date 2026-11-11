import type {CustomFloor} from '../../shared/src/custom-layout';
/** Top-left anchored resize. Never silently discard authored floor or markers. */
export function resizeFloor(floor:CustomFloor,width:number,height:number):CustomFloor{
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<5||height<5||width>31||height>31)throw Error('Each dimension must be a whole number from 5 to 31.');
 if([floor.spawn,floor.exit,...floor.sockets,...(floor.devices??[]),...(floor.links??[])].some(p=>p.x>=width-1||p.y>=height-1))throw Error('Move arrival, exit, devices and encounters inside the new boundary before shrinking.');
 if(floor.tiles.some((row,y)=>[...row].some((tile,x)=>tile==='.'&&(x>=width-1||y>=height-1))))throw Error('Paint the area being removed as wall before shrinking; existing floor is preserved.');
 return {...structuredClone(floor),tiles:Array.from({length:height},(_,y)=>Array.from({length:width},(_,x)=>x===0||y===0||x===width-1||y===height-1?'#':floor.tiles[y]?.[x]??'#').join(''))};
}
export function floorViewport(width:number,height:number,x:number,y:number){
 const columns=Math.min(13,width),rows=Math.min(9,height);
 return {x:Math.max(0,Math.min(Math.floor(x),width-columns)),y:Math.max(0,Math.min(Math.floor(y),height-rows)),columns,rows};
}

/** Apply a new order by original index; links keep pointing to the same authored floor. */
export function reorderFloors<T extends {floors:CustomFloor[];placements:unknown[]}>(draft:T,order:number[]):void{
 if(order.length!==draft.floors.length||new Set(order).size!==order.length||order.some(i=>!Number.isInteger(i)||i<0||i>=order.length))throw Error('Invalid floor order');
 const old=draft.floors,placements=draft.placements;draft.floors=order.map(i=>old[i]);draft.placements=order.map(i=>placements[i]);
 for(const floor of draft.floors)for(const link of floor.links??[])link.to=order.indexOf(link.to);
}
