import {test} from 'node:test';
import assert from 'node:assert/strict';
import {operationsPeriod,operationsReport,agentStatement} from '../app/operations-rules.ts';
import {duplicateOrders,duplicatePhone} from '../app/duplicate-order-rules.ts';
import {statementHtml,statementXlsx} from '../server/statement-export.ts';
import {inflateRawSync} from 'node:zlib';
const now=Date.parse('2026-10-25T14:00:00Z');
const order=(id,extra={})=>({id,payload:JSON.stringify({fullname:'Client <script>',phone:'0612345678',product:'Product',quantity:2,price:200,atlasSku:'P',stockItems:[{stockId:'stock',quantity:2}]}),createdAt:'2026-10-25T12:00:00Z',createdEmail:'a@test.com',createdBy:'A',updatedAt:'2026-10-25T12:00:00Z',tracking:id,status:'sent',atlasState:17,atlasStateName:'Livré',unitCostCents:2000,transportActualCents:3000,commissionRate:10,productId:'p',...extra});
const fixture=()=>({team:[{email:'a@test.com',name:'A'},{email:'b@test.com',name:'B'},{email:'removed@test.com',name:'Removed',deletedAt:'yes'}],orders:[order('current'),order('previous',{createdAt:'2026-10-24T12:00:00Z'})],expenses:[],products:[{id:'p',name:'Product'}],payments:[{id:'pay',memberEmail:'a@test.com',amountCents:1000,paidAt:'2026-10-25T13:00:00Z',note:'paid'}],allocations:[{id:'allocation',orderId:'current',paymentId:'pay',amountCents:1000,createdAt:'2026-10-25T13:00:00Z',releasedAt:null}],receipts:[]});
test('equal-length comparison handles inclusive dates and year boundaries',()=>{
 assert.deepEqual(operationsPeriod('2026-01-01','2026-01-07'),{from:'2026-01-01',to:'2026-01-07',previousFrom:'2025-12-25',previousTo:'2025-12-31'});
 const p=operationsPeriod('','','2026-10-25');assert.equal(p.from,'2026-10-19');assert.equal(p.previousTo,'2026-10-18');
 for(const [a,b] of [['2026-02-30','2026-03-02'],['2026-10-25','2026-10-24']])assert.throws(()=>operationsPeriod(a,b));
});
test('alerts isolate missing data, omit removed agents and compare product and agent metrics',()=>{
 const f=fixture();f.orders[0].unitCostCents=null;f.orders.push(order('pending',{atlasState:12,transportActualCents:null}));
 const r=operationsReport(f,'2026-10-25','2026-10-25');assert.equal(r.alerts.missingPurchase.count,1);assert.equal(r.alerts.missingDelivery.count,1);assert.equal(r.alerts.missingAds[0].email,'a@test.com');
 assert.equal(r.comparison.current.orders,2);assert.equal(r.comparison.previous.orders,1);assert.equal(r.comparison.current.net,null);assert.equal(r.comparison.previous.revenue,20000);assert.equal(r.comparison.products[0].current.delivered,1);assert.ok(!r.members.some(m=>m.email==='removed@test.com'));
 f.expenses.push({id:'ad',category:'ads',date:'2026-10-25',memberEmail:'a@test.com',amountCents:0});assert.equal(operationsReport(f,'2026-10-25','2026-10-25').alerts.missingAds.length,0);
});
test('statement applies global ledger before period; records payments by payment date and expenses once',()=>{
 const f=fixture();f.expenses.push({id:'ad',category:'ads',date:'2026-10-25',memberEmail:'a@test.com',amountCents:1000,channel:'Meta',note:'test'});
 const s=agentStatement(f,'A@TEST.COM','2026-10-25','2026-10-25');assert.equal(s.rows.length,1);assert.equal(s.allocatedPaidCents,1000);assert.equal(s.dueCents,0);assert.equal(s.payments.length,1);assert.equal(s.summary.attributedNet,11000);assert.equal(s.expenses.length,1);
 const old=agentStatement(f,'a@test.com','2026-10-24','2026-10-24');assert.equal(old.dueCents,1000);assert.equal(old.payments.length,0);assert.equal(agentStatement(f,'unknown'),null);
});
test('receipt ledger excludes voids, includes all-time fees and flags unknown fees and over-receipts',()=>{
 const f=fixture();f.receipts=[{amount_cents:5000,voided_at:null},{amount_cents:99999,voided_at:'void'}];f.orders.push(order('cancelled',{status:'cancelled',transportActualCents:1000}));
 let r=operationsReport(f,'2026-10-25','2026-10-25').carrier;assert.equal(r.deliveredSales,40000);assert.equal(r.fees,7000);assert.equal(r.reconciliation,28000);
 f.receipts.push({amount_cents:40000,voided_at:null});assert.equal(operationsReport(f).carrier.reconciliation,-12000);
 f.orders.push(order('unknownfee',{transportActualCents:null}));r=operationsReport(f).carrier;assert.equal(r.reconciliation,null);assert.equal(r.missingFees,1);
});
test('duplicate warning normalizes phones, uses stock identity, excludes old and cancelled orders',()=>{
 const c={phone:'+212 612345678',stockId:'stock',sku:'P',product:'Product'},records=[order('one'),order('cancel',{status:'cancelled'}),order('old',{createdAt:'2026-10-01T12:00:00Z'}),order('other',{payload:JSON.stringify({phone:'0612345678',product:'Different',stockItems:[{stockId:'other'}]})})];
 assert.equal(duplicatePhone('00212 612345678'),'0612345678');assert.deepEqual(duplicateOrders(records,c,now).map(o=>o.id),['one']);assert.equal(duplicateOrders(records,{...c,phone:'0699999999'},now).length,0);
});
test('Excel is a ZIP workbook with numeric amounts and text-only user cells; print escapes HTML',()=>{
 const f=fixture();f.team[0].name='=FORMULA <script>';const s=agentStatement(f,'a@test.com'),bytes=statementXlsx(s),entries={};let pos=0;
 while(bytes.readUInt32LE(pos)===0x04034b50){const size=bytes.readUInt32LE(pos+18),n=bytes.readUInt16LE(pos+26),extra=bytes.readUInt16LE(pos+28),name=bytes.subarray(pos+30,pos+30+n).toString(),start=pos+30+n+extra;entries[name]=inflateRawSync(bytes.subarray(start,start+size)).toString();pos=start+size}
 assert.ok(entries['xl/workbook.xml'].includes('Synthèse'));assert.equal(Object.keys(entries).length,8);assert.ok(entries['xl/worksheets/sheet1.xml'].includes('=FORMULA &lt;script&gt;'));assert.ok(!Object.values(entries).some(s=>s.includes('<f>')));assert.ok(entries['xl/worksheets/sheet2.xml'].includes('<v>200</v>'));
 const html=statementHtml(s);assert.ok(!html.includes('Client <script>'));assert.ok(html.includes('Client &lt;script&gt;'));assert.ok(html.includes('window.print()'));
});
