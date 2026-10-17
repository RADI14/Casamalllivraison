import {test} from 'node:test';
import assert from 'node:assert/strict';
import {teamStatistics,moroccoDay,validDay} from '../app/team-statistics.ts';
const team=[{email:'a@example.com',name:'Amina',active:1},{email:'b@example.com',name:'Basma',active:0},{email:'c@example.com',name:'Chayma',active:1}];
const order=(changes={})=>({createdEmail:'a@example.com',createdAt:'2026-10-16T10:00:00Z',status:'sent',tracking:'ATL1',atlasState:17,commissionRate:10,syncedAt:'2026-10-16T12:00:00Z',...changes});
test('all subaccounts appear, suspended included, with zero rows and no invented percentage',()=>{
 const d=teamStatistics(team,[]);assert.equal(d.members.length,3);assert.equal(d.totalMembers,3);assert.equal(d.activeMembers,2);assert.equal(d.totals.orders,0);assert.equal(d.totals.deliveryRate,null);assert.ok(d.members.every(m=>m.orders===0&&m.commission===0));
});
test('aggregates and delivery rates use transmissions as denominator and preserve suspended results',()=>{
 const d=teamStatistics(team,[order(),order({tracking:'ATL2',atlasState:1}),order({status:'draft',tracking:null,atlasState:null}),order({createdEmail:'b@example.com',tracking:'ATL3'}),order({status:'error',tracking:null,atlasState:null}),order({tracking:'ATL4',atlasState:null})]);
 assert.deepEqual(d.totals,{orders:6,transmitted:4,drafts:1,delivered:2,errors:1,unsynced:1,commission:20,deliveryRate:50});
 const a=d.members.find(m=>m.email==='a@example.com');assert.equal(a.orders,5);assert.equal(a.commission,10);assert.equal(a.deliveryRate,100/3);assert.equal(d.members.find(m=>m.email==='b@example.com').commission,10);
});
test('administrator and unassigned legacy orders are excluded; aliases normalize',()=>{
 const d=teamStatistics(team,[order({createdEmail:'owner@example.com',commissionRate:0}),order({createdEmail:null}),order({createdEmail:'A@EXAMPLE.COM'})]);assert.equal(d.totals.orders,1);assert.equal(d.excludedOrders,2);assert.equal(d.totals.commission,10);
});
test('date filter uses Morocco creation day, inclusively, rather than sync date',()=>{
 const timestamp='2026-10-15T23:30:00Z';assert.equal(moroccoDay(timestamp),'2026-10-16');
 const d=teamStatistics(team,[order({createdAt:timestamp}),order({createdAt:'2026-10-16T23:30:00Z'}),order({createdAt:'2026-10-15T12:00:00Z'})],'2026-10-16','2026-10-16');assert.equal(d.totals.orders,1);assert.equal(d.totals.commission,10);
});
test('invalid calendar dates are rejected',()=>{
 for(const v of ['2026-02-30','2026-13-01','2026-2-01','abc','2026-01-01extra'])assert.equal(validDay(v),false);
 assert.equal(validDay('2026-10-16'),true);
});
test('repeated calculation does not accrue commissions; changed Atlas status recalculates',()=>{
 const rows=[order()];assert.equal(teamStatistics(team,rows).totals.commission,10);assert.equal(teamStatistics(team,rows).totals.commission,10);rows[0].atlasState=18;assert.equal(teamStatistics(team,rows).totals.commission,0);
});
