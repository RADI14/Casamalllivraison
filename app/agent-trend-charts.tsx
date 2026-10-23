'use client';
import {useEffect,useRef,useState} from 'react';
import {Activity,RefreshCw} from 'lucide-react';
import {useI18n} from './i18n';
import {Trend} from './business-charts';
import {moroccoDay} from './team-statistics';
import type {AgentDailyTrends} from './agent-daily-trends';
import './agent-trend-charts.css';
export default function AgentTrendCharts(){
 const {language,locale,t}=useI18n(),L=(fr:string,en:string,ar:string)=>language==='ar'?ar:language==='en'?en:fr;
 const percent=(delivered:number,orders:number)=>orders?new Intl.NumberFormat(locale,{maximumFractionDigits:1}).format(delivered/orders*100)+' %':'—';
 const enteredLabel=L('Saisies','Entered','مسجلة'),deliveredLabel=L('Livrées','Delivered','مسلّمة'),rateLabel=L('Taux livraison','Delivery rate','نسبة التوصيل');
 const [data,setData]=useState<AgentDailyTrends|null>(null),[end,setEnd]=useState(()=>moroccoDay(new Date())),[agent,setAgent]=useState('all'),[metric,setMetric]=useState('orders'),[error,setError]=useState(''),[loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0);
 const sequence=useRef(0),today=moroccoDay(new Date());
 useEffect(()=>{const request=++sequence.current,controller=new AbortController();let alive=true;
  async function load(){setLoading(true);setError('');try{const r=await fetch('/api/team-trends?'+new URLSearchParams({to:end}),{cache:'no-store',signal:controller.signal});const j=await r.json() as AgentDailyTrends&{error?:string};if(!r.ok)throw Error(j.error||'Chargement impossible.');if(alive&&request===sequence.current)setData(j)}catch(e){if(alive&&request===sequence.current){setData(null);setError((e as Error).message)}}finally{if(alive&&request===sequence.current)setLoading(false)}}
  load();const timer=setInterval(load,60000);return()=>{alive=false;controller.abort();clearInterval(timer)};
 },[end,refresh]);
 const labels:Record<string,string>={orders:L('Saisies / Livrées','Entered / Delivered','مسجلة / مسلّمة'),delivered:t('Delivered orders'),revenue:t('Delivered sales'),net:t('Profit after assigned ads')};
 const people=(data?.members??[]).filter(m=>(agent==='all'||m.email===agent)&&(!m.deletedAt||m.totals.orders>0||m.totals.revenue>0||m.points.some(p=>p.net!==null)));
 return <section className="business-analytics agent-trends" aria-label={L('Courbes par collaboratrice','Daily agent trends','منحنيات كل بنت')} aria-busy={loading}>
  <div className="analytics-section-title"><div><span><Activity size={16}/>{L('Évolution par collaboratrice','Agent trends','تطور النتائج ديال كل بنت')}</span><h2>{L('Commandes par jour · 10 derniers jours','Orders per day · last 10 days','عدد الطلبات كل نهار · آخر 10 أيام')}</h2><p>{L('10 jours jusqu’à la date choisie, incluse. Actualisation chaque minute.','10 days through the selected date, inclusive. Refreshed every minute.','10 أيام حتى للتاريخ المختار داخل معاهم. كيتحدّث كل دقيقة.')}</p></div><button disabled={loading||!end} aria-label={t('Refresh')} onClick={()=>setRefresh(v=>v+1)}><RefreshCw size={16}/></button></div>
  <div className="agent-trend-controls"><label>{L('Jusqu’au','Through','حتى لنهار')}<input type="date" required max={today} value={end} onChange={e=>{if(e.target.value&&e.target.value<=today){setData(null);setEnd(e.target.value)}}}/></label><label>{t('Collaboratrice')}<select value={agent} onChange={e=>setAgent(e.target.value)}><option value="all">{t('Toute l’équipe')}</option>{data?.members.map(m=><option key={m.email} value={m.email}>{m.name}</option>)}</select></label><label>{L('Indicateur','Metric','المؤشر')}<select value={metric} onChange={e=>setMetric(e.target.value)}>{Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><button onClick={()=>{setEnd(today);setRefresh(v=>v+1)}}>{L('10 derniers jours','Last 10 days','آخر 10 أيام')}</button>{data&&<span className="analytics-period">{data.start} → {data.end}</span>}</div>
  <details className="agent-trend-notes"><summary>{L('Comment lire ces chiffres ?','How to read these figures','كيفاش نقرا هاد الأرقام؟')}</summary><p className="analytics-method">{L('Les points suivent la date de création des commandes. Les ventes et livraisons utilisent le dernier statut Atlas : ce n’est pas la date réelle de livraison. Le profit déduit les charges affectées ; une coupure indique des coûts ou une publicité non renseignés. Ce bloc garde sa propre période de 10 jours.','Points follow order creation dates. Sales and deliveries use the latest Atlas state, not the actual delivery date. Profit deducts assigned costs; gaps mean incomplete costs or missing ad entries. This section has its own 10-day period.','النقط حسب نهار تسجيل الطلب. المبيعات والتوصيلات حسب آخر حالة فـ Atlas، ماشي نهار التسليم الفعلي. الربح كينقص المصاريف المنسوبة؛ الفراغ كيعني المصاريف أو الإعلانات ناقصين. هاد الجزء عندو فترة ديالو ديال 10 أيام.')}</p>
  <p className="analytics-chart-note">{L('Pourcentage = livrées ÷ saisies × 100. Sans saisie : —. Les saisies incluent les brouillons et annulations.','Percentage = delivered ÷ entered × 100. No entries: —. Entries include drafts and cancellations.','النسبة = المسلّمة ÷ المسجلة × 100. بلا طلبات: —. المسجلة كتضم المسودات والملغاة.')}</p>
  </details>
  {error&&<div role="alert" className="alert danger">{t(error)}</div>}{loading&&!data&&<p role="status">{t('Chargement…')}</p>}
  <div className="business-chart-grid">{people.map(m=><article className="analytics-panel" key={m.email}>
   <div className="analytics-heading"><div><h3>{m.name}</h3><p>{labels[metric]}{m.deletedAt?' · '+L('Compte supprimé','Removed account','حساب محذوف'):m.active===0?' · '+t('Compte suspendu'):''}</p></div><span className="avatar">{m.name.slice(0,1).toUpperCase()}</span></div>
   <div className="agent-trend-totals"><span className="metric-entered">{enteredLabel}<b>{m.totals.orders}</b></span><span className="metric-delivered">{deliveredLabel}<b>{m.totals.delivered}</b></span><span className="metric-rate">{rateLabel}<b>{percent(m.totals.delivered,m.totals.orders)}</b></span></div>
   <div className="agent-daily-counts agent-daily-delivery" role="list" aria-label={L('Saisies, livrées et pourcentage par jour','Entered, delivered and percentage per day','المسجلة والمسلّمة والنسبة كل نهار')}>{m.points.map(p=><div role="listitem" key={p.date}>
    <time dateTime={p.date}>{p.date.slice(8)}/{p.date.slice(5,7)}</time>
    <span className="metric-entered"><small>{enteredLabel}</small><b>{p.orders}</b></span><span className="metric-delivered"><small>{deliveredLabel}</small><b>{p.delivered}</b></span><span className="metric-rate"><small>{L('Taux','Rate','النسبة')}</small><b>{percent(p.delivered,p.orders)}</b></span>
   </div>)}</div>
   <Trend key={metric} rows={m.points} currency={metric==='revenue'||metric==='net'} series={metric==='orders'?[{key:'orders',label:enteredLabel,color:'#8c72e8'},{key:'delivered',label:deliveredLabel,color:'#29b89a'}]:[{key:metric,label:labels[metric],color:metric==='net'?'#29b89a':'#8c72e8'}]}/>
  </article>)}</div>
  {!loading&&!error&&!people.length&&<p className="analytics-empty">{t('No data in this period.')}</p>}
 </section>;
}
