import {test} from 'node:test';
import assert from 'node:assert/strict';
import {monthlyPayableOrders} from '../app/monthly-commission-payment.ts';
const row=(id,extra={})=>({id,createdEmail:'ib@test.com',createdAt:'2026-09-01T00:00:00Z',status:'sent',tracking:id,atlasState:17,commissionDueCents:1000,payload:{atlasDeliveredAt:'2026-10-15T12:00:00Z'},...extra});
test('monthly payout uses actual Morocco delivery month and only remaining commissions for the chosen agent',()=>{
 const rows=[row('old-entry'),row('partial',{commissionDueCents:400}),row('paid',{commissionDueCents:0}),row('other-agent',{createdEmail:'other@test.com'}),row('cancelled',{status:'cancelled'}),row('returned',{atlasState:21}),row('undated',{payload:{}}),row('previous',{payload:{atlasDeliveredAt:'2026-09-15T12:00:00Z'}}),row('month-start',{payload:{atlasDeliveredAt:'2026-10-01T12:00:00Z'}})];
 const payable=monthlyPayableOrders(rows,' IB@test.com ','2026-10');assert.deepEqual(payable.map(r=>r.id),['old-entry','partial','month-start']);assert.equal(payable.reduce((n,r)=>n+r.commissionDueCents,0),2400);
 assert.deepEqual(monthlyPayableOrders(rows,'none@test.com','2026-10'),[]);assert.throws(()=>monthlyPayableOrders(rows,'ib@test.com','2026-13'));
});
