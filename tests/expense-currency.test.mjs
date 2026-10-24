import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {convertExpense} from '../app/expense-currency.ts';
import {financialReport} from '../app/finance-rules.ts';

test('DH and legacy inputs keep their amount; USD rounds once to DH cents',()=>{
 assert.equal(convertExpense('125.50').amountCents,12550);
 assert.equal(convertExpense('125.50','MAD','bad').exchangeRateMicros,1000000);
 assert.deepEqual(convertExpense('10.01','USD','9.123456'),{currency:'USD',originalAmountCents:1001,exchangeRateMicros:9123456,amountCents:9133});
 assert.equal(convertExpense('0','USD',10).amountCents,0);
 for(const [amount,currency,rate] of [['','USD',10],[-1,'MAD',1],['1.001','USD',10],[1,'EUR',10],[1,'USD',''],[1,'USD',undefined],[1,'USD',0],[1,'USD',-1],[1,'USD','Infinity'],[1,'USD',101],[1,'USD','1.1234567'],[10000000,'USD',10]])assert.equal(convertExpense(amount,currency,rate),null);
});
test('currency migration retains legacy totals and ownership',()=>{
 const db=new DatabaseSync(':memory:');
 db.exec("CREATE TABLE ad_expenses(id TEXT, amount_cents INTEGER, member_email TEXT, product_id TEXT); INSERT INTO ad_expenses VALUES('legacy',25000,'a@test.com','p');");
 db.exec(readFileSync(new URL('../drizzle/0013_expense_currency.sql',import.meta.url),'utf8'));
 assert.deepEqual({...db.prepare('SELECT * FROM ad_expenses').get()},{id:'legacy',amount_cents:25000,member_email:'a@test.com',product_id:'p',currency:'MAD',original_amount_cents:25000,exchange_rate_micros:1000000});db.close();
});
test('converted ads deducted exactly once in DH in product, agent and overall profit',()=>{
 const converted=convertExpense(10,'USD',9.5);
 const report=financialReport([{id:'p',name:'P',stock:1}],[],[{...converted,date:'2026-10-24',category:'ads',costType:'variable',productId:'p',memberEmail:'a@test.com'}],[{email:'a@test.com',name:'A'}]);
 assert.equal(report.total.ads,9500);assert.equal(report.total.net,-9500);
 assert.equal(report.products.find(p=>p.id==='p').ads,9500);
 assert.equal(report.members[0].ads,9500);assert.equal(report.adBreakdown[0].ads,9500);
});
