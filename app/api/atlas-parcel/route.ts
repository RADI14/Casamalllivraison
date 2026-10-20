import {getActor} from '../../access';
import {sameOrigin} from '../../../server/request-origin';
import {parcelFeed,performParcelAction} from '../../../server/atlas-parcel';
export async function GET(req:Request){const actor=await getActor();if(!actor)return Response.json({error:'Accès non autorisé'},{status:403});return parcelFeed(req,actor)}
export async function POST(req:Request){const actor=await getActor();if(!actor)return Response.json({error:'Accès non autorisé'},{status:403});if(!sameOrigin(req))return Response.json({error:'Origine refusée'},{status:403});let body;try{body=await req.json()}catch{return Response.json({error:'Requête invalide'},{status:400})}return performParcelAction(body,actor)}
