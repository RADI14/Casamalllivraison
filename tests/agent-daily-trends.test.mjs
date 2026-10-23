import {test} from 'node:test';
import assert from 'node:assert/strict';
import {agentDailyTrends} from '../app/agent-daily-trends.ts';
const team=[{email:'a@test.com',name:'Amal',active:1},{email:'b@test.com',name:'Basma',active:1}];
function order(id,date,email='a@test.com',extra={}){return {id,createdAt:date,createdEmail:email,payload:JSON.stringify({price:100,quantity:1}),status:'sent',tracking:id,atlasState:17,commissionRate:10,unitCostCents:2000,transportActualCents:1000,...extra}}
test('ten Morocco calendar days include the end date, zero days, separate agents and current delivery state',()=>{
 const orders=[order('a1','2026-10-14T10:00:00Z'),order('a2','2026-10-22T23:30:00Z',' A@TEST.COM '),order('b1','2026-10-20T10:00:00Z','b@test.com'),order('cancel','2026-10-20T10:00:00Z','a@test.com',{status:'cancelled'}),order('before','2026-10-13T10:00:00Z'),order('after','2026-10-24T10:00:00Z')];
 const result=agentDailyTrends(team,orders,[],'2026-10-23'),[a,b]=result.members;
 assert.equal(result.start,'2026-10-14');assert.equal(result.end,'2026-10-23');assert.equal(a.points.length,10);assert.equal(a.points[0].orders,1);assert.equal(a.points[1].orders,0);assert.equal(a.points[9].orders,1);assert.equal(a.points[9].revenue,10000);assert.equal(a.totals.orders,3);assert.equal(a.totals.delivered,2);assert.equal(b.totals.orders,1);assert.equal(b.totals.revenue,10000);assert.equal(a.points[6].orders,1);assert.equal(a.points[6].revenue,0);
});
test('daily profit preserves missing costs and unassigned advertising, and accounts for expense-only days',()=>{
 const orders=[order('a1','2026-10-23T10:00:00Z'),order('b1','2026-10-23T10:00:00Z','b@test.com',{unitCostCents:null})];
 const expenses=[{date:'2026-10-23',memberEmail:'a@test.com',amountCents:500,category:'ads'},{date:'2026-10-23',memberEmail:'b@test.com',amountCents:500,category:'ads'},{date:'2026-10-22',memberEmail:'a@test.com',amountCents:300,category:'ads'},{date:'2026-10-23',amountCents:99999,category:'other'}];
 const [a,b]=agentDailyTrends(team,orders,expenses,'2026-10-23').members;
 assert.equal(a.points[9].net,5500);assert.equal(a.points[8].net,-300);assert.equal(a.totals.net,5200);assert.equal(a.points[7].net,null);assert.equal(b.points[9].net,null);assert.equal(b.totals.net,null);assert.equal(agentDailyTrends(team,orders,[],'2026-10-23').members[0].totals.net,null);
});
