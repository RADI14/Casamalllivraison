export function orderItems(raw:any):{stockId:string;quantity:number}[]{
 const items=raw.items??[{stockId:raw.atlasStockId,quantity:raw.quantity}];
 if(!Array.isArray(items)||!items.length||items.length>9||items.some(i=>!i||typeof i.stockId!=='string'||!i.stockId||!Number.isInteger(i.quantity)||i.quantity<1||i.quantity>9)||new Set(items.map(i=>i.stockId)).size!==items.length||items.reduce((n,i)=>n+i.quantity,0)>9)throw Error('Choisissez des produits différents, avec un total de 1 à 9 pièces.');
 return items.map(i=>({stockId:i.stockId,quantity:i.quantity}));
}
