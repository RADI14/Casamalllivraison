import {youcanOrderItems} from '../app/youcan-order-items.ts';
import {atlasRead,normalizeStocks} from '../app/atlas-stock.ts';
const normalized=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
export function matchWebsiteParcel(draft:any,stocks:ReturnType<typeof normalizeStocks>,cities:any[],stores:any[]){
 const city=cities.filter(c=>typeof c.name==='string'&&normalized(c.name)===normalized(draft.cityName??''));
 if(city.length!==1)throw Error('Complétez la ville Atlas avant l’envoi.');
 if(stores.length>1)throw Error('Choisissez la boutique Atlas dans les informations de la commande.');
 const items=youcanOrderItems(draft.lines,stocks),quantity=items.reduce((n,i)=>n+i.quantity,0);
 return {fulfillmentMode:'stock',fullname:draft.fullname,phone:draft.phone,phone2:'',address:draft.address,cityId:city[0].id,cityName:city[0].name,storeId:stores[0]?.id??'',product:stocks.find(s=>s.stockId===items[0].stockId)!.name,atlasStockId:items[0].stockId,items,quantity,price:draft.price,note:draft.note??'',openpackage:false,change:false,allowtry:false};
}
export async function websiteParcelPayload(row:any,key:string){
 if(row.prepared_payload)return JSON.parse(row.prepared_payload);
 const [stocks,cities,stores]=await Promise.all([atlasRead(key,'/stocks'),atlasRead(key,'/cities'),atlasRead(key,'/stores')]);
 return matchWebsiteParcel(JSON.parse(row.payload),normalizeStocks(stocks),cities,stores);
}
