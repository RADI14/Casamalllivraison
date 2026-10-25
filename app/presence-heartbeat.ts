'use client';
import {useEffect} from 'react';
import {presenceHeartbeatMs,presenceIdleMs} from './presence-rules.ts';

export function startPresenceHeartbeat(doc:Document,win:Window,send:()=>Promise<unknown>,clock=Date.now){
 let lastInput=clock(),lastSent=0,inFlight=false,stopped=false;
 const input=()=>{lastInput=clock();void beat()};
 async function beat(){
  const now=clock();if(stopped||inFlight||doc.visibilityState!=='visible'||now-lastInput>=presenceIdleMs||now-lastSent<presenceHeartbeatMs)return;
  lastSent=now;inFlight=true;try{await send()}catch{}finally{inFlight=false}
 }
 const visible=()=>{if(doc.visibilityState==='visible')input()};
 for(const event of ['pointerdown','keydown','scroll','touchstart'])win.addEventListener(event,input,{passive:true});
 doc.addEventListener('visibilitychange',visible);win.addEventListener('focus',input);
 const timer=win.setInterval(()=>void beat(),presenceHeartbeatMs);void beat();
 return()=>{stopped=true;win.clearInterval(timer);for(const event of ['pointerdown','keydown','scroll','touchstart'])win.removeEventListener(event,input);doc.removeEventListener('visibilitychange',visible);win.removeEventListener('focus',input)};
}
export function usePresenceHeartbeat(){useEffect(()=>{const controller=new AbortController();const stop=startPresenceHeartbeat(document,window,()=>fetch('/api/presence',{method:'POST',cache:'no-store',signal:controller.signal}));return()=>{stop();controller.abort()}},[])}
