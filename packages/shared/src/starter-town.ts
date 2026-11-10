import type {Command} from './types';
/** Explicit local world setup. Uses existing proprietor stock; never mints goods or coins. */
export function starterTownCommands(now:number):{id:string;command:Command}[]{return [
 {id:'town-first-expedition',command:{actor:'maker',action:{type:'publish',terms:{title:'The smugglers’ hollow',rules_version:2,modules:['cellar','gauntlet'],sockets:[{id:'sword',room:0,slot:0,enemy:'pursuer',trap:false,reward:'sword'},{id:'tonic-a',room:0,slot:1,enemy:'none',trap:false,reward:'tonic'},{id:'tonic-b',room:1,slot:0,enemy:'charger',trap:true,reward:'tonic'}],opens_at_ms:String(now),closes_at_ms:String(now+86400000),no_reward:false,difficulty_tag:'standard',style_tag:'combat',run_duration_ms:'900000',max_runs:4},fee:'2',funding:['maker-sword-0','maker-sword-1','maker-tonic-0','maker-tonic-1','maker-tonic-2','maker-tonic-3']}}},
 {id:'town-tonic-stall',command:{actor:'maker',action:{type:'list',item_ids:['maker-tonic-4','maker-tonic-5'],unit_price:'3'}}},
 {id:'town-fine-stall',command:{actor:'maker',action:{type:'list',item_ids:['maker-fine-tonic-0','maker-fine-tonic-1'],unit_price:'5'}}},
 ];}
