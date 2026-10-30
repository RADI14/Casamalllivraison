'use client';
import ProductPhoto from './product-photo';
import {useI18n} from './i18n';
import './simple-order-list.css';
export default function SimpleOrderList({rows,labels}:{rows:any[];labels:Record<string,string>}){
 const {t,money,locale,language}=useI18n();
 const author=(r:any)=>r.createdBy?.trim()||r.createdEmail?.trim()||(language==='ar'?'غير محددة':language==='en'?'Unknown':'Non renseignée');
 const authorLabel=language==='ar'?'دخلاتها':language==='en'?'Entered by':'Saisie par';
 const state=(r:any)=><span className={'status '+(r.status==='cancelled'?'cancelled':r.atlasState===17?'delivered':r.status)}>{r.status==='cancelled'?t(labels.cancelled):r.tracking&&r.atlasStateName?t(r.atlasStateName):t(labels[r.status])}</span>;
 const date=(r:any)=>new Date(r.createdAt).toLocaleDateString(locale,{timeZone:'Africa/Casablanca'});
 return <div className="simple-colis-list"><div className="simple-colis-mobile">{rows.map(r=><article className="simple-colis-card" key={r.id}>
 <header><b dir="auto">{r.payload.fullname}</b>{state(r)}</header><div className="simple-colis-contact"><a href={'tel:'+r.payload.phone}>{r.payload.phone}</a><span dir="auto">{r.payload.cityName}</span></div><div className="simple-colis-product"><ProductPhoto sku={r.payload.atlasSku||r.photoSku} name={r.payload.product}/><p dir="auto">{r.payload.product} <b>× {r.payload.quantity}</b></p></div><div className="simple-colis-author"><span>{authorLabel}</span><b dir="auto">{author(r)}</b></div><footer><span><b className="simple-colis-code">{r.tracking??t('Brouillon')}</b><small>{date(r)}</small></span><strong>{money(r.payload.price)}</strong></footer>
 </article>)}</div><div className="table-wrap simple-colis-desktop"><table><thead><tr>{['Code Atlas','Client','Ville','PRODUIT','MONTANT COD','STATUT / LIVRAISON'].map(k=><th key={k}>{t(k)}</th>)}<th>{authorLabel}</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}>
 <td><b className="simple-colis-code">{r.tracking??t('Brouillon')}</b><small>{date(r)}</small></td><td><b dir="auto">{r.payload.fullname}</b><a className="simple-colis-phone" href={'tel:'+r.payload.phone}>{r.payload.phone}</a></td><td dir="auto">{r.payload.cityName}</td><td><div className="simple-colis-product"><ProductPhoto sku={r.payload.atlasSku||r.photoSku} name={r.payload.product}/><div><span dir="auto">{r.payload.product}</span><small>{language==='ar'?'الكمية':language==='en'?'Quantity':'Quantité'}: {r.payload.quantity}</small></div></div></td><td className="amount">{money(r.payload.price)}</td><td>{state(r)}</td><td><b className="simple-colis-author-name" dir="auto">{author(r)}</b></td>
 </tr>)}</tbody></table></div></div>;
}
