import {getActor} from '../../access';

export async function GET(){
 const actor=await getActor();
 if(actor?.role!=='admin')return Response.json({error:'Accès administrateur requis'},{status:403});
 try{
  const response=await fetch('https://open.er-api.com/v6/latest/USD',{next:{revalidate:86400},signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error('Rate unavailable');
  const data:any=await response.json(),rate=data?.rates?.MAD,updated=Number(data?.time_last_update_unix)*1000;
  if(data.result!=='success'||data.base_code!=='USD'||typeof rate!=='number'||!Number.isFinite(rate)||rate<=0||rate>100||!Number.isFinite(updated)||updated>Date.now()+3600000||Date.now()-updated>3*86400000)throw Error('Invalid rate');
  return Response.json({rate:Number(rate.toFixed(6)),updatedAt:new Date(updated).toISOString()},{headers:{'Cache-Control':'private, no-store'}});
 }catch{
  return Response.json({error:'Automatic rate unavailable. Enter your bank exchange rate.'},{status:503});
 }
}
