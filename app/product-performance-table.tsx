'use client';

import {useI18n} from './i18n';
import type {productPerformance} from './product-performance';

export default function ProductPerformanceTable({report}:{report:ReturnType<typeof productPerformance>}){
 const {language,locale,money}=useI18n();
 const L=(fr:string,en:string,ar:string)=>language==='ar'?ar:language==='en'?en:fr;
 const percent=new Intl.NumberFormat(locale,{style:'percent',maximumFractionDigits:1});
 const pct=(n:number|null)=>n===null?'—':percent.format(n);
 const dh=(n:number|null)=>n===null?'—':money(n/100);
 const columns=[
  L('Produit','Product','المنتج'),L('Leads','Leads','الطلبات'),
  L('Confirmées','Confirmed','مؤكدة'),L('Confirmation','Confirmation','نسبة التأكيد'),
  L('Livrées','Delivered','موصلة'),L('Livraison','Delivery rate','نسبة التوصيل'),
  L('Pièces livrées','Delivered units','القطع الموصلة'),L('Upsell livré','Delivered upsell','الطلبات الموصلة بعدة قطع'),
  L('Surplus commission','Extra commission','العمولة الإضافية'),
  'Ads','CPL','CPD',L('Profit net','Net profit','الربح الصافي'),
  L('Profit / pièce','Profit per unit','الربح لكل قطعة'),'ROI',
  L('Seuil Ads','Ads break-even','حد الإنفاق الإعلاني'),L('CPL seuil','Break-even CPL','حد تكلفة الطلب'),
 ];
 return <section className="orders-card">
  <div className="card-top"><h2>{L('Analyse par produit','Product analysis','تحليل المنتجات')}</h2></div>
  <div className="subtle">
   <p>{L('Confirmation = confirmées / leads. Livraison = livrées / confirmées. Upsell = colis livré avec plusieurs pièces.',
    'Confirmation = confirmed / leads. Delivery = delivered / confirmed. Upsell = delivered parcel with multiple units.',
    'نسبة التأكيد من جميع الطلبات. نسبة التوصيل من الطلبات المؤكدة. الطلب متعدد القطع يُحسب بعد توصيله.')}</p>
   <p>{L('ROI = profit net / Ads. Seuil Ads = profit avant Ads sur la période. Les retours Atlas coûtent 0 DH.',
    'ROI = net profit / ad spend. Ads break-even is profit before ads for the period. Atlas returns cost 0 DH.',
    'العائد هو الربح الصافي مقسوماً على مصاريف الإعلانات. حد الإنفاق هو الربح قبل الإعلانات خلال الفترة. مرتجعات أطلس مجانية.')}</p>
   <p>{L('Pour calculer le CPL, le CPD et le profit net, associez une dépense au produit dans Dépenses publicitaires.',
    'To calculate CPL, CPD and net profit, assign ad spend to the product in Ad spend.',
    'لحساب تكلفة الطلب والتوصيل والربح الصافي، اربط مصروف الإعلان بالمنتج في قسم الإعلانات.')}</p>
   <p>{L('Les indicateurs après Ads utilisent les dépenses rattachées au produit. Les charges communes restent dans le résultat global.',
    'After-ads metrics use spend assigned to the product. Shared expenses stay in the overall result.',
    'المؤشرات بعد الإعلانات تعتمد على المصاريف المرتبطة بالمنتج. المصاريف المشتركة تدخل في النتيجة الإجمالية.')}
   {' '}{L('Ads sans produit','Ads without a product','إعلانات بدون منتج')} · <b>{dh(report.unassignedAds)}</b></p>
  </div>
  {report.rows.length?<div className="table-wrap"><table>
   <thead><tr>{columns.map(label=><th key={label} scope="col">{label}</th>)}</tr></thead>
   <tbody>{report.rows.map(p=><tr key={p.id}>
    <td><b>{p.name}</b><small>{p.sku}</small></td>
    <td>{p.leads}</td><td>{p.confirmed}</td><td>{pct(p.confirmationRate)}</td>
    <td>{p.delivered}</td><td>{pct(p.deliveryRate)}</td><td>{p.units}</td>
    <td>{p.upsells}<small>{pct(p.upsellRate)}</small></td><td>{dh(p.upsellCommission)}</td>
    <td>{dh(p.spend)}</td><td>{dh(p.cpl)}</td><td>{dh(p.cpd)}</td>
    <td className="amount">{dh(p.profit)}</td><td>{dh(p.profitPerPiece)}</td><td>{pct(p.roi)}</td>
    <td>{dh(p.breakEvenAds)}</td><td>{dh(p.breakEvenCpl)}</td>
   </tr>)}</tbody>
  </table></div>:<p className="empty">{L('Aucune donnée pour cette période.','No data for this period.','لا توجد بيانات خلال هذه الفترة.')}</p>}
 </section>;
}
