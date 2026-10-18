import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../app/dark-theme.css',import.meta.url),'utf8'),clean=css.replace(/\/\*[\s\S]*?\*\//g,''),palette={};
for(const declaration of clean.match(/\[data-theme=dark\]\{([^}]+)\}/)[1].split(';')){const [key,value]=declaration.split(':').map(s=>s.trim());if(key&&value)palette[key]=value}
function lightness(hex){const rgb=hex.replace('#','').match(/../g).map(h=>parseInt(h,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]}
function contrast(a,b){const x=lightness(a),y=lightness(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
test('dark body text, labels, links and semantic status colors meet normal-text contrast',()=>{for(const bg of ['--surface','--canvas','--dark-panel','--dark-hover'])for(const fg of ['--ink','--muted','--dark-link'])assert.ok(contrast(palette[fg],palette[bg])>=4.5,`${fg} on ${bg}`);for(const name of ['success','warning','danger','purple'])assert.ok(contrast(palette['--dark-'+name],palette['--dark-'+name+'-bg'])>=4.5,name)});
test('dark overrides are scoped to the workspace and load after component styles',()=>{for(const match of clean.matchAll(/([^{}]+)\{/g)){const selector=match[1].trim();if(selector!=='[data-theme=dark]')assert.match(selector,/^\[data-theme=dark\] /)};const layout=readFileSync(new URL('../app/layout.tsx',import.meta.url),'utf8');assert.ok(layout.indexOf("import './dark-theme.css'")>layout.indexOf("import './fastlivraison.css'"));assert.ok(layout.indexOf("import './dark-theme.css'")>layout.indexOf("import './mobile.css'"));assert.doesNotMatch(css,/\.fast-login/)});
