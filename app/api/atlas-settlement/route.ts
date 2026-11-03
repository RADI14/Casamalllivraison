import {createHash} from 'node:crypto';
import {getActor} from '../../access';
import {getSqlite} from '../../../server/sqlite';
import {sameOrigin} from '../../../server/request-origin';
import {audited} from '../../../server/audited-request';
import {atlasSettlementSummary} from '../../atlas-settlement-rules';
function latest(){const row=getSqlite().connection.prepare('SELECT summary,imported_at FROM atlas_settlement_snapshots ORDER BY as_of DESC,imported_at DESC LIMIT 1').get() as {summary:string;imported_at:string}|undefined;return row?{...JSON.parse(row.summary),importedAt:row.imported_at}:null;}
export async function GET(){if((await getActor())?.role!=='admin')return Response.json({error:'Accès administrateur requis'},{status:403});return Response.json({settlement:latest()},{headers:{'Cache-Control':'private, no-store'}});}
async function handlePost(req:Request){const actor=await getActor();if(actor?.role!=='admin')return Response.json({error:'Accès administrateur requis'},{status:403});if(!sameOrigin(req))return Response.json({error:'Origine refusée'},{status:403});const text=await req.text();if(text.length>4000000)return Response.json({error:'Fichier trop volumineux.'},{status:413});try{const summary=atlasSettlementSummary(JSON.parse(text)),previous=latest();if(previous&&Date.parse(summary.asOf)<Date.parse(previous.asOf))return Response.json({error:'Un relevé plus récent est déjà enregistré.'},{status:409});const content=JSON.stringify(summary),id=createHash('sha256').update(content).digest('hex');getSqlite().connection.prepare('INSERT OR IGNORE INTO atlas_settlement_snapshots(id,as_of,summary,imported_at,imported_by) VALUES(?,?,?,?,?)').run(id,summary.asOf,content,new Date().toISOString(),actor.email);return Response.json({settlement:latest()},{status:201});}catch{return Response.json({error:'Relevé Atlas invalide ou incomplet. Importez le JSON du contrôle Atlas.'},{status:400});}}
export const POST=audited(handlePost);
