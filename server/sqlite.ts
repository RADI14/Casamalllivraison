import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync,readdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
type Value=string|number|null|Uint8Array;
export class SqliteDatabase {
 readonly connection:DatabaseSync;
 constructor(path:string){if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});this.connection=new DatabaseSync(path);this.connection.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');}
 prepare(sql:string){return new Prepared(this,sql,[])}
 async batch(statements:Prepared[]){this.connection.exec('BEGIN IMMEDIATE');try{const results=statements.map(s=>s.execute());this.connection.exec('COMMIT');return results}catch(e){this.connection.exec('ROLLBACK');throw e}}
 migrate(directory:string){const d=this.connection;d.exec('CREATE TABLE IF NOT EXISTS app_migrations(name TEXT PRIMARY KEY)');for(const name of readdirSync(directory).filter(n=>n.endsWith('.sql')).sort()){if(d.prepare('SELECT 1 FROM app_migrations WHERE name=?').get(name))continue;d.exec('BEGIN IMMEDIATE');try{d.exec(readFileSync(resolve(directory,name),'utf8'));d.prepare('INSERT INTO app_migrations VALUES (?)').run(name);d.exec('COMMIT')}catch(e){d.exec('ROLLBACK');throw e}}d.exec(`CREATE TABLE IF NOT EXISTS app_credentials(email TEXT PRIMARY KEY REFERENCES members(email) ON UPDATE CASCADE ON DELETE CASCADE,password_hash TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS app_sessions(token_hash TEXT PRIMARY KEY,email TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS app_sessions_email ON app_sessions(email);
 CREATE TABLE IF NOT EXISTS app_login_attempts(key TEXT PRIMARY KEY,attempts INTEGER NOT NULL,reset_at INTEGER NOT NULL);`);}
}
class Prepared {
 private db:SqliteDatabase;private sql:string;private args:Value[];
 constructor(db:SqliteDatabase,sql:string,args:Value[]){this.db=db;this.sql=sql;this.args=args}
 bind(...args:Value[]){return new Prepared(this.db,this.sql,args)}
 execute(){const s=this.db.connection.prepare(this.sql);const results=s.all(...this.args);const changes=Number((this.db.connection.prepare('SELECT changes() AS n').get() as {n:number}).n);return {success:true,results,meta:{changes,last_row_id:0,duration:0}}}
 async all(){return this.execute()}
 async run(){return this.execute()}
 async raw(){const s=this.db.connection.prepare(this.sql);s.setReturnArrays(true);return s.all(...this.args)}
 async first(column?:string){const row=this.db.connection.prepare(this.sql).get(...this.args);return column?row?.[column]??null:row??null}
}
let database:SqliteDatabase|undefined;
export function getSqlite(){if(!database){const path=process.env.SQLITE_PATH??(process.env.NODE_ENV==='production'?undefined:'.data/casamall.sqlite');if(!path)throw Error('SQLITE_PATH is required; mount a persistent Railway volume at /data.');database=new SqliteDatabase(path);database.migrate(resolve(process.cwd(),'drizzle'));}return database}
