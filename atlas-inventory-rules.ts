import type {AtlasStock} from './atlas-stock';
export function stockStatus(s:AtlasStock){return s.frozen?'frozen':s.available>0?'available':'empty'}
export function filterAtlasInventory(stocks:AtlasStock[],query:string,filter:string){const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();return stocks.filter(s=>(filter==='all'||stockStatus(s)===filter)&&norm(s.name+' '+s.sku+' '+s.stockId).includes(norm(query)))}
export function atlasInventoryTotals(stocks:AtlasStock[]){return {products:stocks.length,units:stocks.reduce((n,s)=>n+s.available,0),available:stocks.filter(s=>stockStatus(s)==='available').length,empty:stocks.filter(s=>stockStatus(s)==='empty').length,frozen:stocks.filter(s=>stockStatus(s)==='frozen').length}}
