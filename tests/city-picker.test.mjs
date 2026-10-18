import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {orderPrice} from '../app/order-price.ts';
const require=createRequire(import.meta.url);
function harness(){
 const states=[];let cursor=0;
 const module={exports:{}};
 const js=ts.transpileModule(readFileSync(new URL('../app/order-form.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 vm.runInNewContext(js,{module,exports:module.exports,require:id=>id==='react'?{...React,useState:initial=>{const i=cursor++;if(!(i in states))states[i]=initial;return [states[i],v=>{states[i]=typeof v==='function'?v(states[i]):v}];}}:id==='./i18n'?{useI18n:()=>({t:s=>s})}:id==='./order-price'?{orderPrice}:id==='./whatsapp-order'?{parseWhatsAppOrder:()=>({})}:id==='./stock-picker'?{__esModule:true,default:()=>null}:require(id)});
 const value={fullname:'Client',phone:'0612345678',phone2:'',address:'Rue des Fleurs',price:199,product:'Press',quantity:1,cityId:'',cityName:'',note:''};
 const props={value,atlas:{configured:true,cities:[{id:'kenitra-id',name:'Kénitra'},{id:'rabat-id',name:'Rabat'}],stores:[],stockReady:true},catalog:[],onChange:next=>{props.value=next},onSubmit:()=>{},onRefresh:()=>{},onClose:()=>{}};
 function find(node,predicate){if(!node)return;if(Array.isArray(node)){for(const child of node){const found=find(child,predicate);if(found)return found}}else if(typeof node==='object'){if(predicate(node))return node;return find(node.props?.children,predicate)}}
 const render=()=>{cursor=0;return module.exports.default(props)};
 const get=id=>find(render(),el=>el.props?.id===id);
 return {get,props};
}
for(const pointerType of ['mouse','touch','pen'])test(`city selection survives ${pointerType} pointer focus changes before click`,()=>{
 const h=harness();h.get('order-city').props.onFocus();h.get('order-city').props.onChange({target:{value:'ken'}});
 let prevented=false;const option=h.get('city-option-0');
 option.props.onPointerDown?.({pointerType,preventDefault(){prevented=true}});
 // A browser moves focus before click unless pointerdown's default is cancelled.
 if(!prevented)h.get('order-city').props.onBlur({currentTarget:{parentElement:{contains:()=>false}},relatedTarget:null});
 assert.ok(h.get('city-option-0'),'the option must remain mounted until click');
 h.get('city-option-0').props.onClick();
 assert.equal(h.props.value.cityId,'kenitra-id');assert.equal(h.props.value.cityName,'Kénitra');assert.equal(h.get('order-city').props.value,'Kénitra');assert.equal(h.get('atlas-city-options'),undefined);
 assert.equal(h.props.value.price,199);assert.equal(h.props.value.address,'Rue des Fleurs');assert.equal(h.props.value.product,'Press');
});
test('city keyboard selection and leaving the city field still work',()=>{const h=harness();h.get('order-city').props.onFocus();h.get('order-city').props.onChange({target:{value:'Rabat'}});let prevented=false;h.get('order-city').props.onKeyDown({key:'Enter',preventDefault(){prevented=true}});assert.ok(prevented);assert.equal(h.props.value.cityId,'rabat-id');h.get('order-city').props.onFocus();assert.ok(h.get('atlas-city-options'));h.get('order-city').props.onBlur({currentTarget:{parentElement:{contains:()=>false}},relatedTarget:null});assert.equal(h.get('atlas-city-options'),undefined)});
