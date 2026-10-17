import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
for(const args of [[fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js',import.meta.url)),'deploy','--config','wrangler.json'],[fileURLToPath(new URL('./migrate-cloudflare.mjs',import.meta.url))]]){const r=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit',env:process.env});if(r.error)throw r.error;if(r.status!==0)process.exit(r.status??1)}
