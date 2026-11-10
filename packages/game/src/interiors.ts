import type {PlaceId,TownPoint} from './town';
export type RoomFixture={id:string;name:string;glyph:string;x:number;y:number};
export type InteriorLayout={tiles:string[];entry:TownPoint;exit:TownPoint;fixtures:RoomFixture[]};
export const roomSize={width:11,height:9};
export const roomEntry={x:5,y:7};
export const roomExit={x:5,y:8};
export function roomFixtures(place:PlaceId,layout?:InteriorLayout):RoomFixture[]{
 if(layout)return layout.fixtures;
 const service:Record<PlaceId,[string,string]>={inn:['Mara · storage & journal','☷'],market:['Merchant · buy & sell','⚖'],workshop:['Ivo · working kettle','♨'],guild:['Steward · dungeon charters','⚑'],gate:['Gatewarden · expeditions','⚔']};
 const [name,glyph]=service[place];return [{id:'service',name,glyph,x:5,y:2},{id:'wallet',name:'Account book · purse & receipts',glyph:'◉',x:8,y:5},{id:'decor-a',name:place==='inn'?'Guest bed':'Stock shelves',glyph:place==='inn'?'▰':'▤',x:2,y:2},{id:'decor-b',name:place==='workshop'?'Ingredient barrels':'Supply chest',glyph:'▣',x:2,y:5}];
}
export function defaultInterior(place:PlaceId):InteriorLayout{
 return {tiles:Array.from({length:9},(_,y)=>Array.from({length:11},(_,x)=>x===roomExit.x&&y===roomExit.y||x>0&&x<10&&y>0&&y<8?'.':'#').join('')),entry:{...roomEntry},exit:{...roomExit},fixtures:roomFixtures(place)};
}
export function roomWalkable(place:PlaceId,p:TownPoint,layout?:InteriorLayout){
 const terrain=layout?layout.tiles[p.y]?.[p.x]==='.':(p.x===roomExit.x&&p.y===roomExit.y||p.x>0&&p.y>0&&p.x<roomSize.width-1&&p.y<roomSize.height-1);
 return Number.isInteger(p.x)&&Number.isInteger(p.y)&&terrain&&!roomFixtures(place,layout).some(f=>f.x===p.x&&f.y===p.y);
}
export function roomPath(place:PlaceId,from:TownPoint,to:TownPoint,layout?:InteriorLayout):TownPoint[]{
 if(!roomWalkable(place,from,layout)||!roomWalkable(place,to,layout))return [];const key=(p:TownPoint)=>`${p.x},${p.y}`;const queue=[from],parents=new Map<string,TownPoint|null>([[key(from),null]]);
 for(const p of queue){if(key(p)===key(to)){const path:TownPoint[]=[];let n:TownPoint|null=p;while(n&&key(n)!==key(from)){path.unshift(n);n=parents.get(key(n))??null;}return path;}for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]){const n={x:p.x+dx,y:p.y+dy};if(roomWalkable(place,n,layout)&&!parents.has(key(n))){parents.set(key(n),p);queue.push(n);}}}return [];
}
export function fixtureApproach(place:PlaceId,from:TownPoint,fixture:RoomFixture,layout?:InteriorLayout){return [[0,1],[-1,0],[1,0],[0,-1]].map(([dx,dy])=>({x:fixture.x+dx,y:fixture.y+dy})).filter(p=>roomWalkable(place,p,layout)).map(p=>({p,path:roomPath(place,from,p,layout)})).filter(v=>v.path.length||v.p.x===from.x&&v.p.y===from.y).sort((a,b)=>a.path.length-b.path.length)[0];}

export function validateInterior(value:unknown):string[]{
 const fail=(message:string)=>[message];
 if(!value||typeof value!=='object')return fail('Room data is missing.');
 const v=value as InteriorLayout;
 if(!Array.isArray(v.tiles)||v.tiles.length!==9||v.tiles.some(row=>typeof row!=='string'||row.length!==11||!/^[.#]+$/.test(row)))return fail('The room must be an 11 × 9 grid of floor and wall tiles.');
 const point=(p:TownPoint)=>p&&Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=0&&p.x<11&&p.y>=0&&p.y<9;
 if(!point(v.entry)||!point(v.exit))return fail('Place an arrival tile and a door within the room.');
 if(v.entry.x<1||v.entry.x>9||v.entry.y<1||v.entry.y>7)return fail('The arrival tile must be inside the house.');
 if(v.exit.y!==8||v.exit.x<1||v.exit.x>9)return fail('Place the door in the south wall.');
 if(!Array.isArray(v.fixtures)||v.fixtures.length>24||v.fixtures.some(f=>!f||!point(f)||typeof f.id!=='string'||!(/^(service|wallet|decor-[\w-]{1,40})$/).test(f.id)||typeof f.name!=='string'||f.name.length>80||typeof f.glyph!=='string'||f.glyph.length>4))return fail('Room furnishings are invalid (maximum 24).');
 if(v.fixtures.filter(f=>f.id==='service').length!==1||v.fixtures.filter(f=>f.id==='wallet').length!==1)return fail('Keep one service station and one account book.');
 if(new Set(v.fixtures.map(f=>f.id)).size!==v.fixtures.length||new Set(v.fixtures.map(f=>`${f.x},${f.y}`)).size!==v.fixtures.length)return fail('Furnishings cannot overlap.');
 for(let y=0;y<9;y++)for(let x=0;x<11;x++)if((x===0||x===10||y===0||y===8)&&!(x===v.exit.x&&y===v.exit.y)&&v.tiles[y][x]!== '#')return fail('Keep the outside walls closed except for the door.');
 if(v.fixtures.some(f=>v.tiles[f.y][f.x]!=='.'||f.x===v.exit.x&&f.y===v.exit.y||f.x===v.entry.x&&f.y===v.entry.y))return fail('Furnishings need their own floor tile, clear of the arrival and door.');
 if(!roomWalkable('inn',v.entry,v)||!roomWalkable('inn',v.exit,v))return fail('Arrival and door must be clear floor tiles.');
 if(!roomPath('inn',v.entry,v.exit,v).length)return fail('The door must be reachable from the arrival tile.');
 for(const f of v.fixtures)if(!fixtureApproach('inn',v.entry,f,v))return fail(`${f.name} cannot be reached.`);
 for(let y=1;y<8;y++)for(let x=1;x<10;x++)if(roomWalkable('inn',{x,y},v)&&!(x===v.entry.x&&y===v.entry.y)&&!roomPath('inn',v.entry,{x,y},v).length)return fail('Every open floor tile must connect to the arrival tile.');
 return [];
}
