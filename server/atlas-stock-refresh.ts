import {createHash} from 'node:crypto';
import {getSqlite} from './sqlite';
import {AtlasReadError,atlasRead,normalizeStocks,type AtlasStock} from '../app/atlas-stock';
type Snapshot={stocks:AtlasStock[];updatedAt:number;stale?:boolean};
const pending=new Map<string,Promise<Snapshot>>(),retryAt=new Map<string,number>(),failures=new Map<string,number>();
const FRESH_MS=60000,STALE_MS=300000;
export async function refreshedAtlasStocks(key:string,force=false):Promise<Snapshot>{
 const scope=createHash('sha256').update(key).digest('hex'),db=getSqlite().connection;
 const row=db.prepare('SELECT stocks,updated_at FROM atlas_stock_snapshot WHERE scope=?').get(scope) as {stocks:string;updated_at:number}|undefined;
 if(!force&&row&&Date.now()-row.updated_at<FRESH_MS)return {stocks:JSON.parse(row.stocks),updatedAt:row.updated_at};
 const existing=pending.get(scope);if(existing)return existing;
 const cached=()=>row&&Date.now()-row.updated_at<=STALE_MS?{stocks:JSON.parse(row.stocks) as AtlasStock[],updatedAt:row.updated_at,stale:true}:null;
 if((retryAt.get(scope)??0)>Date.now()){const snapshot=cached();if(snapshot)return snapshot;throw Error('Atlas stock refresh is temporarily paused.');}
 const job=(async()=>{
  try{
   const stocks=normalizeStocks(await atlasRead(key,'/stocks')),updatedAt=Date.now();
   db.prepare('INSERT INTO atlas_stock_snapshot(scope,stocks,updated_at) VALUES(?,?,?) ON CONFLICT(scope) DO UPDATE SET stocks=excluded.stocks,updated_at=excluded.updated_at').run(scope,JSON.stringify(stocks),updatedAt);
   // Reuse product identities for assignments, without exposing cached quantities there.
   const products=stocks.map(({stockId,sku,name})=>({stockId,sku,name}));
   db.prepare('INSERT INTO atlas_product_catalog(scope,products,updated_at) VALUES(?,?,?) ON CONFLICT(scope) DO UPDATE SET products=excluded.products,updated_at=excluded.updated_at').run(scope,JSON.stringify(products),updatedAt);
   retryAt.delete(scope);failures.delete(scope);return {stocks,updatedAt};
  }catch(e){
   // Authentication errors must never expose a previous snapshot.
   if(e instanceof AtlasReadError&&(e.status===401||e.status===403))throw e;
   const count=(failures.get(scope)??0)+1;failures.set(scope,count);
   const delay=Math.max(Math.min(300000,30000*2**Math.min(count-1,4)),e instanceof AtlasReadError?e.retryAfterMs:0);
   retryAt.set(scope,Date.now()+delay);
   const snapshot=cached();if(snapshot)return snapshot;throw e;
  }
 })();pending.set(scope,job);try{return await job}finally{pending.delete(scope)}
}
const state=globalThis as typeof globalThis & {atlasStockWorkerStarted?:boolean};
export function startAtlasStockWorker(){
 if(state.atlasStockWorkerStarted||process.env.ATLAS_AUTO_SYNC==='false'||!process.env.ATLAS_API_KEY)return;
 state.atlasStockWorkerStarted=true;
 const tick=async()=>{
  try{await refreshedAtlasStocks(process.env.ATLAS_API_KEY!)}catch(e){console.warn('[atlas-stock] Refresh failed:',/Atlas API \d+/.exec((e as Error).message)?.[0]??'connection or response error')}
  setTimeout(()=>{void tick()},30000).unref();
 };
 setTimeout(()=>{void tick()},5000).unref();
 console.info('[atlas-stock] Automatic stock refresh enabled (30s between checks).');
}
