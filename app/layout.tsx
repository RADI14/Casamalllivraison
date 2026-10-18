import type { Metadata,Viewport } from 'next';
import './globals.css';
import './atlas-theme.css';
import './mobile.css';
import './fastlivraison.css';
import './dark-theme.css';
import {LanguageProvider} from './i18n';
export const metadata: Metadata = {title:'fastlivraison — Espace équipe',description:'Votre espace de saisie et suivi des commandes COD.'};
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="fr"><body><LanguageProvider>{children}</LanguageProvider></body></html>}
