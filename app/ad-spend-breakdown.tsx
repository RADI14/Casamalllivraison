'use client';
import {useState} from 'react';
import {useI18n} from './i18n';
type Row={memberEmail:string;memberName:string;ads:number;entries:number};
export default function AdSpendBreakdown({rows}:{rows:Row[]}){
 const {t,money}=useI18n(),[agent,setAgent]=useState('all');
 const grouped=new Map<string,Row>();for(const row of rows){const key=row.memberEmail.trim().toLowerCase(),existing=grouped.get(key);if(existing){existing.ads+=row.ads;existing.entries+=row.entries}else grouped.set(key,{...row})}
 const agents=[...grouped.values()].sort((a,b)=>b.ads-a.ads),filtered=agents.filter(r=>agent==='all'||r.memberEmail===agent);
 return <section className="orders-card ad-pair-report"><div className="card-top"><div><h2>{t('Ad spend by agent')}</h2><p>{t('Period totals. Each advertising expense is counted once in business profit.')}</p></div><strong>{money(filtered.reduce((n,r)=>n+r.ads,0)/100)}</strong></div><div className="ad-pair-filters"><label>{t('Agent')}<select value={agent} onChange={e=>setAgent(e.target.value)}><option value="all">{t('Toute l’équipe')}</option>{agents.map(r=><option key={r.memberEmail} value={r.memberEmail}>{r.memberName}</option>)}</select></label></div><div className="table-wrap"><table><thead><tr><th>{t('Agent')}</th><th>{t('Ad spend')}</th></tr></thead><tbody>{filtered.map(r=><tr key={r.memberEmail}><td>{r.memberName||t('Unassigned to an agent')}</td><td className="amount">{money(r.ads/100)}</td></tr>)}</tbody></table>{!filtered.length&&<p className="empty">{t('No advertising spend for these filters.')}</p>}</div></section>
}
