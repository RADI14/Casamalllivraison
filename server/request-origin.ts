/** Railway terminates TLS before Node, so validate against the public origin. */
export function sameOrigin(req:Request){
 const configured=process.env.APP_URL||(process.env.RAILWAY_PUBLIC_DOMAIN?'https://'+process.env.RAILWAY_PUBLIC_DOMAIN:'');
 try{const expected=configured?new URL(configured).origin:process.env.NODE_ENV!=='production'?new URL(req.url).origin:null;return expected!==null&&req.headers.get('origin')===expected}catch{return false}
}
