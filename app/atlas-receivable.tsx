'use client';

import {useEffect, useState} from 'react';
import {Wallet} from 'lucide-react';
import {useI18n} from './i18n';

type Receivable = {
 snapshot: {asOf: string; count: number; grossCents: number; feesCents: number; netCents: number} | null;
 refreshing: boolean;
 unavailable: boolean;
};

export default function AtlasReceivable() {
 const {language, money, locale} = useI18n();
 const L = (fr: string, en: string, ar: string) => language === 'ar' ? ar : language === 'en' ? en : fr;
 const [data, setData] = useState<Receivable | null>(null);
 const [networkError, setNetworkError] = useState(false);

 useEffect(() => {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  async function load() {
   let delay = 60_000;
   try {
    if (document.visibilityState === 'hidden') return;
    const response = await fetch('/api/atlas-receivable', {cache: 'no-store', signal: controller.signal});
    if (!response.ok) throw new Error('Atlas receivable unavailable');
    const next: Receivable = await response.json();
    setData(next);
    setNetworkError(false);
    if (next.refreshing) delay = 5_000;
   } catch {
    if (!controller.signal.aborted) setNetworkError(true);
   } finally {
    if (!controller.signal.aborted) timer = setTimeout(load, delay);
   }
  }
  void load();
  return () => { controller.abort(); clearTimeout(timer); };
 }, []);

 const balance = data?.snapshot;
 const unavailable = networkError || data?.unavailable;
 const title = L('À recevoir d’Atlas', 'Receivable from Atlas', 'شحال باقي خاص Atlas يدوّز ليك');
 return <section className="settings-card atlas-receivable" aria-label={title}>
  <div className="card-top"><h2><Wallet size={20}/> {title}</h2></div>
  <strong className="atlas-receivable-amount">{balance ? money(balance.netCents / 100) : '—'}</strong>
  <p>{L('Colis livrés et non facturés, toutes périodes.', 'Delivered, unbilled parcels across all dates.', 'الكوليات المسلّمة اللي مازال ما تفوتروش، جميع الفترات.')}</p>
  {balance && <>
   <p>{L('Colis : ', 'Parcels: ', 'الكوليات: ')}<b>{balance.count}</b> · COD <b>{money(balance.grossCents / 100)}</b> · {L('Frais : ', 'Fees: ', 'المصاريف: ')}<b>{money(balance.feesCents / 100)}</b></p>
   <small>{L('Dernier calcul : ', 'Last calculated: ', 'آخر حساب: ')}{new Date(balance.asOf).toLocaleString(locale, {timeZone: 'Africa/Casablanca'})}</small>
  </>}
  {unavailable
   ? <p role="status">{L('Actualisation Atlas indisponible. Nouvelle tentative automatique.', 'Atlas refresh unavailable. Retrying automatically.', 'تحديث Atlas ما خدامش دابا. غادي نعاودو تلقائياً.')}</p>
   : (!data || data.refreshing) && <p role="status">{L('Calcul Atlas en cours…', 'Calculating Atlas receivables…', 'الحساب ديال Atlas كيتوجد…')}</p>}
 </section>;
}
