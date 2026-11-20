/** One carrier budget for stock, synchronisation and interactive requests.
 * Never retry writes: an uncertain delivery response must not create a duplicate.
 */
export function retryAfterMs(value:string|null,now=Date.now()){
 if(!value)return 0;
 const seconds=Number(value),delay=Number.isFinite(seconds)?seconds*1000:Date.parse(value)-now;
 return Number.isFinite(delay)?Math.max(0,delay):0;
}
export function createAtlasTransport({send=(...args:Parameters<typeof fetch>)=>fetch(...args),now=()=>Date.now(),wait=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms)),spacing=1500}={}){
 type Budget={tail:Promise<unknown>;next:number;until:number;strikes:number};
 const budgets=new Map<string,Budget>(),pending=new Map<string,Promise<Response>>(),cache=new Map<string,{until:number;response:Response}>();
 return async function request(input:Parameters<typeof fetch>[0],options:RequestInit={}):Promise<Response>{
  const url=String(input),method=(options.method??'GET').toUpperCase(),key=new Headers(options.headers).get('x-api-key')??'';
  let budget=budgets.get(key);if(!budget){budget={tail:Promise.resolve(),next:0,until:0,strikes:0};budgets.set(key,budget)}
  const b=budget,id=JSON.stringify([key,url]),read=method==='GET';
  // Only stable reference data is cached; stock checks and order edits stay live.
  const ttl=/\/cities$|\/stores$/.test(url)?900000:0;
  const old=read?cache.get(id):undefined;if(old&&old.until>now())return old.response.clone();
  const active=read?pending.get(id):undefined;if(active)return (await active).clone();
  const limited=()=>Response.json({success:false,message:'Atlas limite temporairement les requêtes. La synchronisation reprendra automatiquement.'},{status:429,headers:{'Retry-After':String(Math.max(1,Math.ceil((b.until-now())/1000)))}});
  const job=b.tail.then(async()=>{
   if(b.until>now())return limited();
   if(b.next>now())await wait(b.next-now());
   if(b.until>now())return limited();
   options.signal?.throwIfAborted();b.next=now()+spacing;
   const response=await send(input,options);
   if(response.status===429){b.strikes++;b.until=now()+Math.max(retryAfterMs(response.headers.get('retry-after'),now()),Math.min(900000,120000*2**Math.min(b.strikes-1,3)));}
   else if(response.ok){b.strikes=0;if(read&&ttl){if(cache.size>=100)cache.delete(cache.keys().next().value!);cache.set(id,{until:now()+ttl,response:response.clone()})}}
   return response;
  });
  b.tail=job.catch(()=>{});if(read)pending.set(id,job);
  try{return (await job).clone()}finally{if(read&&pending.get(id)===job)pending.delete(id)}
 };
}
const state=globalThis as typeof globalThis & {atlasTransport?:ReturnType<typeof createAtlasTransport>};
export const atlasFetch=state.atlasTransport??(state.atlasTransport=createAtlasTransport());
