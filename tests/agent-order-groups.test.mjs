import {test} from 'node:test';import assert from 'node:assert/strict';
import {agentOrderGroups} from '../app/agent-order-groups.ts';
const row=(id,email='a@test.com',more={})=>({id,createdEmail:email,tracking:'AT-'+id,status:'sent',atlasState:17,commissionDueCents:1000,commissionPaymentStatus:'unpaid',...more});
test('groups keep every agent and isolate payable orders including partial balances',()=>{
 const groups=agentOrderGroups([{email:'a@test.com',name:'A'},{email:'b@test.com',name:'B'},{email:'c@test.com',name:'C'}],[row('a',' A@Test.com '),row('part','a@test.com',{commissionDueCents:500,commissionPaymentStatus:'partial'}),row('paid','a@test.com',{commissionDueCents:0,commissionPaymentStatus:'paid'}),row('b','b@test.com'),row('cancel','a@test.com',{status:'cancelled'}),row('draft','a@test.com',{tracking:null}),row('waiting','a@test.com',{atlasState:12})]);
 assert.equal(groups[0].dueCents,1500);assert.equal(groups[0].paid,1);assert.equal(groups[0].unpaid,2);assert.deepEqual(groups[0].batch.map(o=>o.id),['a','part']);assert.equal(groups[1].batchCents,1000);assert.equal(groups[2].orders,0);assert.equal(groups[2].dueCents,0);assert.deepEqual(groups[2].batch,[]);
});
test('bulk action caps explicit order selection at 500 without losing the full outstanding balance',()=>{const [g]=agentOrderGroups([{email:'a@test.com',name:'A'}],Array.from({length:501},(_,i)=>row(String(i))));assert.equal(g.unpaid,501);assert.equal(g.batch.length,500);assert.equal(g.batchCents,500000);assert.equal(g.dueCents,501000)});
