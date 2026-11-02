export function purchaseCost(o:any):number|null{
 if(Number.isSafeInteger(o.purchaseTotalCents)&&o.purchaseTotalCents>=0)return o.purchaseTotalCents;
 if(o.unitCostCents==null)return null;
 try{return o.unitCostCents*JSON.parse(o.payload).quantity}catch{return null}
}
