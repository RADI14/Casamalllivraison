import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import vm from 'node:vm';import ts from 'typescript';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {circleProgress} from '../app/dashboard-chart-rules.ts';
import * as rangeRules from '../app/date-range-rules.ts';
const require=createRequire(import.meta.url);
function component(file,hooks){const module={exports:{}};const js=ts.transpileModule(readFileSync(new URL('../app/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;vm.runInNewContext(js,{module,exports:module.exports,require:id=>id==='react'&&hooks?hooks:id.endsWith('.css')?{}:id==='./i18n'?{useI18n:()=>({t:s=>s,language:'fr',money:n=>n+' DH',locale:'fr-MA'})}:id==='./team-statistics'?{moroccoDay:()=> '2026-10-20'}:id==='./date-range-rules'?rangeRules:id==='./dashboard-chart-rules'?{circleProgress}:require(id)});return module.exports.default;}
const Cards=component('agent-performance-cards.tsx'),Picker=component('dashboard-period-picker.tsx');
const member={email:'a@test.com',name:'Ibtissam',active:1,orders:4,transmitted:4,delivered:2,commission:20,deliveryRate:50,confirmation:{todayOrders:99,allTimeOrders:1000,confirmed:3,confirmationRate:75},business:{adsEntries:1,ads:1000,revenue:20000,totalCosts:17000,goodsCost:10000,transport:4000,overheads:0,missingCost:0,missingTransport:0,attributedNet:3000,costPerDelivered:500,estimatedTransport:0}};
const props={members:[member],loading:false,onOpen:()=>{},onTeam:()=>{},periodControls:React.createElement(Picker,{preset:'day',from:'2026-10-19',to:'2026-10-19',onPreset:()=>{},onDates:()=>{}})};
test('the requested cards contain the calendar trigger and period revenue, costs and profit alongside literal today/all-time counts',()=>{const html=renderToStaticMarkup(React.createElement(Cards,props));assert.match(html,/Confirmateurs WhatsApp/);assert.match(html,/aria-haspopup="dialog"/);assert.match(html,/19 oct/);for(const [value,label] of [['4','SAISIES · PÉRIODE'],['200 DH','CA LIVRÉ · PÉRIODE'],['170 DH','CHARGES · PÉRIODE'],['30 DH','BÉNÉFICE'],['99','AUJOURD’HUI'],[new Intl.NumberFormat('fr-MA').format(1000),'DEPUIS LE DÉBUT']])assert.ok(html.includes('<strong>'+value+'</strong><small>'+label+'</small>'),label);assert.match(html,/Détail des charges/);});
test('loading cards hide previous-period amounts',()=>{const html=renderToStaticMarkup(React.createElement(Cards,{...props,loading:true}));assert.match(html,/aria-busy="true"/);assert.doesNotMatch(html,/>200 DH<|>170 DH<|>30 DH</);});
function nodes(node){if(Array.isArray(node))return node.flatMap(nodes);if(!node||typeof node!=='object'||!node.props)return [];return [node,...nodes(node.props.children)]}
function text(node){if(Array.isArray(node))return node.map(text).join('');if(node==null)return '';return typeof node==='object'?text(node.props?.children):String(node)}
test('calendar presets and manual ranges wait for Apply; clear, single day, reversed range and month navigation work',()=>{
 const states=[];let cursor=0;const hooks={useState:initial=>{const i=cursor++;if(!(i in states))states[i]=initial;return [states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value}]},useRef:()=>({current:null}),useId:()=> 'calendar-test',useEffect:()=>{}};
 const InteractivePicker=component('dashboard-period-picker.tsx',hooks),calls=[];let tree;
 const render=()=>{cursor=0;tree=InteractivePicker({preset:'30',from:'2026-09-21',to:'2026-10-20',onPreset:key=>calls.push(key),onDates:(a,b,day)=>calls.push([a,b,day])});return tree};
 const click=predicate=>{const node=nodes(tree).find(n=>n.type==='button'&&predicate(n));assert.ok(node,'button exists');node.props.onClick();render()};
 const open=()=>click(n=>n.props['aria-haspopup']==='dialog');
 render();open();assert.ok(nodes(tree).some(n=>n.props.role==='dialog'));
 click(n=>text(n)==='7 derniers jours');assert.equal(calls.length,0);
 click(n=>text(n)==='Appliquer');assert.deepEqual(calls,['7']);assert.ok(!nodes(tree).some(n=>n.props.role==='dialog'));
 open();click(n=>n.props['aria-label']==='Mois suivant');assert.ok(nodes(tree).some(n=>n.props['data-date']==='2026-11-01'));
 click(n=>n.props['aria-label']==='Mois précédent');click(n=>n.props['data-date']==='2026-10-09');click(n=>n.props['data-date']==='2026-10-04');assert.equal(calls.length,1);
 click(n=>text(n)==='Appliquer');assert.deepEqual(calls[1],['2026-10-04','2026-10-09',false]);
 open();click(n=>n.props['data-date']==='2026-10-12');click(n=>text(n)==='Appliquer');assert.deepEqual(calls[2],['2026-10-12','2026-10-12',true]);
 open();click(n=>text(n)==='Effacer');assert.equal(calls.length,3);click(n=>text(n)==='Appliquer');assert.equal(calls[3],'all');
});
test('calendar ranges are inclusive, weeks start Monday, and month/leap-year boundaries remain correct',()=>{
 assert.deepEqual(rangeRules.rangePreset('30','2026-10-20'),{from:'2026-09-21',to:'2026-10-20'});
 assert.deepEqual(rangeRules.rangePreset('3months','2026-10-20'),{from:'2026-07-21',to:'2026-10-20'});
 assert.deepEqual(rangeRules.rangePreset('month','2026-10-20'),{from:'2026-10-01',to:'2026-10-20'});
 assert.deepEqual(rangeRules.rangePreset('all','2026-10-20'),{from:'',to:''});
 assert.deepEqual(rangeRules.monthDays('2026-10').slice(0,4),[null,null,null,'2026-10-01']);
 assert.equal(rangeRules.monthDays('2028-02').filter(Boolean).length,29);
 assert.equal(rangeRules.shiftMonth('2026-12',1),'2027-01');
 assert.equal(rangeRules.shiftDay('2026-01-01',-1),'2025-12-31');
});
