/** Settings are snapshotted by the server, never taken from an order form. */
export function upsellCommissionMultiplier(payload:any,eligibleStockIds:string[]){
 if(!Array.isArray(eligibleStockIds)||!eligibleStockIds.length||!Array.isArray(payload?.stockItems))return 1;
 const eligible=new Set(eligibleStockIds),seen=new Set<string>();let units=0,total=0;
 for(const item of payload.stockItems){if(typeof item.stockId!=='string'||seen.has(item.stockId)||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>9)return 1;seen.add(item.stockId);total+=item.quantity;if(eligible.has(item.stockId))units+=item.quantity;}
 if(total!==payload.quantity||total>9)return 1;
 return Math.max(1,units);
}
export function savedUpsellIds(value:unknown):string[]{try{const ids=typeof value==='string'?JSON.parse(value):value;return Array.isArray(ids)&&ids.every(x=>typeof x==='string')?ids:[]}catch{return []}}
