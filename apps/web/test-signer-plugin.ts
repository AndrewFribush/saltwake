/** Dev-only stand-in for a browser wallet, used to drive the real UI end to end in an
 * automated browser where wallet popups need a human. Active only when the dev server
 * is started with SALTWAKE_TEST_SIGNER=<key json> and SALTWAKE_TEST_SIGNER_CONTRACT=<contract>
 * (or the equivalent .state/dev-test-signer.json).
 * The key stays in this Node process; the browser only receives signatures and tx hashes.
 * Testnet RPC only, zero-deposit calls to the one configured contract only. */
import type {Plugin} from 'vite';
import {existsSync,readFileSync} from 'node:fs';
import type {IncomingMessage,ServerResponse} from 'node:http';
export function testSignerPlugin():Plugin|null{
 // Or a git-ignored .state/dev-test-signer.json {"keyPath","contractId"} (read at dev-server start).
 const file=existsSync('.state/dev-test-signer.json')?JSON.parse(readFileSync('.state/dev-test-signer.json','utf8')):{};
 const keyPath=process.env.SALTWAKE_TEST_SIGNER??file.keyPath,contractId=process.env.SALTWAKE_TEST_SIGNER_CONTRACT??file.contractId;
 if(!keyPath||!contractId)return null;
 const key=JSON.parse(readFileSync(keyPath,'utf8')) as {accountId:string;privateKey:string};
 if(!key.accountId.endsWith('.testnet')||!contractId.endsWith('.testnet'))throw Error('Test signer is testnet-only');
 const body=async(req:IncomingMessage)=>{let s='';for await(const c of req)s+=c;if(s.length>65536)throw Error('too large');return JSON.parse(s);};
 return {name:'saltwake-test-signer',apply:'serve',configureServer(server){
  server.middlewares.use('/__test-signer',async(req:IncomingMessage,res:ServerResponse)=>{
   const reply=(status:number,value:unknown)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));};
   try{
    const {Account,JsonRpcProvider,KeyPair,KeyPairSigner,actions}=await import('near-api-js');
    const provider=new JsonRpcProvider({url:'https://test.rpc.fastnear.com'});
    if(req.method==='GET'&&req.url==='/account')return reply(200,{accountId:key.accountId,network:'testnet',contractId});
    if(req.method!=='POST'||req.headers.origin!==`http://${req.headers.host}`)return reply(403,{error:'same-origin POST required'});
    const input=await body(req);
    if(req.url==='/sign-message'){
     if(input.recipient!==contractId)return reply(400,{error:'recipient must be the game contract'});
     const proof=await new KeyPairSigner(KeyPair.fromString(key.privateKey as any)).signNep413Message(key.accountId,{message:input.message,recipient:input.recipient,nonce:Buffer.from(input.nonce,'base64')});
     return reply(200,{accountId:key.accountId,publicKey:proof.publicKey.toString(),signature:Buffer.from(proof.signature).toString('base64')});
    }
    if(req.url==='/send'){
     if(input.receiverId!==contractId||input.deposit!=='0'||!['register_player','execute_player'].includes(input.methodName))return reply(400,{error:'only zero-deposit game calls are signed'});
     // Public RPC rate limits: retrying is safe because game calls are idempotent per request id.
     let out:any;for(let attempt=0;;attempt++){try{out=await new Account(key.accountId,provider,key.privateKey as any).signAndSendTransaction({receiverId:contractId,actions:[actions.functionCall(input.methodName,input.args,BigInt(input.gas),0n)],waitUntil:'FINAL'});break;}catch(e){if(attempt>=5||!/429|Rate limit/i.test(String((e as Error).message)))throw e;await new Promise(r=>setTimeout(r,500*2**attempt));}}
     console.log('[test-signer]',input.methodName,input.args?.action?.type??'',out.transaction.hash);
     return reply(200,{hash:out.transaction.hash});
    }
    reply(404,{error:'not found'});
   }catch(e){reply(500,{error:(e as Error).message});}
  });
 }};
}
