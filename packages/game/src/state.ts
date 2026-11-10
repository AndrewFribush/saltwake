import type {RunItem} from './inventory';
export type Point={x:number;y:number};
export type Enemy=Point & {id:string;hp:number;intent:Point;kind?:'pursuer'|'charger';lane?:Point[];recovering?:boolean};
export type RunState={room:string[];roomIndex:number;items:Record<string,RunItem>;originalTownIds:string[];reservedItemIds:string[];player:Point & {hp:number;weapon:'club'|'sword';armor:boolean};enemies:Enemy[];traps:(Point & {id:string;armed:boolean})[];turn:number;status:'active'|'died'|'extracted';log:string[]};
export function createRun():RunState {return {roomIndex:0,items:{'town-club':{id:'town-club',type:'club',origin:'town',location:{kind:'weapon'}}},originalTownIds:['town-club'],reservedItemIds:[],room:['#########','#.......#','#..##...#','#.......#','#....#..#','#.......#','#########'],player:{x:1,y:1,hp:12,weapon:'club',armor:false},enemies:[],traps:[],turn:0,status:'active',log:['Explore the cellar. Walls do not spend a turn.']};}
export function walkable(s:RunState,p:Point){return Number.isInteger(p.x)&&Number.isInteger(p.y)&&s.room[p.y]?.[p.x]==='.';}
export function distance(a:Point,b:Point){return Math.abs(a.x-b.x)+Math.abs(a.y-b.y);}
