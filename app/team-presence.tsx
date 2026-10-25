'use client';
import {createContext,useContext,useEffect,useState} from 'react';
import {useI18n} from './i18n';
import {presenceTimeoutMs,type Presence} from './presence-rules';
import './team-presence.css';
const Context=createContext<{members:Presence[]|null;now:number}>({members:null,now:0});
export function TeamPresenceProvider({enabled,children}:{enabled:boolean;children:React.ReactNode}){
 const [data,setData]=useState<{members:Presence[];asOf:number;received:number}|null>(null),[clock,setClock]=useState(0);
 useEffect(()=>{
  if(!enabled)return;let alive=true,busy=false;const controller=new AbortController();
  async function load(){if(busy||document.visibilityState==='hidden')return;busy=true;try{const r=await fetch('/api/presence',{cache:'no-store',signal:controller.signal}),j:any=await r.json();if(!r.ok||!Array.isArray(j.members)||!Number.isFinite(j.asOf))throw Error();if(alive){setData({...j,received:Date.now()});setClock(Date.now())}}catch{if(alive)setData(null)}finally{busy=false}}
  void load();const poll=setInterval(load,30000),tick=setInterval(()=>setClock(Date.now()),15000);document.addEventListener('visibilitychange',load);window.addEventListener('focus',load);
  return()=>{alive=false;controller.abort();clearInterval(poll);clearInterval(tick);document.removeEventListener('visibilitychange',load);window.removeEventListener('focus',load)};
 },[enabled]);
 return <Context.Provider value={{members:data?.members??null,now:data?data.asOf+Math.max(0,clock-data.received):0}}>{children}</Context.Provider>;
}
export default function MemberPresence({email}:{email:string}){
 const {members,now}=useContext(Context),{language,locale}=useI18n();const L=(fr:string,en:string,ar:string)=>language==='ar'?ar:language==='en'?en:fr;
 const row=members?.find(m=>m.email===email);
 if(!row)return <span className="member-presence unknown">{L('Activité indisponible','Activity unavailable','النشاط غير متوفر')}</span>;
 const online=row.online&&row.lastSeen!==null&&now-row.lastSeen<presenceTimeoutMs;
 const minutes=row.startedAt===null?0:Math.max(0,Math.floor((now-row.startedAt)/60000)),hours=Math.floor(minutes/60);
 const duration=hours?`${hours} h ${minutes%60} min`:`${minutes} min`;
 return <span className={'member-presence '+(online?'online':'offline')}><span><i aria-hidden="true"/>{L(online?'En ligne':'Hors ligne',online?'Online':'Offline',online?'متصلة':'غير متصلة')}</span><small>{online?L('Active depuis ','Active for ','نشطة منذ ')+(minutes?duration:L('moins d’une minute','less than a minute','أقل من دقيقة')):row.lastSeen?L('Dernière activité : ','Last seen: ','آخر نشاط: ')+new Date(row.lastSeen).toLocaleString(locale,{timeZone:'Africa/Casablanca',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):L('Aucune activité enregistrée','No activity recorded','ما تسجل حتى نشاط')}</small></span>;
}
