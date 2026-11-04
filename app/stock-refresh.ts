/** Refresh visible stock independently of parcel synchronisation. */
export function startStockRefresh(refresh:()=>Promise<void>,immediate=true,environment={window,document},intervalMs=30000){
 let stopped=false,running=false,failures=0;
 let retry:number|undefined;
 const cancelRetry=()=>{if(retry!==undefined){environment.window.clearTimeout(retry);retry=undefined}};
 const run=async()=>{
  if(stopped||running||environment.document.visibilityState==='hidden')return;
  cancelRetry();running=true;
  try{await refresh();failures=0}catch{
   failures++;
   if(!stopped)retry=environment.window.setTimeout(()=>{retry=undefined;void run()},Math.min(30000,failures*10000));
  }finally{running=false}
 };
 const timer=environment.window.setInterval(run,intervalMs);
 environment.window.addEventListener('focus',run);
 environment.document.addEventListener('visibilitychange',run);
 if(immediate)void run();
 return()=>{stopped=true;cancelRetry();environment.window.clearInterval(timer);environment.window.removeEventListener('focus',run);environment.document.removeEventListener('visibilitychange',run)};
}
