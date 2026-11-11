import type {Command,Item,RandomTable,Socket} from './types';

// Prefix only the UI value. Authored table IDs remain exact, including prefixes.
export const randomPoolSelection=(tableId:string)=>`random:${tableId}`;
type ReplenishableEdition={id:string;terms:{sockets:readonly Socket[]};randomTables?:readonly RandomTable[]};
export function replenishmentAction(edition:ReplenishableEdition,selection:string,ids:readonly string[],items:readonly Item[],profile:string):Extract<Command['action'],{type:'refresh'}>|null {
 if(!ids.length||ids.length>128||new Set(ids).size!==ids.length)return null;
 const owned=ids.map(id=>items.find(item=>item.id===id&&item.location.kind==='owned'&&item.location.profile===profile));
 if(owned.some(item=>!item))return null;
 if(selection==='fixed'){
  if(!owned.every(item=>edition.terms.sockets.some(socket=>socket.reward===item!.item_type)))return null;
  return {type:'refresh',edition_id:edition.id,fixed_funding:[...ids],random_funding:[]};
 }
 if(!selection.startsWith('random:'))return null;
 const tableId=selection.slice('random:'.length);
 if(!edition.randomTables?.some(table=>table.table_id===tableId))return null;
 return {type:'refresh',edition_id:edition.id,fixed_funding:[],random_funding:[{table_id:tableId,item_ids:[...ids]}]};
}
