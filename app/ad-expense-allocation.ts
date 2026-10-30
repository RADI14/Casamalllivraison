import type {convertExpense} from './expense-currency';
type Converted=NonNullable<ReturnType<typeof convertExpense>>;
export function selectedAdProducts(value:unknown):string[]|null{if(!Array.isArray(value)||value.length<1||value.length>50||value.some(id=>typeof id!=='string'||!id.trim()||id.length>100))return null;const ids=value.map(id=>id.trim());return new Set(ids).size===ids.length?ids:null}
export function splitAdExpense(total:Converted,count:number){
 if(!Number.isInteger(count)||count<1||count>50)throw Error('Invalid product count');
 const parts=Array.from({length:count},(_,i)=>{const originalAmountCents=Math.floor(total.originalAmountCents/count)+(i<total.originalAmountCents%count?1:0),scaled=originalAmountCents*total.exchangeRateMicros;return {...total,originalAmountCents,amountCents:Math.floor(scaled/1000000),remainder:scaled%1000000,index:i}});
 const remaining=total.amountCents-parts.reduce((sum,p)=>sum+p.amountCents,0);
 const priority=[...parts].sort((a,b)=>b.remainder-a.remainder||a.index-b.index);for(let i=0;i<remaining;i++)priority[i].amountCents++;
 return parts.map(({remainder,index,...part})=>part);
}
