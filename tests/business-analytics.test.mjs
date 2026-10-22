import {test} from 'node:test';
import assert from 'node:assert/strict';
import {businessAnalytics} from '../app/business-analytics.ts';
import {financialReport} from '../app/finance-rules.ts';
const order=(overrides={})=>({id:'o',createdAt:'2026-10-01T12:00:00Z',createdEmail:'a@example.com',status:'sent',tracking:'AT1',atlasState:17,commissionRate:10,productId:'p',payload:JSON.stringify({quantity:2,price:179}),unitCostCents:3000,transportActualCents:2500,transportEstimateCents:null,transportOverrideCents:null,...overrides});
const expense=(overrides={})=>({date:'2026-10-02',amountCents:4500,category:'ads',costType:'variable',...overrides});
test('timeline reconciles with finance totals and fills empty days, including expense-only dates',()=>{
 const orders=[order(),order({id:'b',createdAt:'2026-10-03T12:00:00Z',atlasState:12})],expenses=[expense(),expense({date:'2026-10-04',category:'other',amountCents:900})];
 const a=businessAnalytics(orders,expenses,'2026-10-01','2026-10-05'),f=financialReport([],orders,expenses,[],'2026-10-01','2026-10-05').total;
 assert.equal(a.timeline.length,5);for(const [key,field] of [['revenue','revenue'],['costs','totalCosts'],['net','net']])assert.equal(a.timeline.reduce((n,r)=>n+r[key],0),f[field]);
 assert.equal(a.timeline[1].orders,0);assert.equal(a.timeline[1].net,-4500);assert.equal(a.timeline[4].net,0);assert.equal(a.totalOrders,2);assert.equal(a.statuses.delivered,1);assert.equal(a.statuses.otherTransmitted,1);
});
test('incomplete fees and purchase costs leave gaps rather than fabricated zero profit',()=>{
 const a=businessAnalytics([order({transportActualCents:null}),order({createdAt:'2026-10-02T12:00:00Z',unitCostCents:null})],[],'2026-10-01','2026-10-03');
 assert.equal(a.timeline[0].net,null);assert.equal(a.timeline[0].costs,null);assert.equal(a.timeline[1].net,null);assert.equal(a.timeline[1].revenue,17900);assert.equal(a.timeline[2].net,0);
});
test('status distribution is exhaustive and excludes cancelled deliveries from delivered totals',()=>{
 const a=businessAnalytics([order(),order({status:'cancelled'}),order({status:'error',tracking:null}),order({status:'draft',tracking:null}),order({status:'sent',tracking:null}),order({atlasState:null})],[]);
 assert.deepEqual(a.statuses,{delivered:1,otherTransmitted:1,drafts:1,errors:1,cancelled:1,other:1});assert.equal(Object.values(a.statuses).reduce((a,b)=>a+b,0),a.totalOrders);assert.equal(a.timeline[0].delivered,1);
});
test('Morocco cohort dates, date bounds and monthly rollup preserve all money',()=>{
 const orders=[order({createdAt:'2026-09-30T23:30:00Z'}),order({createdAt:'2026-10-31T12:00:00Z'})];
 assert.equal(businessAnalytics(orders,[],'2026-10-01','2026-10-01').totalOrders,1);
 const a=businessAnalytics(orders,[expense()],'2026-01-31','2026-12-31');assert.equal(a.granularity,'month');assert.equal(a.timeline.length,12);assert.equal(a.timeline.reduce((n,r)=>n+r.orders,0),2);assert.equal(a.timeline.reduce((n,r)=>n+r.net,0),financialReport([],orders,[expense()],[]).total.net);
});
test('empty periods produce no invented orders or expenses',()=>{const a=businessAnalytics([],[],'2026-10-01','2026-10-03');assert.equal(a.totalOrders,0);assert.equal(a.timeline.length,3);assert.ok(a.timeline.every(r=>r.orders===0&&r.revenue===0&&r.net===0))});
