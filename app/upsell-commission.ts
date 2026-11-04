/** Only an explicit trailing pack count is accepted, never numbers inside a product name. */
export function legacyPack(product:unknown){
 if(typeof product!=='string')return null;
 const match=/^(.+?)\s+[x×]\s*([2-9])\s*$/iu.exec(product);
 return match?{name:match[1].trim(),quantity:Number(match[2])}:null;
}
export function savedPackQuantity(ids:string[]){
 if(ids.length!==1)return null;
 const match=/^@pack:([2-9]):.+$/.exec(ids[0]);return match?Number(match[1]):null;
}
/** Eligibility is controlled by server settings, never by an order form. */
export function upsellCommissionMultiplier(payload:any,eligibleStockIds:string[]){
 if(!Array.isArray(eligibleStockIds)||!eligibleStockIds.length)return 1;
 if(!Array.isArray(payload?.stockItems)){const pack=savedPackQuantity(eligibleStockIds);if(pack&&Number.isInteger(payload?.quantity)&&payload.quantity>=1&&payload.quantity<=9&&legacyPack(payload.product)?.quantity===pack)return payload.quantity===1?pack:payload.quantity;return eligibleStockIds.length===1&&eligibleStockIds[0].startsWith('@sku:')&&Number.isInteger(payload?.quantity)&&payload.quantity>=1&&payload.quantity<=9?payload.quantity:1;}
 const eligible=new Set(eligibleStockIds),seen=new Set<string>();let units=0,total=0;
 for(const item of payload.stockItems){if(typeof item.stockId!=='string'||seen.has(item.stockId)||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>9)return 1;seen.add(item.stockId);total+=item.quantity;if(eligible.has(item.stockId))units+=item.quantity;}
 if(total!==payload.quantity||total>9)return 1;
 return Math.max(1,units);
}
export function savedUpsellIds(value:unknown):string[]{try{const ids=typeof value==='string'?JSON.parse(value):value;return Array.isArray(ids)&&ids.every(x=>typeof x==='string')?ids:[]}catch{return []}}
