'use client';
import {useI18n,LanguageSwitcher} from './i18n';
export default function SetupRequired(){const {t}=useI18n();return <main style={{maxWidth:680,margin:'10vh auto',padding:24}}><LanguageSwitcher/><h1>Casamall Livraison</h1><h2>{t('Hosting setup required')}</h2><p>{t('The administrator must finish configuring hosting and secure sign-in before the platform can open.')}</p></main>}
