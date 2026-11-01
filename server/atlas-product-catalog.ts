import {createHash} from 'node:crypto';
import {getSqlite} from './sqlite';
import {atlasRead,normalizeStocks} from '../app/atlas-stock';
type Product={stockId:string;sku:string;name:string};
type Catalogue={products:Product[];updatedAt:number;stale:boolean};
const pending=new Map<string,Promise<Catalogue>>();
const retryAt=new Map<string,number>();
export async function atlasProductCatalogue(key:string):Promise<Catalogue>{
 if(!key)throw Error('Connexion Atlas à configurer.');
 const scope=createHash('sha256').update(key).digest('hex'),db=getSqlite().connection;
 const row=db.prepare('SELECT products,updated_at FROM atlas_product_catalog WHERE scope=?').get(scope) as {products:string;updated_at:number}|undefined;
 const cached=row?{products:JSON.parse(row.products) as Product[],updatedAt:row.updated_at,stale:false}:undefined;
 if(cached&&Date.now()-cached.updatedAt<60000)return cached;
 if((retryAt.get(scope)??0)>Date.now()){if(cached)return {...cached,stale:true};throw Error('Catalogue en cours d’actualisation. Réessayez dans quelques instants.')}
 const existing=pending.get(scope);if(existing)return existing;
 const job=(async()=>{
  try{
   let data:unknown;
   try{data=await atlasRead(key,'/stocks')}catch(e){if(/429|401|403/.test((e as Error).message))throw e;await new Promise(r=>setTimeout(r,300));data=await atlasRead(key,'/stocks')}
   // Only product identities are cached. Ordering still checks live quantities.
   const products=normalizeStocks(data).map(({stockId,sku,name})=>({stockId,sku,name})),updatedAt=Date.now();
   db.prepare('INSERT INTO atlas_product_catalog(scope,products,updated_at) VALUES(?,?,?) ON CONFLICT(scope) DO UPDATE SET products=excluded.products,updated_at=excluded.updated_at').run(scope,JSON.stringify(products),updatedAt);
   retryAt.delete(scope);return {products,updatedAt,stale:false};
  }catch(e){retryAt.set(scope,Date.now()+30000);console.warn('[atlas-product-catalog] Refresh failed:',/Atlas API \d+/.exec((e as Error).message)?.[0]??'connection or response error');if(cached)return {...cached,stale:true};throw Error('Catalogue en cours d’actualisation. Réessayez dans quelques instants.')}
 })();pending.set(scope,job);try{return await job}finally{pending.delete(scope)}
}
