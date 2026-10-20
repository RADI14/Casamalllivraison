import {test} from 'node:test';import assert from 'node:assert/strict';
import {orderEditChanges} from '../app/order-edit-rules.ts';
test('edits normalize phones, strip unchanged values and reject unsupported fields',()=>{
 assert.deepEqual(orderEditChanges({phone:'+212 6 12 34 56 78',note:' Same '},{phone:'0612345678',note:'Same'}),{});
 assert.deepEqual(orderEditChanges({phone2:'',price:279,openpackage:false},{price:199,openpackage:true}),{price:279,openpackage:false});
 for(const raw of [null,[],{createdEmail:'forged'},{change:true},{price:'99'},{quantity:1.5},{address:'short'},{openpackage:1},{phone:'0512345678'}])assert.throws(()=>orderEditChanges(raw,{}));
});
test('stock parcels retain their product and reservation quantity',()=>{
 const saved={stockItems:[{stockId:'s',quantity:1}],product:'Press',quantity:1};
 assert.throws(()=>orderEditChanges({quantity:2},saved));assert.throws(()=>orderEditChanges({product:'Other'},saved));
 assert.deepEqual(orderEditChanges({product:'Press',quantity:1,note:'New'},saved),{note:'New'});
 assert.deepEqual(orderEditChanges({product:'Other',quantity:2},{product:'Press',quantity:1}),{product:'Other',quantity:2});
});
