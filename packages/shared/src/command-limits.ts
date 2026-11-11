import type {Command} from './types';
export const legacyCommandBytes=32768;
export const largePublicationBytes=131072;
/** V9's sixteen-floor schema needs a larger, still bounded command envelope. */
export function commandByteLimit(action:Command['action']):number{return (action.type==='publish'||action.type==='publish_random')&&[9,10,11,12,13].includes(action.terms.rules_version)?largePublicationBytes:legacyCommandBytes;}
export function commandSizeError(id:string,command:Command):string|undefined{const max=commandByteLimit(command.action);return new TextEncoder().encode(JSON.stringify({op_id:id,command})).length>max?`Command too large: limit ${max/1024} KB.`:undefined;}

export function commandGas(action:Command['action']):bigint{return commandByteLimit(action)===largePublicationBytes?300_000_000_000_000n:100_000_000_000_000n;}
