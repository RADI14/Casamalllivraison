import {getSqlite} from './sqlite';
export const env={get DB(){return getSqlite() as unknown as D1Database},get OWNER_EMAIL(){return process.env.OWNER_EMAIL},get ATLAS_API_KEY(){return process.env.ATLAS_API_KEY}};
