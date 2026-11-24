'use client';

import {useState} from 'react';
import {useI18n} from './i18n';

type Value = {cents:number;missing:number};
type Metrics = {
 dailyDeliveries:{date:string;count:number;entered:number}[];
 undated:number;
 inventory:{stock:Value|null;stockAsOf?:number;transit:Value};
};

export default function DashboardAtlasMetrics({data}:{data:Metrics|null}){
 const {language,money,locale}=useI18n();
 const L=(fr:string,en:string,ar:string)=>language==='ar'?ar:language==='en'?en:fr;
 const deliveredLabel=L('Livrées','Delivered','تسلّمو');
 const enteredLabel=L('Saisies','Entered','تسجلو');
 const [metric,setMetric]=useState<'count'|'entered'>('count');
 const label=metric==='count'?deliveredLabel:enteredLabel;
 const color=metric==='count'?'var(--overview-delivered)':'var(--overview-entered)';
 const peak=Math.max(1,...(data?.dailyDeliveries??[]).map(row=>row[metric]));
 const stock=data?.inventory.stock,transit=data?.inventory.transit;
 const value=(row:Value|null|undefined)=>row?money(row.cents/100)+(row.missing?' *':''):'—';
 const total=stock&&transit?{cents:stock.cents+transit.cents,missing:stock.missing+transit.missing}:null;
 const stockShare=total&&total.cents>0&&!total.missing?stock!.cents/total.cents*100:null;
 const shareLabel=stockShare===null?'':L('Stock ','Stock ','الستوك ')+Math.round(stockShare)+'% · '+L('Transit ','Transit ','الترانزيت ')+(100-Math.round(stockShare))+'%';
 return <div className="settings-card dashboard-atlas-metrics">
  <section>
   <h2>{L('Commandes · 7 derniers jours','Orders · Last 7 days','الطلبات · آخر 7 أيام')}</h2>
   <div className="overview-week-legend" role="group" aria-label={L('Afficher','Show','عرض')}>
    <button type="button" className="overview-delivered-key" aria-pressed={metric==='count'} onClick={()=>setMetric('count')}>{deliveredLabel}</button>
    <button type="button" className="overview-entered-key" aria-pressed={metric==='entered'} onClick={()=>setMetric('entered')}>{enteredLabel}</button>
   </div>
   <ul className="overview-week">
    {data?.dailyDeliveries.map(row=><li key={row.date}>
      <time dateTime={row.date}>{row.date.slice(8)}/{row.date.slice(5,7)}</time>
      <span className="overview-ring-track" style={{background:`conic-gradient(${color} ${row[metric]/peak*100}%, var(--line) 0)`}}>
       <span aria-label={label+' '+row[metric]}>{row[metric]}</span>
      </span>
    </li>)}
   </ul>
   {!data&&<p>—</p>}
   {metric==='count'&&!!data?.undated&&<small>{data.undated} {L('livraisons sans date Atlas','deliveries without an Atlas date','تسليمات بلا تاريخ Atlas')}</small>}
  </section>
  <section>
   <h2>{L('Valeur au coût d’achat','Value at purchase cost','القيمة بثمن الشراء')}</h2>
   {stockShare!==null&&<div className="overview-inventory-share">
    <span className="overview-ring-track" aria-hidden="true" style={{background:`conic-gradient(var(--overview-violet) ${stockShare}%, var(--overview-amber) 0)`}}><span/></span>
    <small>{shareLabel}</small>
   </div>}
   <dl>
    <div><dt>{L('Stock Atlas disponible','Available Atlas stock','الستوك المتوفر فـ Atlas')}</dt><dd>{value(stock)}</dd></div>
    <div><dt>{L('Colis en transit','Parcels in transit','الكوليات فطريق التوصيل')}</dt><dd>{value(transit)}</dd></div>
    <div><dt>{L('Total stock + transit','Total stock + transit','مجموع الستوك والترانزيت')}</dt><dd>{value(total)}</dd></div>
   </dl>
   {!!(stock?.missing||transit?.missing)&&<small>* {L('Valeur partielle. Coûts manquants','Partial value. Missing costs','قيمة جزئية. أثمان الشراء ناقصة')} ({stock?.missing??0} stock · {transit?.missing??0} transit)</small>}
   {data?.inventory.stockAsOf&&<small>Atlas · {new Date(data.inventory.stockAsOf).toLocaleString(locale,{timeZone:'Africa/Casablanca'})}</small>}
  </section>
 </div>;
}
