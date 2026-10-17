import {moroccoDay} from './team-statistics.ts';
import {normalizeEmail} from './rules.ts';
type Team={email:string};
type Order={id:string;createdEmail:string|null;createdAt:string};
type Confirmation={order_id:string;status:string};
/** Period rates use order creation day; Today and All time keep their literal meanings. */
export function confirmationTeamMetrics(team:Team[],orders:Order[],confirmations:Confirmation[],from='',to='',now=new Date()){
 const metrics=new Map(team.map(m=>[normalizeEmail(m.email),{todayOrders:0,allTimeOrders:0,confirmed:0,confirmationRate:null as number|null,periodOrders:0}]));
 const confirmed=new Set(confirmations.filter(c=>c.status==='confirmed').map(c=>c.order_id)),today=moroccoDay(now);
 for(const order of orders){const metric=order.createdEmail?metrics.get(normalizeEmail(order.createdEmail)):undefined;if(!metric)continue;const day=moroccoDay(order.createdAt);metric.allTimeOrders++;if(day===today)metric.todayOrders++;if((from&&day<from)||(to&&day>to))continue;metric.periodOrders++;if(confirmed.has(order.id))metric.confirmed++;}
 for(const value of metrics.values())value.confirmationRate=value.periodOrders?value.confirmed/value.periodOrders*100:null;
 return metrics;
}
