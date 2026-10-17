import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {memberEditStatements} from '../app/team-edit.ts';
const input={oldEmail:'a@test.com',email:'new@test.com',name:'New name',active:0,originalName:'Old name',originalActive:1,createdAt:'2026-10-16'};
function db(){const d=new DatabaseSync(':memory:');d.exec(`CREATE TABLE members(email TEXT PRIMARY KEY,name TEXT,active INTEGER,created_at TEXT);
 CREATE TABLE orders(created_email TEXT,created_by TEXT,tracking TEXT);
 CREATE TABLE ad_expenses(member_email TEXT,amount_cents INTEGER);
 CREATE TABLE commission_payments(member_email TEXT,amount_cents INTEGER,note TEXT);
 INSERT INTO members VALUES('a@test.com','Old name',1,'2026-10-16'),('b@test.com','B',1,'2026-10-16');
 INSERT INTO orders VALUES('a@test.com','Old name','AT1'),('b@test.com','B','AT2');
 INSERT INTO ad_expenses VALUES('a@test.com',5000),('b@test.com',1000);
 INSERT INTO commission_payments VALUES('a@test.com',2000,'Paid externally'),('b@test.com',1000,'Other');`);return d}
function save(d,b){d.exec('BEGIN');try{let last;for(const q of memberEditStatements(b))last=d.prepare(q.sql).run(...q.args);d.exec('COMMIT');return last.changes}catch(e){d.exec('ROLLBACK');throw e}}
test('editing name, email and access preserves linked orders, paid history and attributed ads',()=>{const d=db();assert.equal(save(d,input),1);assert.equal(d.prepare('SELECT name FROM members WHERE email=?').get(input.email).name,'New name');assert.equal(d.prepare('SELECT active FROM members WHERE email=?').get(input.email).active,0);assert.deepEqual({...d.prepare("SELECT * FROM orders WHERE tracking='AT1'").get()},{created_email:input.email,created_by:input.name,tracking:'AT1'});assert.equal(d.prepare('SELECT amount_cents FROM commission_payments WHERE member_email=?').get(input.email).amount_cents,2000);assert.equal(d.prepare('SELECT amount_cents FROM ad_expenses WHERE member_email=?').get(input.email).amount_cents,5000);assert.equal(d.prepare("SELECT created_email FROM orders WHERE tracking='AT2'").get().created_email,'b@test.com');d.close()});
test('duplicate email rolls back all linked changes atomically',()=>{const d=db();assert.throws(()=>save(d,{...input,email:'b@test.com'}));assert.equal(d.prepare("SELECT created_by FROM orders WHERE tracking='AT1'").get().created_by,'Old name');assert.equal(d.prepare("SELECT amount_cents FROM commission_payments WHERE member_email='a@test.com'").get().amount_cents,2000);assert.equal(d.prepare("SELECT name FROM members WHERE email='a@test.com'").get().name,'Old name');d.close()});
test('stale edit cannot move or rename another account’s records',()=>{const d=db();assert.equal(save(d,{...input,originalName:'Stale name'}),0);assert.equal(d.prepare("SELECT created_email FROM orders WHERE tracking='AT1'").get().created_email,'a@test.com');assert.equal(save(d,input),1);assert.equal(save(d,{...input,email:'b@test.com'}),0);assert.equal(d.prepare("SELECT name FROM members WHERE email='b@test.com'").get().name,'B');d.close()});
test('name-only edits keep the login and update existing order display names',()=>{const d=db();assert.equal(save(d,{...input,email:input.oldEmail,active:1}),1);assert.equal(d.prepare("SELECT created_by FROM orders WHERE tracking='AT1'").get().created_by,'New name');assert.equal(d.prepare("SELECT COUNT(*) n FROM commission_payments").get().n,2);d.close()});
test('team writes require administrator identity and same-origin requests',()=>{const source=readFileSync(new URL('../app/api/team/route.ts',import.meta.url),'utf8');assert.match(source,/a\?\.role!=='admin'/);assert.match(source,/!sameOrigin\(req\)/);assert.match(source,/oldEmail===a.email/);assert.match(source,/email===a.email/);assert.match(source,/env.DB!\.batch\(\[\.\.\.extra,\.\.\.memberEditStatements/)});
