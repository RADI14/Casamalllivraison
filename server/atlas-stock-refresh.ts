import {createHash} from 'node:crypto';
import {getSqlite} from './sqlite';
import {atlasRead,normalizeStocks,type AtlasStock} from '../app/atlas-stock';
type Snapshot={stocks:AtlasStock[];updatedAt:number};
const pending=new Map<string,Promise<Snapshot>>(),retryAt=new Map<string,number>();
export async function refreshedAtlasStocks(key:string,force=false):Promise<Snapshot>{
 const scope=createHash('sha256').update(key).digest('hex'),db=getSqlite().connection;
 const row=db.prepare('SELECT stocks,updated_at FROM atlas_stock_snapshot WHERE scope=?').get(scope) as {stocks:string;updated_at:number}|undefined;
 if(!force&&row&&Date.now()-row.updated_at<15000)return {stocks:JSON.parse(row.stocks),updatedAt:row.updated_at};
 const existing=pending.get(scope);if(existing)return existing;
 if((retryAt.get(scope)??0)>Date.now())throw Error('Atlas stock refresh is temporarily paused.');
 const job=(async()=>{
  try{
   const stocks=normalizeStocks(await atlasRead(key,'/stocks')),updatedAt=Date.now();
   db.prepare('INSERT INTO atlas_stock_snapshot(scope,stocks,updated_at) VALUES(?,?,?) ON CONFLICT(scope) DO UPDATE SET stocks=excluded.stocks,updated_at=excluded.updated_at').run(scope,JSON.stringify(stocks),updatedAt);
   // Reuse product identities for assignments, without exposing cached quantities there.
   const products=stocks.map(({stockId,sku,name})=>({stockId,sku,name}));
   db.prepare('INSERT INTO atlas_product_catalog(scope,products,updated_at) VALUES(?,?,?) ON CONFLICT(scope) DO UPDATE SET products=excluded.products,updated_at=excluded.updated_at').run(scope,JSON.stringify(products),updatedAt);
   retryAt.delete(scope);return {stocks,updatedAt};
  }catch(e){retryAt.set(scope,Date.now()+30000);throw e}
 })();pending.set(scope,job);try{return await job}finally{pending.delete(scope)}
}
const state=globalThis as typeof globalThis & {atlasStockWorkerStarted?:boolean};
export function startAtlasStockWorker(){
 if(state.atlasStockWorkerStarted||process.env.ATLAS_AUTO_SYNC==='false'||!process.env.ATLAS_API_KEY)return;
 state.atlasStockWorkerStarted=true;
 const tick=async()=>{
  try{await refreshedAtlasStocks(process.env.ATLAS_API_KEY!,true)}catch(e){console.warn('[atlas-stock] Refresh failed:',/Atlas API \d+/.exec((e as Error).message)?.[0]??'connection or response error')}
  setTimeout(()=>{void tick()},30000).unref();
 };
 setTimeout(()=>{void tick()},5000).unref();
 console.info('[atlas-stock] Automatic stock refresh enabled (30s between checks).');
}
