export function commissionPaymentSelection(rows:any[],value:string){
 const available=rows.filter(r=>Number.isSafeInteger(r.commissionDueCents)&&r.commissionDueCents>0).sort((a,b)=>String(a.createdAt??'').localeCompare(String(b.createdAt??''))||String(a.id).localeCompare(String(b.id)));
 const maximum=available.reduce((n,r)=>n+r.commissionDueCents,0);
 const normalized=value.trim().replace(',','.');
 if(!/^\d+(?:\.\d{1,2})?$/.test(normalized))return {maximum,amount:0,selected:[],valid:false};
 const [whole,fraction='']=normalized.split('.');const amount=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 if(!Number.isSafeInteger(amount)||amount<=0||amount>maximum)return {maximum,amount,selected:[],valid:false};
 const selected:any[]=[];let sum=0;
 for(const row of available){if(sum+row.commissionDueCents>amount)break;selected.push(row);sum+=row.commissionDueCents;if(sum===amount)break;}
 return {maximum,amount,selected,valid:sum===amount};
}
