import type {ExitRule} from '../../shared/src/exit-rules';
import {doorOpen,type Device} from '../../shared/src/mechanisms';
import type {FloorLink} from '../../shared/src/custom-layout';
import {weaponDamage} from '../../shared/src/equipment';
import type {RunItem} from './inventory';
import type {Feature,Tide,SupplyKind,EnemyKind} from '../../shared/src/depth-components';
/** Runtime state of an authored feature. `spent` marks a used, burnt, broken or emptied feature. */
export type FeatureState=Feature&{fuse?:number;burning?:number;spent?:boolean};
export type Point={x:number;y:number};
export type Enemy=Point & {id:string;hp:number;damage?:number;alertRadius?:number;intent:Point;kind?:EnemyKind;alerted?:boolean;lane?:Point[];recovering?:boolean;stunned?:number;primed?:boolean;resting?:boolean;aim?:boolean;timer?:number;spawned?:number;minion?:boolean;hatch?:Point};
export type RoomLayout={features?:Feature[];tide?:Tide;exitRule?:ExitRule;devices?:Device[];links?:FloorLink[];id:string;title:string;tiles:string[];spawn:Point;exit:Point;enemies:Enemy[];traps:(Point & {id:string;armed:boolean;period?:number;activeTurns?:number;phase?:number;damage?:number})[]};
export type RunState={keys?:string[];killedBy?:string;depth?:boolean;features?:FeatureState[];tide?:Tide;tideTurns?:number;supplies?:Partial<Record<SupplyKind,number>>;buffs?:{might?:number;ward?:number};blasts?:Point[];exitRule?:ExitRule;devices?:Device[];signals?:Record<string,boolean>;roomMemory?:Record<number,{enemies:Enemy[];traps:RoomLayout['traps'];features?:FeatureState[];tiles?:string[];tideTurns?:number}>;connections?:FloorLink[];floorTurn?:number;incomingDanger?:Point[];rulesVersion?:4;roguelike?:boolean;expeditionSeed?:number;explored?:string[];boon?:'edge'|'rest';layout?:RoomLayout[];room:string[];roomIndex:number;items:Record<string,RunItem>;originalTownIds:string[];reservedItemIds:string[];player:Point & {hp:number;weapon:'unarmed'|'club'|'sword';armor:boolean};enemies:Enemy[];traps:(Point & {id:string;armed:boolean;period?:number;activeTurns?:number;phase?:number;damage?:number})[];turn:number;status:'active'|'died'|'extracted';log:string[]};
export function createRun():RunState {return {roomIndex:0,items:{'town-club':{id:'town-club',type:'club',origin:'town',location:{kind:'weapon'}}},originalTownIds:['town-club'],reservedItemIds:[],room:['#########','#.......#','#..##...#','#.......#','#....#..#','#.......#','#########'],player:{x:1,y:1,hp:12,weapon:'club',armor:false},enemies:[],traps:[],turn:0,status:'active',log:['Explore the cellar. Walls do not spend a turn.']};}
export function walkable(s:RunState,p:Point){return Number.isInteger(p.x)&&Number.isInteger(p.y)&&s.room[p.y]?.[p.x]==='.'&&!(s.devices??[]).some(d=>d.x===p.x&&d.y===p.y&&!doorOpen(d,s.signals))&&!(s.features??[]).some(f=>!f.spent&&f.x===p.x&&f.y===p.y&&(f.kind==='barrel'||f.kind==='pit'||f.kind==='lock'));}
/** Sight passes over chasms but not walls, closed doors or kegs. */
export function seeThrough(s:RunState,p:Point){return Number.isInteger(p.x)&&Number.isInteger(p.y)&&s.room[p.y]?.[p.x]==='.'&&!(s.devices??[]).some(d=>d.x===p.x&&d.y===p.y&&!doorOpen(d,s.signals))&&!(s.features??[]).some(f=>!f.spent&&f.x===p.x&&f.y===p.y&&(f.kind==='barrel'||f.kind==='lock'));}
export const featureAt=(s:RunState,p:Point,kind?:Feature['kind'])=>(s.features??[]).find(f=>!f.spent&&f.x===p.x&&f.y===p.y&&(kind===undefined||f.kind===kind));
export function distance(a:Point,b:Point){return Math.abs(a.x-b.x)+Math.abs(a.y-b.y);}

export function attackDamage(s:RunState):number{return weaponDamage[s.player.weapon]+(s.boon==='edge'?1:0)+(s.buffs?.might??0);}
