'use client';
import {useState} from 'react';
import {X} from 'lucide-react';
import {useI18n} from './i18n';
import {editableFields} from './order-edit-rules';
export default function OrderEdit({order,atlas,onClose,onSaved}:{order:any;atlas:any;onClose:()=>void;onSaved:()=>Promise<void>}){
 const {t}=useI18n(),[value,setValue]=useState({...order.payload}),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const stock=!!order.payload.stockItems?.length;
 function field(key:string,v:any){setValue((previous:any)=>({...previous,[key]:v}))}
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{const changes=Object.fromEntries(editableFields.filter(k=>value[k]!==order.payload[k]).map(k=>[k,value[k]]));const r=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'edit',id:order.id,expectedUpdatedAt:order.updatedAt,changes})});const j:any=await r.json();if(!r.ok)throw Error(j.error??'Erreur de modification');await onSaved()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <div className="overlay"><section className="modal order-entry-modal" role="dialog" aria-modal="true" aria-labelledby="edit-order-title"><div className="modal-head"><div><h2 id="edit-order-title">{t('Modifier colis')}</h2><p>{order.tracking}</p></div><button disabled={busy} onClick={onClose} aria-label={t('Fermer')}><X/></button></div><form className="atlas-order-form" onSubmit={save}><p>{t('Modifications enregistrées dans Atlas et la plateforme. Disponible uniquement au statut Nouveau.')}</p><fieldset disabled={busy} style={{border:0,padding:0,margin:0,minWidth:0}}><div className="atlas-form-grid">
 {(['fullname','phone','phone2'] as const).map((key,i)=><label className="span-3" key={key}>{t(['Recipient','Téléphone','Phone 2'][i])}<input required={key!=='phone2'} type={key==='fullname'?'text':'tel'} maxLength={1000} value={value[key]??''} onChange={e=>field(key,e.target.value)}/></label>)}
 <label className="span-3">{t('Price (DH)')}<input required type="number" min={1} max={1000000} step={1} value={value.price} onChange={e=>field('price',Number(e.target.value))}/></label>
 <label className="span-6">{t('Ville')}<select required value={value.cityId} onChange={e=>field('cityId',e.target.value)}>{!(atlas.cities??[]).some((c:any)=>c.id===value.cityId)&&<option value={value.cityId}>{value.cityName||value.cityId}</option>}{(atlas.cities??[]).map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
 <label className="span-6">{t('Adresse')}<textarea required minLength={10} maxLength={1000} rows={2} value={value.address} onChange={e=>field('address',e.target.value)}/></label>
 <label className="span-3">{t('Produit')}<input required readOnly={stock} maxLength={1000} value={value.product} onChange={e=>field('product',e.target.value)}/></label><label className="span-3">{t('Quantité')}<input required readOnly={stock} type="number" min={1} max={1000} step={1} value={value.quantity} onChange={e=>field('quantity',Number(e.target.value))}/></label>
 {stock&&<p className="span-6 order-form-help">{t('Pour un colis sur stock, modifiez le produit et la quantité directement dans Atlas, puis synchronisez.')}</p>}
 <label className="span-6">{t('Note')}<textarea rows={2} maxLength={1000} value={value.note??''} onChange={e=>field('note',e.target.value)}/></label>
 {(atlas.stores??[]).length>1&&<label className="span-6">{t('Boutique Atlas')}<select value={value.storeId??''} onChange={e=>field('storeId',e.target.value)}><option value="">{t('Choisir la boutique')}</option>{atlas.stores.map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
 </div><div className="parcel-options">{[['openpackage','Open parcel'],['allowtry','Try on']].map(([key,label])=><label key={key}><input type="checkbox" checked={!!value[key]} onChange={e=>field(key,e.target.checked)}/>{t(label)}</label>)}</div></fieldset>
 {error&&<div className="alert danger" role="alert">{t(error)}</div>}<div className="modal-actions"><button type="button" disabled={busy} onClick={onClose}>{t('Cancel')}</button><button className="primary" disabled={busy}>{t(busy?'Saving…':'Enregistrer les modifications')}</button></div></form></section></div>
}
