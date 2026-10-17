import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {cookieName,sessionEmail} from '../server/sessions';
export type ChatGPTUser={userId:string;displayName:string;email:string;fullName:string|null};
export function cloudflareAuthReady(){return !!process.env.OWNER_EMAIL?.trim()&&!!process.env.ADMIN_PASSWORD&&process.env.ADMIN_PASSWORD.length>=12&&!!process.env.SQLITE_PATH}
export async function getChatGPTUser():Promise<ChatGPTUser|null>{if(!cloudflareAuthReady())return null;const email=sessionEmail((await cookies()).get(cookieName)?.value);return email?{userId:email,email,displayName:email,fullName:null}:null}
export async function requireChatGPTUser(returnTo:string):Promise<ChatGPTUser>{const u=await getChatGPTUser();if(!u)return redirect(chatGPTSignInPath(returnTo));return u}
export function chatGPTSignInPath(returnTo:string){return '/login'}
export function chatGPTSignOutPath(){return '/login?logout=1'}
