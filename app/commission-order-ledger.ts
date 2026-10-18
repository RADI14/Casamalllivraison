import {commission,normalizeEmail} from './rules.ts';
export type Allocation={id:string;orderId:string;paymentId:string;amountCents:number;createdAt:string;releasedAt:string|null};
export type OrderPayment={commissionPaidCents:number;commissionDueCents:number;commissionPaymentStatus:'paid'|'unpaid'|'partial'|'not_earned';commissionPaidAt:string|null};
export function commissionOrderLedger(orders:any[],payments:any[],allocations:Allocation[]){
 const sorted=[...orders].sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt))||a.id.localeCompare(b.id));
 const eligible=sorted.filter(o=>commission(o)>0&&o.createdEmail),orderMap=new Map(eligible.map(o=>[o.id,o]));
 const orderedPayments=[...payments].sort((a,b)=>String(a.paidAt).localeCompare(String(b.paidAt))||a.id.localeCompare(b.id));
 const paymentMap=new Map(orderedPayments.map(p=>[p.id,p])),remaining=new Map(eligible.map(o=>[o.id,commission(o)*100])),budget=new Map(orderedPayments.map(p=>[p.id,p.amountCents]));
 const planned:{sourceId:string|null;orderId:string;paymentId:string;amountCents:number}[]=[],states=new Map<string,OrderPayment>(orders.map(o=>[o.id,{commissionPaidCents:0,commissionDueCents:commission(o)*100,commissionPaymentStatus:commission(o)?'unpaid':'not_earned',commissionPaidAt:null}]));
 function assign(orderId:string,paymentId:string,amount:number,sourceId:string|null){
  if(!Number.isSafeInteger(amount)||amount<=0)return;
  remaining.set(orderId,remaining.get(orderId)!-amount);budget.set(paymentId,budget.get(paymentId)!-amount);
  planned.push({sourceId,orderId,paymentId,amountCents:amount});const state=states.get(orderId)!;
  state.commissionPaidCents+=amount;state.commissionDueCents-=amount;
  const date=paymentMap.get(paymentId)!.paidAt;
  if(!state.commissionPaidAt||date>state.commissionPaidAt)state.commissionPaidAt=date;
 }
 // Preserve explicit order payments first. Reversed deliveries release their
 // effective credit; the immutable payment history is never erased.
 for(const a of [...allocations].sort((x,y)=>x.createdAt.localeCompare(y.createdAt)||x.id.localeCompare(y.id))){
  if(a.releasedAt)continue;const o=orderMap.get(a.orderId),p=paymentMap.get(a.paymentId);
  if(!o||!p||normalizeEmail(o.createdEmail)!==normalizeEmail(p.memberEmail))continue;
  const amount=Math.min(a.amountCents,remaining.get(o.id)!,budget.get(p.id)!);
  assign(o.id,p.id,amount,amount===a.amountCents?a.id:null);
 }
 // Legacy lump-sum payments and any remaining credit cover the oldest earned
 // orders for that same agent. This is a projection; GET does not write data.
 for(const p of orderedPayments){for(const o of eligible){if((budget.get(p.id)??0)<=0)break;if(normalizeEmail(o.createdEmail)!==normalizeEmail(p.memberEmail))continue;assign(o.id,p.id,Math.min(remaining.get(o.id)!,budget.get(p.id)!),null)}}
 for(const state of states.values())if(state.commissionPaymentStatus!=='not_earned')state.commissionPaymentStatus=state.commissionDueCents===0?'paid':state.commissionPaidCents>0?'partial':'unpaid';
 return {states,planned};
}
