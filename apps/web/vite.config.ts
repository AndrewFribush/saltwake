import {defineConfig} from 'vite';
// SALTWAKE_API_PORT runs a second local copy (e.g. web 18950 -> API 18951). The API only accepts its own
// host/origin or 18930, so this dev proxy presents requests as same-origin to that API port.
const apiPort=process.env.SALTWAKE_API_PORT;
const api=apiPort?{target:'http://127.0.0.1:'+apiPort,changeOrigin:true,configure:(proxy:any)=>proxy.on('proxyReq',(req:any)=>{if(req.getHeader('origin'))req.setHeader('origin','http://127.0.0.1:'+apiPort);})}:'http://127.0.0.1:18931';
export default defineConfig({server:{proxy:{'/api':api}}});
