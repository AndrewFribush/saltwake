import {defineConfig} from 'vite';
import {testSignerPlugin} from './test-signer-plugin';
// SALTWAKE_API_PORT points the dev proxy at a non-default API (e.g. the testnet server on 18941).
export default defineConfig({plugins:[testSignerPlugin()],server:{proxy:{'/api':'http://127.0.0.1:'+(process.env.SALTWAKE_API_PORT??'18931')}}});
