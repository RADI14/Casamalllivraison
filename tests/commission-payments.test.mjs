import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {commissionBalances,recordCommissionPaymentSQL} from '../app/commission-payments.ts';
const team=[{email:'a@test.com',name:'A',active:0},{email:'b@test.com',name:'B',active:1}];
const delivered={createdEmail:'a@test.com',tracking:'AT1',atlasState:17,commissionRate:10,status:'sent'};
test('leads include all entries; commissions only count qualifying deliveries once',()=>{
 const orders=[{...delivered,createdEmail:' A@Test.com ',quantity:5},{...delivered,status:'draft',tracking:null},{...delivered,status:'cancelled'},{...delivered,atlasState:18},{...delivered,commissionRate:0},{...delivered,createdEmail:'owner@test.com'}];
 const {members,totals}=commissionBalances(team,orders,[]);
 assert.equal(members[0].leads,5);assert.equal(members[0].delivered,1);assert.equal(totals.earnedCents,1000);assert.equal(totals.dueCents,1000);assert.equal(members[1].leads,0);
});
test('paid reduces outstanding while preserving earned and subsequent delivery adds ten',()=>{
 const orders=[delivered,{...delivered,tracking:'AT2'}],payments=[{memberEmail:'a@test.com',amountCents:2000}];
 const before=commissionBalances(team,orders,[]).totals,after=commissionBalances(team,orders,payments).totals;
 assert.equal(before.dueCents,2000);assert.equal(after.dueCents,0);assert.equal(after.earnedCents,2000);assert.equal(after.paidCents,2000);
 assert.equal(commissionBalances(team,[...orders,delivered],payments).totals.dueCents,1000);
});
test('Atlas corrections retain payment credit without reducing another member’s unpaid balance',()=>{
 const payments=[{memberEmail:'a@test.com',amountCents:2000}];
 const {members,totals}=commissionBalances(team,[delivered,{...delivered,createdEmail:'b@test.com'}],payments);
 assert.equal(members[0].advanceCents,1000);assert.equal(members[0].dueCents,0);assert.equal(totals.dueCents,1000);assert.equal(totals.advanceCents,1000);
});
function database(){const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE members(email TEXT PRIMARY KEY); CREATE TABLE orders(created_email TEXT,tracking TEXT,atlas_state INTEGER,commission_rate INTEGER,status TEXT);');db.exec(readFileSync(new URL('../drizzle/0005_stale_vance_astro.sql',import.meta.url),'utf8'));db.exec("INSERT INTO members VALUES('a@test.com'); INSERT INTO orders VALUES(' A@Test.com ','AT1',17,10,'sent'),('a@test.com','AT2',17,10,'sent'),('a@test.com','AT3',17,10,'cancelled'),('a@test.com','AT4',17,0,'sent');");return db}
function pay(db,id,amount,email='a@test.com'){return Number(db.prepare(recordCommissionPaymentSQL).run(id,amount,'2026-10-16T00:00:00Z','owner@test.com','External payment',email,amount).changes)}
test('atomic ledger blocks retries, distinct duplicate IDs and stale balances without clearing earnings',()=>{
 const db=database();assert.equal(pay(db,'payment-1',2000),1);assert.equal(pay(db,'payment-1',2000),0);assert.equal(pay(db,'payment-2',2000),0);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM commission_payments').get().n,1);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM orders').get().n,4);
 db.exec("INSERT INTO orders VALUES('a@test.com','AT5',17,10,'sent')");
 assert.equal(pay(db,'payment-3',2000),0);assert.equal(pay(db,'payment-3',1000),1);assert.equal(pay(db,'unknown',1000,'unknown@test.com'),0);db.close();
});
test('stale partial balances cannot be recorded and a paid status correction blocks overpayment',()=>{
 const db=database();assert.equal(pay(db,'partial',1000),0);assert.equal(pay(db,'full',2000),1);db.exec("UPDATE orders SET atlas_state=18 WHERE tracking='AT1'");assert.equal(pay(db,'correction',1000),0);assert.equal(db.prepare('SELECT SUM(amount_cents) n FROM commission_payments').get().n,2000);db.close();
});
test('commission endpoints scope agent data and reserve settlement writes for administrators',()=>{
 const source=readFileSync(new URL('../app/api/commissions/route.ts',import.meta.url),'utf8');
 assert.match(source,/orders\)\.where\(orderScope\(a\)\)/);assert.match(source,/eq\(members.email,a.email\)/);assert.match(source,/eq\(commissionPayments.memberEmail,a.email\)/);assert.match(source,/a\?\.role!=='admin'/);assert.match(source,/req.headers.get\('origin'\)!==new URL\(req.url\).origin/);
});
