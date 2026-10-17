import {scrypt,randomBytes,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
const derive=promisify(scrypt);
export async function hashPassword(password:string){const salt=randomBytes(16).toString('hex');const key=await derive(password,salt,64) as Buffer;return salt+':'+key.toString('hex')}
export async function verifyPassword(password:string,hash:string){try{const [salt,hex]=hash.split(':');if(!/^[a-f0-9]{32}$/.test(salt)||!/^[a-f0-9]{128}$/.test(hex))return false;const key=await derive(password,salt,64) as Buffer;return timingSafeEqual(key,Buffer.from(hex,'hex'))}catch{return false}}
export const tokenHash=(token:string)=>createHash('sha256').update(token).digest('hex');
export function sameSecret(a:string,b:string){const x=createHash('sha256').update(a).digest(),y=createHash('sha256').update(b).digest();return timingSafeEqual(x,y)}
export function validPassword(p:unknown):p is string{return typeof p==='string'&&p.length>=12&&p.length<=128}
