export type Point={x:number;y:number};
export type Enemy=Point & {id:string;hp:number;intent:Point};
export type RunState={room:string[];player:Point & {hp:number;weapon:'club'|'sword';armor:boolean};enemies:Enemy[];turn:number;status:'active'|'died'|'extracted';log:string[]};
export function createRun():RunState {return {room:['#########','#.......#','#..##...#','#.......#','#....#..#','#.......#','#########'],player:{x:1,y:1,hp:12,weapon:'club',armor:false},enemies:[],turn:0,status:'active',log:['Explore the cellar. Walls do not spend a turn.']};}
export function walkable(s:RunState,p:Point){return Number.isInteger(p.x)&&Number.isInteger(p.y)&&s.room[p.y]?.[p.x]==='.';}
export function distance(a:Point,b:Point){return Math.abs(a.x-b.x)+Math.abs(a.y-b.y);}
