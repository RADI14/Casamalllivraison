import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allTimePayableOrders} from '../app/monthly-commission-payment.ts';
import {simpleDashboard} from '../app/simple-dashboard-rules.ts';
import {filterCommissionList} from '../app/commission-list-rules.ts';
const row=(id,month,extra={})=>({id,createdEmail:'a@test.com',createdAt:month+'-15T12:00:00Z',status:'sent',tracking:id,atlasState:17,commissionRate:10,commissionDueCents:1000,commissionPaymentStatus:'unpaid',unitCostCents:1000,transportActualCents:3000,payload:JSON.stringify({price:199,quantity:1,atlasDeliveredAt:month+'-16T12:00:00Z'}),...extra});
test('pay action includes earlier months, partial and undated delivered commissions, excluding paid and ineligible parcels',()=>{
 const rows=[row('sep','2026-09'),row('oct','2026-10'),row('nov','2026-11'),row('partial','2026-09',{commissionDueCents:400,commissionPaymentStatus:'partial'}),row('undated','2026-09',{payload:'{}'}),row('paid','2026-09',{commissionDueCents:0}),row('other','2026-09',{createdEmail:'b@test.com'}),row('cancel','2026-09',{status:'cancelled'}),row('returned','2026-09',{atlasState:21})];
 assert.deepEqual(allTimePayableOrders(rows,' A@test.com ').map(o=>o.id),['sep','oct','nov','partial','undated']);
});
test('outstanding list includes unpaid and partially paid parcels from every month',()=>{
 const rows=[row('sep','2026-09'),row('nov','2026-11'),row('partial','2026-10',{commissionDueCents:400,commissionPaymentStatus:'partial'}),row('paid','2026-09',{commissionDueCents:0,commissionPaymentStatus:'paid'})];
 assert.deepEqual(filterCommissionList(rows,{payment:'outstanding',from:'',to:'',query:''}).map(o=>o.id),['sep','nov','partial']);
});
test('dashboard outstanding amount and count stay independent of calendar and drop after payment',()=>{
 const orders=[row('sep','2026-09'),row('oct','2026-10'),row('nov','2026-11'),row('undated','2026-09',{payload:'{"price":199,"quantity":1}'}),row('other','2026-09',{createdEmail:'b@test.com'})];
 const input={team:[{email:'a@test.com',name:'A',active:1},{email:'b@test.com',name:'B',active:1}],orders,products:[],expenses:[],payments:[{id:'p',memberEmail:'a@test.com',amountCents:1400,paidAt:'2026-11-02T12:00:00Z'}],allocations:[]};
 for(const month of ['2026-09','2026-10','2026-11']){
  const result=simpleDashboard(input,month,'2026-11-02'),a=result.members.find(m=>m.email==='a@test.com');
  assert.equal(a.allTimeCommissionDue,2600);assert.equal(a.unpaidCommissionOrders,3);assert.equal(result.allTimeCommissionDue,3600);
 }
 const settled=simpleDashboard({...input,payments:[{...input.payments[0],amountCents:4000}]},'2026-11','2026-11-02');
 const a=settled.members.find(m=>m.email==='a@test.com');assert.equal(a.allTimeCommissionDue,0);assert.equal(a.unpaidCommissionOrders,0);assert.equal(settled.allTimeCommissionDue,1000);
});
