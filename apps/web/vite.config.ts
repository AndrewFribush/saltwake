import {defineConfig} from 'vite';
import {resolve} from 'node:path';
// Watch ignores are anchored to this checkout, so a worktree under .claude/worktrees still hot-reloads its own files
// while the main checkout ignores the worktrees beneath it.
import {testSignerPlugin} from './test-signer-plugin';
// SALTWAKE_API_PORT points the dev proxy at a non-default API (e.g. the testnet server, or a second local copy).
// SALTWAKE_PROXY_ORIGIN (optional) rewrites the Origin header the API sees. Use it only for a second local copy
// opened on another host name (e.g. localhost vs 127.0.0.1 for two cookie sessions); set it to the API's --web-origin.
const apiTarget='http://127.0.0.1:'+(process.env.SALTWAKE_API_PORT??'18931'),presented=process.env.SALTWAKE_PROXY_ORIGIN;
const api=presented?{target:apiTarget,changeOrigin:true,configure:(proxy:any)=>proxy.on('proxyReq',(req:any)=>{if(req.getHeader('origin'))req.setHeader('origin',presented);})}:apiTarget;
export default defineConfig({plugins:[testSignerPlugin()],server:{proxy:{'/api':api},watch:{ignored:['.claude','.state','docs'].map(d=>resolve(process.cwd(),d)+'/**')}}});
