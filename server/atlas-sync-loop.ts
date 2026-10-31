// One awaited batch at a time. Timers are unref'd so shutdown is never blocked.
export function startAtlasSyncLoop(run:(cursor?:string)=>Promise<{nextCursor:string|null;retryAfterMs?:number}>,schedule:(fn:()=>void,ms:number)=>{unref?:()=>void}= (fn,ms)=>setTimeout(fn,ms)){
 let stopped=false,cursor:string|undefined;
 const tick=async()=>{
  if(stopped)return;
  let delay=60000;
  try{const result=await run(cursor);if(result.retryAfterMs){delay=Math.max(30000,result.retryAfterMs)}else{cursor=result.nextCursor??undefined;delay=cursor?1000:60000;}}catch{delay=60000;}
  if(!stopped)schedule(()=>{void tick()},delay).unref?.();
 };
 schedule(()=>{void tick()},5000).unref?.();
 return ()=>{stopped=true};
}
