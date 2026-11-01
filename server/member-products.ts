import {getSqlite} from './sqlite';
import type {AtlasStock} from '../app/atlas-stock';
export function allowedStockIds(email:string){return new Set((getSqlite().connection.prepare('SELECT stock_id FROM member_products WHERE member_email=?').all(email) as {stock_id:string}[]).map(r=>r.stock_id))}
export function visibleStocks(actor:{role:string;email:string},stocks:AtlasStock[]){
 if(actor.role==='admin')return stocks;
 const allowed=allowedStockIds(actor.email);
 return stocks.filter(s=>allowed.has(s.stockId)&&s.available>0&&!s.frozen).map(({available,...s})=>({...s,inStock:true}));
}
export function canUseStock(actor:{role:string;email:string},id:unknown){return actor.role==='admin'||typeof id==='string'&&allowedStockIds(actor.email).has(id)}
