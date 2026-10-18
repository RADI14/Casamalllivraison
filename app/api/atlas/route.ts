import {env} from '../../../server/runtime';
import {getActor} from '../../access';
import {atlasRead,normalizeStocks} from '../../atlas-stock';
export async function GET(req:Request){
 if(!await getActor())return Response.json({error:'Connexion requise'},{status:401});
 const key=(env as unknown as Record<string,string>).ATLAS_API_KEY;
 if(!key)return Response.json({configured:false,cities:[],stores:[],stocks:[],stockReady:false});
 if(new URL(req.url).searchParams.get('stocksOnly')==='1'){
  try{return Response.json({configured:true,stocks:normalizeStocks(await atlasRead(key,'/stocks')),stockReady:true},{headers:{'Cache-Control':'private, no-store'}})}
  catch{return Response.json({configured:true,stockReady:false,stockError:'Atlas stock is unavailable. Refresh the connection before creating an order.'},{status:502,headers:{'Cache-Control':'private, no-store'}})}
 }
 const rs=await Promise.allSettled([atlasRead(key,'/cities'),atlasRead(key,'/stores'),atlasRead(key,'/stocks').then(normalizeStocks)]);
 const value=(i:number)=>rs[i].status==='fulfilled'?(rs[i] as PromiseFulfilledResult<any>).value:[];
 const failures=rs.filter(r=>r.status==='rejected').map(r=>(r as PromiseRejectedResult).reason?.message??'Atlas request failed.');
 return Response.json({configured:true,cities:value(0),stores:value(1),stocks:value(2),stockReady:rs[2].status==='fulfilled',...(failures.length?{error:failures.join(' ')}:{}),...(rs[2].status==='rejected'?{stockError:'Atlas stock is unavailable. Refresh the connection before creating an order.'}:{})},{headers:{'Cache-Control':'private, no-store'}});
}
