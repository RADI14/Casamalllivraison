'use client';
import {useI18n,LanguageSwitcher} from './i18n';
export default function AccessDenied(){const {t}=useI18n();return <main><LanguageSwitcher/><h1>{t('Access denied')}</h1><p>{t('This account has no active subaccount. Contact your administrator.')}</p><a href='/signout-with-chatgpt?return_to=/'>{t('Switch account')}</a></main>}
