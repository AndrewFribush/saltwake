import {existsSync,statSync} from 'node:fs';
import {extname,resolve,sep} from 'node:path';

/** Hosted mode. The server normally binds to loopback and serves only /api; the Vite dev server fronts it. When
 * hosted (one container behind a TLS proxy), the same process serves the built web from `webDir` on the same origin,
 * so cookies stay first-party and the wallet's NEP-413 origin binding is the public https origin. Testnet only. */

/** A public web origin: https, a host name that is not loopback, no path. Returns the reason when it is not. */
export function publicOriginProblem(origin:string):string|undefined{
 let u:URL;try{u=new URL(origin);}catch{return 'not a URL';}
 if(u.origin!==origin)return 'must be a bare origin (scheme://host[:port], no path)';
 if(u.protocol!=='https:')return 'must be https';
 if(['127.0.0.1','localhost','0.0.0.0','::1','[::1]'].includes(u.hostname)||u.hostname.endsWith('.localhost'))return 'must not be a loopback host';
 return undefined;
}
export const isLocalOrigin=(origin:string)=>{try{const u=new URL(origin);return u.origin===origin&&u.protocol==='http:'&&u.hostname==='127.0.0.1';}catch{return false;}};

const types:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav','.webmanifest':'application/manifest+json','.txt':'text/plain; charset=utf-8','.map':'application/json'};

/** Resolves a GET path to a file under `webDir`: the file itself, or `index.html` for app routes (single-page app).
 * Never leaves `webDir`; `/api/...` is not a file. Returns undefined when there is nothing to serve. */
export function staticFile(webDir:string,pathname:string):{path:string;type:string;cache:string}|undefined{
 if(pathname.startsWith('/api/')||pathname.includes('\0'))return undefined;
 const root=resolve(webDir);let decoded:string;try{decoded=decodeURIComponent(pathname);}catch{return undefined;}
 const candidate=resolve(root,'.'+decoded);
 if(candidate!==root&&!candidate.startsWith(root+sep))return undefined;
 const file=existsSync(candidate)&&statSync(candidate).isFile()?candidate:extname(decoded)?undefined:resolve(root,'index.html');
 if(!file||!existsSync(file))return undefined;
 const ext=extname(file).toLowerCase();
 // Vite names bundled assets by content hash, so they can be cached for good; the HTML shell must not be.
 const cache=file.startsWith(resolve(root,'assets')+sep)?'public, max-age=31536000, immutable':'no-cache';
 return {path:file,type:types[ext]??'application/octet-stream',cache};
}
