/** Railway terminates TLS before Node, so use explicitly configured public origins. */
export function sameOrigin(req:Request){
 const primary=process.env.APP_URL||(process.env.RAILWAY_PUBLIC_DOMAIN?'https://'+process.env.RAILWAY_PUBLIC_DOMAIN:'');
 const configured=[primary,...(process.env.APP_ALLOWED_ORIGINS??'').split(',')].map(s=>s.trim()).filter(Boolean);
 try{const allowed=configured.length?configured.map(s=>{const u=new URL(s);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.search||u.hash||u.pathname!=='/')throw Error('Invalid origin');return u.origin}):process.env.NODE_ENV!=='production'?[new URL(req.url).origin]:[];return allowed.includes(req.headers.get('origin')??'')}catch{return false}
}
