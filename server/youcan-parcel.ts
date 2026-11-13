import {atlasRead,normalizeStocks} from '../app/atlas-stock.ts';
const normalized=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
export function matchWebsiteParcel(draft:any,stocks:ReturnType<typeof normalizeStocks>,cities:any[],stores:any[]){
 const city=cities.filter(c=>typeof c.name==='string'&&normalized(c.name)===normalized(draft.cityName??''));
 if(city.length!==1)throw Error('Complétez la ville Atlas avant l’envoi.');
 if(stores.length>1)throw Error('Choisissez la boutique Atlas dans les informations de la commande.');
 if(!Array.isArray(draft.lines)||!draft.lines.length)throw Error('Complétez les produits avant l’envoi.');
 const quantities=new Map<string,number>();
 for(const line of draft.lines){
  if(line.variant)throw Error('Vérifiez le produit et la quantité de cette offre avant l’envoi.');
  const matches=stocks.filter(s=>line.sku?s.sku===line.sku:s.name===line.name);
  if(matches.length!==1)throw Error('Choisissez le produit Atlas dans les informations de la commande.');
  quantities.set(matches[0].stockId,(quantities.get(matches[0].stockId)??0)+line.quantity);
 }
 const items=[...quantities].map(([stockId,quantity])=>({stockId,quantity})),quantity=items.reduce((n,i)=>n+i.quantity,0);
 if(items.some(i=>!Number.isInteger(i.quantity)||i.quantity<1)||quantity>9)throw Error('Vérifiez la quantité : maximum 9 pièces.');
 return {fulfillmentMode:'stock',fullname:draft.fullname,phone:draft.phone,phone2:'',address:draft.address,cityId:city[0].id,cityName:city[0].name,storeId:stores[0]?.id??'',product:stocks.find(s=>s.stockId===items[0].stockId)!.name,atlasStockId:items[0].stockId,items,quantity,price:draft.price,note:draft.note??'',openpackage:false,change:false,allowtry:false};
}
export async function websiteParcelPayload(row:any,key:string){
 if(row.prepared_payload)return JSON.parse(row.prepared_payload);
 const [stocks,cities,stores]=await Promise.all([atlasRead(key,'/stocks'),atlasRead(key,'/cities'),atlasRead(key,'/stores')]);
 return matchWebsiteParcel(JSON.parse(row.payload),normalizeStocks(stocks),cities,stores);
}
