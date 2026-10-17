import {moroccoDay} from './team-statistics.ts';
export type TrackingFilters={tab:string;state:string;city:string;product:string;query:string;from:string;to:string;updated:string};
export function trackingGroup(r:any){return !r.tracking&&['draft','error','sending'].includes(r.status)?'new':r.tracking&&r.status!=='cancelled'&&r.atlasState!==17?'processing':'closed'}
export function trackingState(r:any,labels:Record<string,string>){return r.status==='cancelled'?labels.cancelled:r.tracking&&r.atlasStateName?r.atlasStateName:labels[r.status]??r.status}
export function filterTrackingOrders(rows:any[],f:TrackingFilters,labels:Record<string,string>,now=new Date()){
 const cutoff=f.updated?moroccoDay(new Date(now.getTime()-(Number(f.updated)-1)*86400000)):'';
 return rows.filter(r=>{const p=r.payload,day=moroccoDay(r.createdAt);return (f.tab==='all'||trackingGroup(r)===f.tab)&&(f.state==='all'||trackingState(r,labels)===f.state)&&(f.city==='all'||p.cityName===f.city)&&p.product.toLowerCase().includes(f.product.toLowerCase())&&[p.fullname,p.phone,p.address,p.cityName,r.tracking??'',p.product].join(' ').toLowerCase().includes(f.query.toLowerCase())&&(!f.from||day>=f.from)&&(!f.to||day<=f.to)&&(!cutoff||!!r.syncedAt&&moroccoDay(r.syncedAt)>=cutoff)});
}
