import {commissionOrderLedger,type Allocation} from './commission-order-ledger.ts';
import {normalizeEmail} from './rules.ts';
import {moroccoDay} from './team-statistics.ts';

// Allocate payments over the full history before applying the dashboard period.
export function dashboardCommissionDues(orders:any[],payments:any[],allocations:Allocation[],from='',to=''){
 const {states}=commissionOrderLedger(orders,payments,allocations),dues=new Map<string,number>();
 for(const order of orders){
  const day=moroccoDay(order.createdAt),email=normalizeEmail(order.createdEmail??'');
  if(!email||(from&&day<from)||(to&&day>to))continue;
  dues.set(email,(dues.get(email)??0)+(states.get(order.id)?.commissionDueCents??0));
 }
 return dues;
}
