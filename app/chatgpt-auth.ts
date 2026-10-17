import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {env} from 'cloudflare:workers';
import {accessIdentity,accessIssuer} from './cloudflare-access';
export type ChatGPTUser={userId:string;displayName:string;email:string;fullName:string|null};
const settings=()=>env as unknown as Record<string,string>;
export function cloudflareAuthReady(){const s=settings();return !!accessIssuer(s.CF_ACCESS_TEAM_DOMAIN)&&!!s.CF_ACCESS_AUD?.trim()&&!!s.OWNER_EMAIL?.trim()}
// Legacy export names preserve the application interface; only verified Access JWTs are trusted.
export async function getChatGPTUser():Promise<ChatGPTUser|null>{if(!cloudflareAuthReady())return null;const h=await headers(),s=settings();return accessIdentity(h.get('cf-access-jwt-assertion'),s.CF_ACCESS_TEAM_DOMAIN,s.CF_ACCESS_AUD)}
export async function requireChatGPTUser(returnTo:string):Promise<ChatGPTUser>{const u=await getChatGPTUser();if(u)return u;redirect(chatGPTSignInPath(returnTo))}
export function chatGPTSignInPath(returnTo:string){const safe=returnTo.startsWith('/')&&!returnTo.startsWith('//')?returnTo:'/';return '/cdn-cgi/access/login?redirect_url='+encodeURIComponent(safe)}
export function chatGPTSignOutPath(){return '/cdn-cgi/access/logout'}
