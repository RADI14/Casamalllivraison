import {createHmac,timingSafeEqual} from 'node:crypto';
export const SERVICE_PHONE='212617307262';
export function normalizePhone(value:string){const p=value.replace(/[\s()+.-]/g,'').replace(/^00/,'');const result=/^0[67]\d{8}$/.test(p)?'212'+p.slice(1):p;if(!/^212[67]\d{8}$/.test(result))throw Error('Numéro marocain 06/07 invalide.');return result;}
export function verifySignature(body:string,signature:string|null,secret:string){if(!secret||!/^sha256=[a-f0-9]{64}$/.test(signature??''))return false;return timingSafeEqual(Buffer.from(signature!.slice(7),'hex'),createHmac('sha256',secret).update(body).digest());}
export function windowOpen(last:string|null,now=Date.now()){const at=Date.parse(last??'');return Number.isFinite(at)&&at<=now&&now-at<24*60*60*1000;}
export function orderSnapshot(p:any){return JSON.stringify({fullname:p.fullname,phone:p.phone,product:p.product,quantity:p.quantity,price:p.price,address:p.address,cityName:p.cityName});}
export function summary(p:any){return `سلام ${p.fullname} 👋 أنا المساعد الآلي ديال خدمة تأكيد الطلبات.\nالمنتوج: ${p.product}\nالكمية: ${p.quantity}\nالمجموع عند التوصيل: ${p.price} درهم\nالعنوان: ${p.address}، ${p.cityName}\nإلى كانت المعلومات صحيحة، ضغط على «تأكيد الطلب». إلى بغيتي تبدل شي معلومة كتبها هنا باش يراجعها الفريق.`;}
export function confirmationButton(id:string,conversationId:string){if(id===`confirm:${conversationId}`)return 'confirmed';if(id===`cancel:${conversationId}`)return 'cancelled';return null;}
export type AiDraft={reply:string;needsHuman:boolean;reason:string};
export function parseDraft(value:any):AiDraft{if(!value||typeof value.reply!=='string'||!value.reply.trim()||value.reply.length>2000||typeof value.needsHuman!=='boolean'||typeof value.reason!=='string'||value.reason.length>500)throw Error('Réponse AI invalide : intervention manuelle requise.');return {reply:value.reply.trim(),needsHuman:value.needsHuman,reason:value.reason};}
