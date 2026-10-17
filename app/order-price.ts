/** The entered COD total takes priority over catalogue suggestions. */
export function orderPrice(current:number,saleCents:number|undefined,quantity:number){
 if(Number.isFinite(current)&&current>0)return current;
 if(Number.isFinite(saleCents)&&saleCents!>0&&Number.isInteger(quantity)&&quantity>0)return Math.round(saleCents!/100)*quantity;
 return current;
}
