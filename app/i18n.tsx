'use client';
import {createContext,useContext,useEffect,useState} from 'react';
import {translations} from './translations';
import './railway-translations';
import './whatsapp-translations';
import './expense-translations';
export type Language='fr'|'en'|'ar';
const locales={fr:'fr-MA',en:'en-GB',ar:'ar-MA'};
export function translate(text:string,language:Language){const entry=translations[text];return entry?.[language]??text}
const Context=createContext({language:'fr' as Language,locale:'fr-MA',setLanguage:(_v:Language)=>{},t:(v:string)=>v,money:(n:number)=>n+' DH'});
export function LanguageProvider({children}:{children:React.ReactNode}){const [language,setLanguage]=useState<Language>('fr');useEffect(()=>{const saved=localStorage.getItem('commande-language');if(saved==='fr'||saved==='en'||saved==='ar')setLanguage(saved)},[]);useEffect(()=>{document.documentElement.lang=language;document.documentElement.dir=language==='ar'?'rtl':'ltr';localStorage.setItem('commande-language',language)},[language]);const locale=locales[language];return <Context.Provider value={{language,locale,setLanguage,t:v=>translate(v,language),money:n=>new Intl.NumberFormat(locale,{maximumFractionDigits:2,minimumFractionDigits:0}).format(n)+' '+(language==='ar'?'درهم':'DH')}}>{children}</Context.Provider>}
export const useI18n=()=>useContext(Context);
export function LanguageSwitcher(){const {language,setLanguage,t}=useI18n();return <select className="language-switcher" aria-label={t('Language')} value={language} onChange={e=>setLanguage(e.target.value as Language)}><option value="fr">Français</option><option value="en">English</option><option value="ar">العربية</option></select>}
