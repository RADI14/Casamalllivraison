import {atlasDeliveredAt,deliveryTimestamp} from '../app/delivery-date-rules.ts';
/** Read actual carrier events, never use entry time or sync time as delivery time. */
export async function enrichDeliveryDate(key:string,code:string,payload:Record<string,any>,state:number,fetcher:typeof fetch=fetch){
 if(state!==17){delete payload.atlasDeliveredAt;delete payload.atlasDeliveryHistoryCheckedAt;return;}
 const checked=Date.parse(payload.atlasDeliveryHistoryCheckedAt??'');
 const ttl=deliveryTimestamp(payload.atlasDeliveredAt)?86400000:300000;
 if(Number.isFinite(checked)&&checked<=Date.now()&&Date.now()-checked<ttl)return;
 try{const r=await fetcher('https://api.atlaslivraison.com/api/external/colis/'+encodeURIComponent(code)+'/history',{cache:'no-store',headers:{'x-api-key':key},signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Atlas history unavailable');const j=await r.json() as any;if(j.success!==true)throw Error('Atlas history unavailable');const at=atlasDeliveredAt(j.data);if(at)payload.atlasDeliveredAt=at;else delete payload.atlasDeliveredAt;payload.atlasDeliveryHistoryCheckedAt=new Date().toISOString();}catch{/* Keep existing confirmed date; missing history stays unknown and will retry. */}
}
