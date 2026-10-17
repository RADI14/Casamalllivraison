import {spawnSync} from 'node:child_process';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {migrationConfig} from './cloudflare-database.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),cli=fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js',import.meta.url));
const list=spawnSync(process.execPath,[cli,'d1','list','--json'],{cwd:root,encoding:'utf8',env:process.env});
if(list.status!==0){console.error('Unable to list D1 databases. Check the Cloudflare build token has D1 Edit permission.');process.exit(list.status??1)}
const config=migrationConfig(JSON.parse(readFileSync(new URL('../wrangler.json',import.meta.url),'utf8')),JSON.parse(list.stdout),fileURLToPath(new URL('../drizzle',import.meta.url)));
const temp=mkdtempSync(join(tmpdir(),'casamall-d1-'));try{const path=join(temp,'wrangler.json');writeFileSync(path,JSON.stringify(config));const r=spawnSync(process.execPath,[cli,'d1','migrations','apply','DB','--remote','--config',path],{cwd:root,stdio:'inherit',env:{...process.env,CI:'true'}});if(r.error)throw r.error;process.exitCode=r.status??1}finally{rmSync(temp,{recursive:true,force:true})}
