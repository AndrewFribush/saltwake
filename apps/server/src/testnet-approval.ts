/** Exact-destination checks for running the operator against NEAR testnet.
 * The approval file names the RPC, account and artifact hash, plus a transaction
 * budget and expiry. Bounds are capped for a multi-day public testnet demo. */
export const TESTNET_RPCS=['https://test.rpc.fastnear.com','https://rpc.testnet.near.org'] as const;
export const TESTNET_MAX_TRANSACTIONS=5000;
export const TESTNET_LATEST_EXPIRY=Date.parse('2026-11-25T23:59:59Z');
export type TestnetConfig={rpcUrl:string;accountId:string;epoch:string};
export type TestnetApproval={approvedBy:string;accountId:string;rpcUrl:string;wasmSha256:string;maximumTransactions:number;expiresAt:string;approvalId?:string};
export function checkTestnetApproval(config:TestnetConfig,approval:TestnetApproval,now=Date.now()){
 const fail=(why:string)=>{throw Error('Testnet approval rejected: '+why);};
 if(!(TESTNET_RPCS as readonly string[]).includes(config.rpcUrl))fail('RPC is not an allowed testnet endpoint');
 if(!/^[a-z0-9]+(?:[._-][a-z0-9]+)*\.testnet$/.test(config.accountId)||config.accountId.length>64)fail('account must be a .testnet account');
 if(!config.epoch.startsWith('testnet-'))fail('storage epoch must start with testnet-');
 if(approval.approvedBy!=='Andrew')fail('approvedBy');
 if(approval.accountId!==config.accountId)fail('account differs from config');
 if(approval.rpcUrl!==config.rpcUrl)fail('RPC differs from config');
 if(typeof approval.wasmSha256!=='string'||!/^[a-f0-9]{64}$/.test(approval.wasmSha256))fail('wasmSha256');
 const limit=approval.maximumTransactions;
 if(!Number.isSafeInteger(limit)||limit<1||limit>TESTNET_MAX_TRANSACTIONS)fail(`maximumTransactions must be 1..${TESTNET_MAX_TRANSACTIONS}`);
 const expiresAt=Date.parse(approval.expiresAt);
 if(!Number.isFinite(expiresAt))fail('expiresAt');
 if(expiresAt<=now)fail('approval expired');
 if(expiresAt>TESTNET_LATEST_EXPIRY)fail('expiresAt is later than 2026-11-25T23:59:59Z');
 if(approval.approvalId!==undefined&&!/^[A-Za-z0-9_-]{1,64}$/.test(approval.approvalId))fail('approvalId');
 return {limit,expiresAt,budgetId:config.accountId+':'+(approval.approvalId??approval.expiresAt)};
}
