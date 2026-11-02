export type AtlasStock={stockId:string;sku:string;name:string;available:number;frozen:boolean};
export function normalizeStocks(data:unknown):AtlasStock[]{if(!Array.isArray(data))throw Error('Invalid Atlas stock response.');return data.filter((s:any)=>typeof s?.stockId==='string'&&s.stockId.length>0).map((s:any)=>({stockId:s.stockId,sku:typeof s.sku==='string'?s.sku:'',name:[s.name||s.product||s.sku||s.stockId,...(!s.name?[s.color,s.size].filter(Boolean):[])].join(' · '),available:Number.isFinite(Number(s.available))?Math.max(0,Math.floor(Number(s.available))):0,frozen:s.frozen!==false&&s.frozen!==0&&s.frozen!==undefined}));}
export function stockSelection(stocks:AtlasStock[],id:unknown,quantity:unknown){const stock=stocks.find(s=>s.stockId===id);if(!stock)throw Error('Select a product from Atlas stock.');if(stock.frozen)throw Error('This Atlas stock is frozen.');if(!Number.isInteger(quantity)||Number(quantity)<1||Number(quantity)>stock.available)throw Error('Insufficient Atlas stock.');return stock;}
export class AtlasReadError extends Error {
 status:number;retryAfterMs:number;
 constructor(status:number,retryAfterMs:number){super('Atlas API '+status+'.');this.status=status;this.retryAfterMs=retryAfterMs}
}
export function atlasRetryAfter(value:string|null,now=Date.now()){
 if(!value)return 0;
 const seconds=Number(value),delay=Number.isFinite(seconds)?seconds*1000:Date.parse(value)-now;
 return Number.isFinite(delay)?Math.max(0,delay):0;
}
export async function atlasRead(key:string,path:string){const r=await fetch('https://api.atlaslivraison.com/api/external'+path,{cache:'no-store',headers:{'x-api-key':key},signal:AbortSignal.timeout(15000)});if(!r.ok)throw new AtlasReadError(r.status,atlasRetryAfter(r.headers.get('retry-after')));let j:any;try{j=await r.json()}catch{throw Error('Invalid Atlas response.')}if(j.success!==true)throw Error('Atlas request failed.');return j.data;}
