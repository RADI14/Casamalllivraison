import {getSqlite} from '../../../server/sqlite';
export const dynamic='force-dynamic';
export async function GET(){try{getSqlite().connection.prepare('SELECT 1').get();return Response.json({ok:true})}catch{return Response.json({ok:false},{status:503})}}
