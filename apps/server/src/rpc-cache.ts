/** Testnet read cache. Public RPCs rate-limit hard (JSON-RPC -429), and every web client poll asks for a
 * reconcile pass. Serve the latest value while it is younger than maxAgeMs, refresh it in the background once it
 * is older than refreshAfterMs, and share one in-flight read, so polls never stack RPC reads. */
export function cachedRead<T>(read:()=>Promise<T>,maxAgeMs:number,refreshAfterMs:number,now=Date.now){
 let latest:{at:number;value:T}|undefined,inflight:Promise<T>|undefined;
 const refresh=()=>inflight??=read().then(value=>{latest={at:now(),value};return value;}).finally(()=>{inflight=undefined;});
 return async():Promise<T>=>{
  const age=latest?now()-latest.at:Infinity;
  if(age<maxAgeMs){if(age>refreshAfterMs)void refresh().catch(()=>{});return latest!.value;}
  return refresh();
 };
}
