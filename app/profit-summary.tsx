'use client';
import {useEffect,useState} from 'react';
import {ArrowUpRight} from 'lucide-react';
import BusinessCharts from './business-charts';
import FinanceOverview from './finance-overview';
import AdSpendBreakdown from './ad-spend-breakdown';
import {useI18n} from './i18n';
export default function ProfitSummary({from,to,onOpen,onOpenAgent}:{from:string;to:string;onOpen:()=>void;onOpenAgent?:(id:string)=>void}){const {t,money}=useI18n();const [data,setData]=useState<any>(null),[error,setError]=useState('');useEffect(()=>{let current=true;setData(null);setError('');async function load(){try{const r=await fetch('/api/finance?'+new URLSearchParams({from,to}));const j:any=await r.json();if(!r.ok)throw Error(j.error);if(current){setData(j);setError('')}}catch(e){if(current)setError((e as Error).message)}}load();const interval=setInterval(load,60000);return()=>{current=false;clearInterval(interval)}},[from,to]);return <section className="profit-overview"><div className="card-top"><h2>{t('Business profit')}</h2><button onClick={onOpen}>{t('View finance')}<ArrowUpRight size={16}/></button></div>{error?<div className="alert danger">{t(error)}</div>:data?<><FinanceOverview data={data} summaryOnly/><details className="simple-details"><summary>{t("Business analytics")} · {t("Ad spend")}</summary><BusinessCharts data={data} onOpenAgent={onOpenAgent}/><AdSpendBreakdown rows={data.adBreakdown??[]}/></details></>:<p>{t('Chargement…')}</p>}</section>}
