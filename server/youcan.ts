import {createHmac,timingSafeEqual,createHash,randomBytes,createCipheriv,createDecipheriv,randomUUID} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
export const origin='https://api.youcan.shop';
export const secret=()=>process.env.YOUCAN_CLIENT_SECRET??'';
export const storeId=()=>process.env.YOUCAN_STORE_ID??'';
export function verifyYoucan(body:string,signature:string,key:string){if(!key||! /^[a-f0-9]{64}$/i.test(signature))return false;const expected=createHmac('sha256',key).update(body).digest();return timingSafeEqual(expected,Buffer.from(signature,'hex'))}
export function seal(value:string,key:string){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',createHash('sha256').update(key).digest(),iv);const bytes=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),bytes]).toString('base64')}
export function unseal(value:string,key:string){const b=Buffer.from(value,'base64'),cipher=createDecipheriv('aes-256-gcm',createHash('sha256').update(key).digest(),b.subarray(0,12));cipher.setAuthTag(b.subarray(12,28));return Buffer.concat([cipher.update(b.subarray(28)),cipher.final()]).toString('utf8')}
export async function youcanRequest(token:string,path:string,body?:any){
 const r=await fetch(origin+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error('YouCan indisponible ('+r.status+'). Réessayez ou reconnectez le magasin.');return r.json() as Promise<any>;
}
export function connection(db:DatabaseSync){const c=db.prepare('SELECT * FROM youcan_connections WHERE store_id=?').get(storeId()) as any;if(!c||c.expires_at<Date.now())throw Error('Connectez ou reconnectez YouCan avant de synchroniser.');return unseal(c.token_cipher,secret())}
export async function activateYoucan(token:string){
 for(const event of ['order.created','order.updated','app.uninstalled']){
 const hook=await youcanRequest(token,'/resthooks/subscribe',{event,target_url:'https://fastlivraison.com/api/youcan/webhook'});
 if(typeof (hook.data??hook)?.id!=='string')throw Error('Activation des notifications YouCan non confirmée.');
 }
}
const text=(v:any,max=1000)=>typeof v==='string'?v.slice(0,max):'';
export function orderDraft(o:any){
 const customer=o.customer?.data??o.customer??{},shipping=o.shipping?.data??o.shipping??{},address=shipping.address?.data??shipping.address??customer.address??{};
 const lines=o.variants?.data??o.variants??[];
 return {fullname:text(address.full_name||customer.full_name||[customer.first_name,customer.last_name].filter(Boolean).join(' ')),phone:text(address.phone||customer.phone,40),phone2:'',address:text(typeof address==='string'?address:address.address||address.address1||address.line1),cityName:text(address.city?.name||address.city||customer.city,150),price:Number(o.total)||0,note:text(o.notes),blocked:['cancelled','canceled','refunded','closed'].includes(String(o.status_object?.slug??o.status_new??'').toLowerCase()),currency:text(o.currency||o.customer_currency?.code||'MAD',10),lines:Array.isArray(lines)?lines.slice(0,50).map((line:any)=>({name:text(line.variant?.product?.name||line.product?.name||line.name,200),variant:Object.values(line.variant?.variations??{}).filter(v=>typeof v==='string'&&v!=='default').map(v=>text(v,100)).join(' / '),sku:text(line.variant?.sku||line.sku,100),quantity:Number(line.quantity)||1})):[]};
}
export function receiveYoucan(db:DatabaseSync,o:any,eventAt:string,hydrated=false){
 if(typeof o?.id!=='string'||! /^[a-zA-Z0-9-]{1,100}$/.test(o.id))throw Error('Invalid order ID');
 const stamp=typeof o.updated_at==='string'&&Number.isFinite(Date.parse(o.updated_at))?new Date(o.updated_at).toISOString():eventAt;
 const payload=JSON.stringify(orderDraft(o));
 db.prepare(`INSERT INTO youcan_orders(id,store_id,remote_id,reference,payload,source_updated_at,received_at,hydrated) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(store_id,remote_id) DO UPDATE SET payload=excluded.payload,reference=excluded.reference,source_updated_at=excluded.source_updated_at,hydrated=excluded.hydrated WHERE youcan_orders.local_order_id IS NULL AND excluded.source_updated_at>=youcan_orders.source_updated_at AND (excluded.hydrated=1 OR youcan_orders.hydrated=0)`).run(randomUUID(),storeId(),o.id,String(o.ref??o.id).slice(0,100),payload,stamp,new Date().toISOString(),hydrated?1:0);
}
export async function hydrateYoucan(db:DatabaseSync,id:string){const o=await youcanRequest(connection(db),'/orders/'+encodeURIComponent(id)+'?include=customer,variants,shipping');receiveYoucan(db,o.data??o,new Date().toISOString(),true)}
