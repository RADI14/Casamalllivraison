import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {memberRemovalStatements} from '../app/team-removal.ts';
import {memberEditStatements} from '../app/team-edit.ts';
const member={email:'a@test.com',name:'Amina',active:1,createdAt:'2026-10-16'};
function fixture(){const d=new DatabaseSync(':memory:');d.exec(`CREATE TABLE members(email TEXT PRIMARY KEY,name TEXT,active INTEGER,created_at TEXT);
CREATE TABLE orders(created_email TEXT,created_by TEXT,tracking TEXT);
CREATE TABLE ad_expenses(member_email TEXT,amount_cents INTEGER);
CREATE TABLE commission_payments(member_email TEXT,amount_cents INTEGER);
CREATE TABLE app_sessions(email TEXT);CREATE TABLE app_password_recovery(email TEXT);
INSERT INTO members VALUES('a@test.com','Amina',1,'2026-10-16'),('b@test.com','Basma',1,'2026-10-16');
INSERT INTO orders VALUES('a@test.com','Amina','AT1');INSERT INTO ad_expenses VALUES('a@test.com',5000);INSERT INTO commission_payments VALUES('a@test.com',1000);
INSERT INTO app_sessions VALUES('a@test.com'),('b@test.com');INSERT INTO app_password_recovery VALUES('a@test.com');`);d.exec(readFileSync(new URL('../drizzle/0012_team_removal.sql',import.meta.url),'utf8'));return d}
function batch(d,queries){d.exec('BEGIN');try{let result;for(const q of queries)result=d.prepare(q.sql).run(...q.args);d.exec('COMMIT');return result.changes}catch(e){d.exec('ROLLBACK');throw e}}
test('removal blocks access, revokes sessions and retains all financial history; restore stays suspended',()=>{const d=fixture();assert.equal(batch(d,memberRemovalStatements(member,false,'2026-10-23')),1);const m=d.prepare('SELECT * FROM members WHERE email=?').get(member.email);assert.equal(m.active,0);assert.equal(m.deleted_at,'2026-10-23');assert.equal(d.prepare('SELECT count(*) n FROM app_sessions WHERE email=?').get(member.email).n,0);assert.equal(d.prepare('SELECT count(*) n FROM app_sessions').get().n,1);assert.equal(d.prepare('SELECT count(*) n FROM app_password_recovery').get().n,0);assert.equal(d.prepare('SELECT tracking FROM orders').get().tracking,'AT1');assert.equal(d.prepare('SELECT amount_cents n FROM ad_expenses').get().n,5000);assert.equal(d.prepare('SELECT amount_cents n FROM commission_payments').get().n,1000);assert.equal(batch(d,memberRemovalStatements({...member,active:0,deletedAt:'2026-10-23'},true,'unused')),1);assert.equal(d.prepare('SELECT active FROM members WHERE email=?').get(member.email).active,0);assert.equal(d.prepare('SELECT deleted_at FROM members WHERE email=?').get(member.email).deleted_at,null);d.close()});
test('stale removal cannot revoke sessions; stale edits cannot reactivate or rename a removed member',()=>{const d=fixture();assert.equal(batch(d,memberRemovalStatements({...member,name:'Stale'},false,'now')),0);assert.equal(d.prepare('SELECT count(*) n FROM app_sessions').get().n,2);assert.equal(batch(d,memberRemovalStatements(member,false,'now')),1);assert.equal(batch(d,memberEditStatements({oldEmail:member.email,email:'new@test.com',name:'Renamed',active:1,originalName:member.name,originalActive:0,createdAt:member.createdAt})),0);assert.equal(d.prepare('SELECT created_by FROM orders').get().created_by,'Amina');assert.equal(batch(d,memberRemovalStatements({...member,active:0,deletedAt:'wrong'},true,'unused')),0);assert.equal(d.prepare('SELECT deleted_at FROM members WHERE email=?').get(member.email).deleted_at,'now');d.close()});
