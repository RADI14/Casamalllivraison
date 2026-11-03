import type {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {upsellCommissionMultiplier} from '../app/upsell-commission.ts';
/** Reprice history using exact SKU/stock identity; unique exact catalogue names are a legacy fallback. */
export function reconcileUpsellCommissions(db:DatabaseSync,key?:string){
 const settings=db.prepare('SELECT sku,upsell FROM product_commission_settings').all() as {sku:string;upsell:number}[];
 if(!settings.length)return {updated:0,unmatched:0};
 const enabled=new Set(settings.filter(s=>s.upsell===1).map(s=>s.sku));
 const products=db.prepare('SELECT id,sku,name FROM products').all() as {id:string;sku:string;name:string}[];
 const byId=new Map(products.map(p=>[p.id,p.sku])),byStock=new Map<string,string>(),byName=new Map<string,Set<string>>();
 const remember=(name:string,sku:string)=>{if(!name||!sku)return;if(!byName.has(name.trim()))byName.set(name.trim(),new Set());byName.get(name.trim())!.add(sku)};
 products.forEach(p=>remember(p.name,p.sku));
 const catalogues=key?db.prepare('SELECT products FROM atlas_product_catalog WHERE scope=?').all(createHash('sha256').update(key).digest('hex')):db.prepare('SELECT products FROM atlas_product_catalog').all();
 for(const row of catalogues as {products:string}[]){try{for(const p of JSON.parse(row.products)){if(typeof p.stockId==='string'&&typeof p.sku==='string'&&p.sku){byStock.set(p.stockId,p.sku);if(typeof p.name==='string')remember(p.name,p.sku)}}}catch{}}
 const nameSku=(name:any)=>{const candidates=typeof name==='string'?byName.get(name.trim()):undefined;return candidates?.size===1?[...candidates][0]:undefined};
 const rows=db.prepare('SELECT id,payload,product_id AS productId,commission_multiplier AS multiplier,commission_upsell_stock_ids AS ids FROM orders WHERE commission_rate=10').all() as any[];
 let updated=0,unmatched=0;const update=db.prepare('UPDATE orders SET commission_multiplier=?,commission_upsell_stock_ids=?,updated_at=? WHERE id=?');
 for(const row of rows){let p:any;try{p=JSON.parse(row.payload)}catch{unmatched++;continue}
  const knownSku=byId.get(row.productId)||p.atlasSku||nameSku(p.product);let ids:string[]=[];
  if(Array.isArray(p.stockItems)&&p.stockItems.length){let valid=true;for(const item of p.stockItems){const sku=byStock.get(item.stockId)||(p.stockItems.length===1?knownSku:undefined);if(!sku){valid=false;break}if(enabled.has(sku))ids.push(item.stockId)}if(!valid){unmatched++;continue}}
  else if(knownSku){if(enabled.has(knownSku))ids=['@sku:'+knownSku]}
  else{unmatched++;continue}
  const multiplier=upsellCommissionMultiplier(p,ids),json=JSON.stringify(ids);
  if(multiplier!==row.multiplier||json!==row.ids){update.run(multiplier,json,new Date().toISOString(),row.id);updated++;}
 }
 return {updated,unmatched};
}
