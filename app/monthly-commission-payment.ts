import {deliveryTimestamp} from './delivery-date-rules.ts';
import {moroccoDay,validDay} from './team-statistics.ts';
import {normalizeEmail} from './rules.ts';
export function monthlyPayableOrders(rows:any[],email:string,month:string){
 if(!/^\d{4}-\d{2}$/.test(month)||!validDay(month+'-01'))throw Error('Mois invalide.');
 return rows.filter(row=>{
  if(normalizeEmail(row.createdEmail??'')!==normalizeEmail(email)||row.status==='cancelled'||!row.tracking||row.atlasState!==17||!Number.isSafeInteger(row.commissionDueCents)||row.commissionDueCents<=0)return false;
  const payload=typeof row.payload==='string'?JSON.parse(row.payload):row.payload;
  const at=deliveryTimestamp(payload?.atlasDeliveredAt);
  return !!at&&moroccoDay(at).slice(0,7)===month;
 });
}
