'use client';

import {useI18n} from './i18n';

type Value = {cents:number;missing:number};
type Metrics = {
 dailyDeliveries:{date:string;count:number}[];
 undated:number;
 inventory:{stock:Value|null;stockAsOf?:number;transit:Value};
};

export default function DashboardAtlasMetrics({data}:{data:Metrics|null}){
 const {language,money,locale}=useI18n();
 const L=(fr:string,en:string,ar:string)=>language==='ar'?ar:language==='en'?en:fr;
 const peak=Math.max(1,...(data?.dailyDeliveries??[]).map(row=>row.count));
 const stock=data?.inventory.stock,transit=data?.inventory.transit;
 const value=(row:Value|null|undefined)=>row?money(row.cents/100)+(row.missing?' *':''):'—';
 const total=stock&&transit?{cents:stock.cents+transit.cents,missing:stock.missing+transit.missing}:null;
 return <div className="settings-card dashboard-atlas-metrics">
  <section>
   <h2>{L('Commandes livrées par jour','Delivered orders by day','الطلبات المسلّمة فالنهار')}</h2>
   <dl className="overview-delivery-chart">{data?.dailyDeliveries.map(row=><div key={row.date}>
    <dt><time dateTime={row.date}>{row.date.slice(8)}/{row.date.slice(5,7)}</time></dt>
    <dd><span aria-hidden="true" className="overview-delivery-track"><span style={{inlineSize:`${row.count/peak*100}%`}}/></span><b>{row.count}</b></dd>
   </div>)}</dl>
   {!data&&<p>—</p>}
   {!!data?.undated&&<small>{data.undated} {L('livraisons sans date Atlas','deliveries without an Atlas date','تسليمات بلا تاريخ Atlas')}</small>}
  </section>
  <section>
   <h2>{L('Valeur au coût d’achat','Value at purchase cost','القيمة بثمن الشراء')}</h2>
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
