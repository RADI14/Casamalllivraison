'use client';
import {useState} from 'react';
import {useI18n} from './i18n';
type Row={productId:string;memberEmail:string;productName:string;memberName:string;ads:number;entries:number};
export default function AdSpendBreakdown({rows}:{rows:Row[]}){
 const {t,money}=useI18n(),[product,setProduct]=useState('all'),[agent,setAgent]=useState('all');
 const products=[...new Map(rows.map(r=>[r.productId,r.productName])).entries()],agents=[...new Map(rows.map(r=>[r.memberEmail,r.memberName])).entries()];
 const filtered=rows.filter(r=>(product==='all'||r.productId===product)&&(agent==='all'||r.memberEmail===agent));
 return <section className="orders-card ad-pair-report"><div className="card-top"><div><h2>{t('Ad spend by product and agent')}</h2><p>{t('Period totals. Each advertising expense is counted once in business profit.')}</p></div><strong>{money(filtered.reduce((n,r)=>n+r.ads,0)/100)}</strong></div><div className="ad-pair-filters"><label>{t('Product')}<select value={product} onChange={e=>setProduct(e.target.value)}><option value="all">{t('All products')}</option>{products.map(([id,name])=><option key={id} value={id}>{t(name)}</option>)}</select></label><label>{t('Agent')}<select value={agent} onChange={e=>setAgent(e.target.value)}><option value="all">{t('Toute l’équipe')}</option>{agents.map(([id,name])=><option key={id} value={id}>{t(name)}</option>)}</select></label></div><div className="table-wrap"><table><thead><tr>{['Product','Agent','Ad spend'].map(k=><th key={k}>{t(k)}</th>)}</tr></thead><tbody>{filtered.map(r=><tr key={JSON.stringify([r.productId,r.memberEmail])}><td><b>{t(r.productName)}</b>{!r.productId&&<small>{t('Allocation required')}</small>}</td><td>{t(r.memberName)}{!r.memberEmail&&<small>{t('Allocation required')}</small>}</td><td className="amount">{money(r.ads/100)}</td></tr>)}</tbody></table>{!filtered.length&&<p className="empty">{t('No advertising spend for these filters.')}</p>}</div></section>
}
