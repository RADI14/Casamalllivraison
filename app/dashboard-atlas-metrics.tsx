'use client';

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
 const stock=data?.inventory.stock,transit=data?.inventory.transit;
 const value=(row:Value|null|undefined)=>row?money(row.cents/100)+(row.missing?' *':''):'—';
 const total=stock&&transit?{cents:stock.cents+transit.cents,missing:stock.missing+transit.missing}:null;
 const stockShare=total&&total.cents>0&&!total.missing?stock!.cents/total.cents*100:null;
 const shareLabel=stockShare===null?'':L('Stock ','Stock ','الستوك ')+Math.round(stockShare)+'% · '+L('Transit ','Transit ','الترانزيت ')+(100-Math.round(stockShare))+'%';
 return <div className="settings-card dashboard-atlas-metrics">
  <section>
   <h2>{L('Commandes par jour','Orders by day','الطلبات حسب النهار')}</h2>
   <div className="overview-week-legend">
    <span className="overview-delivered-key">{deliveredLabel}</span>
    <span className="overview-entered-key">{enteredLabel}</span>
   </div>
   <ul className="overview-week">
    {data?.dailyDeliveries.map(row=>{
     const total=row.count+row.entered;
     const share=total?row.count/total*100:0;
     return <li key={row.date}>
      <time dateTime={row.date}>{row.date.slice(8)}/{row.date.slice(5,7)}</time>
      <span className="overview-ring-track" aria-hidden="true" style={{background:total?`conic-gradient(var(--overview-delivered) ${share}%, var(--overview-entered) 0)`:'var(--line)'}}><span/></span>
      <span className="overview-week-counts">
       <b className="overview-delivered-key" aria-label={deliveredLabel+' '+row.count}>{row.count}</b>
       <b className="overview-entered-key" aria-label={enteredLabel+' '+row.entered}>{row.entered}</b>
      </span>
     </li>;
    })}
   </ul>
   {!data&&<p>—</p>}
   {!!data?.undated&&<small>{data.undated} {L('livraisons sans date Atlas','deliveries without an Atlas date','تسليمات بلا تاريخ Atlas')}</small>}
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
