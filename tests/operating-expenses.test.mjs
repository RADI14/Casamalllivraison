import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {validExpenseClassification,expenseCategory} from '../app/expense-rules.ts';
test('expense types reject unknown categories and default legacy ads',()=>{assert.equal(expenseCategory({}), 'ads');for(const category of ['ads','chatgpt','ai','collaboration','training','hosting','tools','other'])for(const type of ['fixed','variable'])assert.ok(validExpenseClassification(category,type));for(const [category,type] of [['sql','fixed'],['ads','monthly'],[null,'variable']])assert.equal(validExpenseClassification(category,type),false)});
test('migration keeps existing ads and defaults them to variable without losing allocations',()=>{const db=new DatabaseSync(':memory:');db.exec("CREATE TABLE ad_expenses(id TEXT, date TEXT, amount_cents INTEGER, member_email TEXT, product_id TEXT); INSERT INTO ad_expenses VALUES('old','2026-10-16',25000,'a@example.com','p');");db.exec(readFileSync(new URL('../drizzle/0007_operating_expenses.sql',import.meta.url),'utf8'));const old=db.prepare('SELECT * FROM ad_expenses').get();assert.equal(old.category,'ads');assert.equal(old.cost_type,'variable');assert.equal(old.amount_cents,25000);assert.equal(old.member_email,'a@example.com');db.close()});
