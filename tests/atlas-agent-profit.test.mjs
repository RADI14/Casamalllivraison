import {test} from 'node:test';
import assert from 'node:assert/strict';
import {financialReport} from '../app/finance-rules.ts';
import {atlasOrderSnapshot} from '../app/atlas-order-sync.ts';
const team=[{email:'a@test.com',name:'A'},{email:'b@test.com',name:'B'}];
const saved={product:'P',quantity:1,price:999};
function order(id,email,remote,extra={}){const snapshot=atlasOrderSnapshot(saved,remote);return {id,createdEmail:email,createdAt:'2026-10-25T12:00:00Z',status:'sent',tracking:id,atlasState:17,commissionRate:10,payload:JSON.stringify(snapshot.payload),unitCostCents:4000,transportActualCents:snapshot.transportCents,...extra}}
test('Atlas parcel total is counted once, delivery once, purchase cost per unit and commission per parcel',()=>{
 const rows=[order('a','a@test.com',{price:'249.50',quantity:2,cfees:'35.00'})];
 const ads=[{memberEmail:'a@test.com',category:'ads',amountCents:2000,date:'2026-10-25'}];
 const a=financialReport([],rows,ads,team).members[0];
 assert.equal(a.revenue,24950);assert.equal(a.transport,3500);assert.equal(a.goodsCost,8000);assert.equal(a.commission,1000);
 assert.equal(a.afterDelivery,21450);assert.equal(a.netBeforeAds,12450);assert.equal(a.attributedNet,10450);
});
test('without an ad entry show profit BEFORE ads, preserving after-ads incompleteness and member isolation',()=>{
 const rows=[order('a','a@test.com',{price:200,cfees:30}),order('b','b@test.com',{price:160,cfees:25})];
 const report=financialReport([],rows,[{memberEmail:'a@test.com',category:'ads',amountCents:1000,date:'2026-10-25'}],team);
 const b=report.members[1];assert.equal(b.afterDelivery,13500);assert.equal(b.netBeforeAds,8500);assert.equal(b.attributedNet,null);
 assert.equal(report.members[0].attributedNet,11000);
});
test('missing purchase cost keeps net incomplete while sales less known delivery is usable; missing fees prevent both',()=>{
 const withoutPurchase=financialReport([],[order('a','a@test.com',{price:200,cfees:30},{unitCostCents:null})],[],team).members[0];
 assert.equal(withoutPurchase.afterDelivery,17000);assert.equal(withoutPurchase.netBeforeAds,null);
 const withoutFee=financialReport([],[order('a','a@test.com',{price:200})],[],team).members[0];
 assert.equal(withoutFee.afterDelivery,null);assert.equal(withoutFee.netBeforeAds,null);
 const free=financialReport([],[order('a','a@test.com',{price:200,cfees:0})],[],team).members[0];assert.equal(free.afterDelivery,20000);
});
test('all carrier fees in the period, losses and delivery corrections are reflected without duplicating revenue',()=>{
 const rows=[order('a','a@test.com',{price:50,cfees:30}),order('pending','a@test.com',{price:999,cfees:20},{atlasState:12})];
 const a=financialReport([],rows,[],team).members[0];assert.equal(a.afterDelivery,0);assert.equal(a.netBeforeAds,-5000);
 const corrected=financialReport([],[{...rows[0],atlasState:18}],[],team).members[0];assert.equal(corrected.revenue,0);assert.equal(corrected.commission,0);assert.equal(corrected.afterDelivery,-3000);
});
