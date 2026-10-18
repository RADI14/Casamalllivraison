/** Refresh visible stock independently of parcel synchronisation. */
export function startStockRefresh(refresh:()=>Promise<void>,immediate=true,environment={window,document}){
 let stopped=false,running=false;
 const run=async()=>{
  if(stopped||running||environment.document.visibilityState==='hidden')return;
  running=true;
  try{await refresh()}catch{/* The consumer keeps its last snapshot and reports the error. */}
  finally{running=false}
 };
 const timer=environment.window.setInterval(run,30000);
 environment.window.addEventListener('focus',run);
 environment.document.addEventListener('visibilitychange',run);
 if(immediate)void run();
 return()=>{stopped=true;environment.window.clearInterval(timer);environment.window.removeEventListener('focus',run);environment.document.removeEventListener('visibilitychange',run)};
}
