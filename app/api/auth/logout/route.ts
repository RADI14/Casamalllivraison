import {sameOrigin} from '../../../../server/request-origin';
import {cookies} from 'next/headers';import {NextResponse} from 'next/server';import {cookieName,deleteSession} from '../../../../server/sessions';
export async function POST(req:Request){if(!sameOrigin(req))return NextResponse.json({error:'Origine refusée'},{status:403});deleteSession((await cookies()).get(cookieName)?.value);const r=NextResponse.json({ok:true});r.cookies.set(cookieName,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:0});return r}
