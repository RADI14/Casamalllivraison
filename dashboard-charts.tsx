'use client';
import {useId} from 'react';
import {ChartPie} from 'lucide-react';
import {useI18n} from './i18n';
import {dashboardChartRows,circleProgress} from './dashboard-chart-rules';
function Circle({value,label,progress,color,estimated=false}:{value:string;label:string;progress?:number|null;color:string;estimated?:boolean}){
 return <div className="metric-circle" style={{color}}><svg viewBox="0 0 120 120" aria-hidden="true"><circle className="circle-track" cx="60" cy="60" r="51" fill="none" strokeWidth="9"/>{progress===undefined?<circle cx="60" cy="60" r="51" fill="none" stroke="currentColor" strokeWidth="9" opacity=".35"/>:progress!==null&&<circle cx="60" cy="60" r="51" fill="none" stroke="currentColor" strokeWidth="9" pathLength="100" strokeDasharray={progress+' 100'} transform="rotate(-90 60 60)"/>}</svg><div className="circle-value"><strong>{estimated?'≈ ':''}{value}</strong><small>{label}</small></div></div>;
}
function CirclePanel({title,description,children}:{title:string;description:string;children:React.ReactNode}){const id=useId();return <figure className="orders-card circle-panel" aria-labelledby={id}><figcaption className="card-top"><div><h2 id={id}>{title}</h2><p>{description}</p></div><ChartPie size={19}/></figcaption>{children}</figure>}
export default function DashboardCharts({members,loading,onOpen}:{members:any[];loading:boolean;onOpen:(email:string)=>void}){
 const {t,money,locale}=useI18n(),rows=dashboardChartRows(members),num=(v:number|null)=>v===null?'—':new Intl.NumberFormat(locale,{maximumFractionDigits:1}).format(v),cash=(v:number|null)=>v===null?'—':money(v);
 const name=(r:typeof rows[number])=><button className="circle-agent" onClick={()=>onOpen(r.id)}>{r.name}</button>;
 const foot=<div className="chart-footnote">{t('— = missing data, not zero. Click an agent’s name to view her orders.')}</div>;
 if(!rows.length)return <section className="orders-card chart-empty"><ChartPie size={30}/><h2>{t('Team charts')}</h2><p>{loading?t('Chargement…'):t('Charts appear when team accounts are added. No sample data is displayed.')}</p></section>;
 return <div className="dashboard-charts circle-dashboard">
 <CirclePanel title={t('Orders vs deliveries by agent')} description={t('The green arc shows delivered orders as a share of all entered orders.')}><div className="circle-tiles">{rows.map(r=><div className="circle-tile" key={r.id}>{name(r)}<Circle value={num(r.orders)} label={t('Leads / orders entered')} progress={circleProgress(r.delivered,r.orders)} color="#16b987"/><p><b>{num(r.delivered)}</b> {t('Delivered orders')} / {num(r.orders)}</p></div>)}</div>{foot}</CirclePanel>
 <CirclePanel title={t('Profit by agent')} description={t('Money amounts, not percentages. Red indicates a loss; ≈ includes estimated transport.')}><div className="circle-tiles">{rows.map(r=><div className="circle-tile" key={r.id}>{name(r)}<Circle value={cash(r.profit)} label={t('Profit after assigned ads')} color={r.profit!==null&&r.profit<0?'#e34460':'#8656e8'} estimated={r.estimated&&r.profit!==null}/></div>)}</div>{foot}</CirclePanel>
 <CirclePanel title={t('Acquisition cost by agent')} description={t('CPL and cost per delivered order in DH, displayed as circular indicators.')}><div className="circle-tiles acquisition-circles">{rows.map(r=><div className="circle-tile" key={r.id}>{name(r)}<div className="circle-pair"><Circle value={cash(r.cpl)} label={t('Cost per lead')} color="#e89724"/><Circle value={cash(r.cpd)} label={t('Ad cost per delivered order')} color="#13a9c4"/></div></div>)}</div>{foot}</CirclePanel>
 <CirclePanel title={t('Delivery rate by agent')} description={t('Delivered orders / orders transmitted to Atlas.')}><div className="circle-tiles">{rows.map(r=><div className="circle-tile" key={r.id}>{name(r)}<Circle value={r.rate===null?'—':num(r.rate)+' %'} label={t('Taux de livraison')} progress={circleProgress(r.rate,100)} color="#2563eb"/></div>)}</div>{foot}</CirclePanel>
 </div>;
}
