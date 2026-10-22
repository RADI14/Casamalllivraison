import {normalizeEmail} from './rules.ts';
export function agentOrderGroups(members:any[],orders:any[]){
 return members.map(m=>{
  const email=normalizeEmail(m.email),rows=orders.filter(o=>normalizeEmail(o.createdEmail??'')===email);
  const payable=rows.filter(o=>Number.isSafeInteger(o.commissionDueCents)&&o.commissionDueCents>0&&o.tracking&&o.atlasState===17&&o.status!=='cancelled');
  const batch=payable.slice(0,500);
  return {email,name:m.name,orders:rows.length,paid:rows.filter(o=>o.commissionPaymentStatus==='paid').length,unpaid:payable.length,dueCents:payable.reduce((n,o)=>n+o.commissionDueCents,0),batch,batchCents:batch.reduce((n,o)=>n+o.commissionDueCents,0)};
 });
}
