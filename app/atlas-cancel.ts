import {atlasError} from './atlas-request.ts';
export async function cancelAtlasParcel(key:string,code:string,request:typeof fetch=fetch){
 const r=await request('https://api.atlaslivraison.com/api/external/colis/'+encodeURIComponent(code)+'/cancel',{method:'POST',headers:{'x-api-key':key},signal:AbortSignal.timeout(20000)});
 const j:any=await r.json().catch(()=>null);
 if(!r.ok||j?.success!==true||j?.data?.cancelled!==true||j?.data?.code!==code)throw Error(atlasError(r.status,j,key));
 return true;
}
