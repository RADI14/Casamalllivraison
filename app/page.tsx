import {cloudflareAuthReady,requireChatGPTUser} from './chatgpt-auth';
import {getActor} from './access';
import AccessDenied from './access-denied';
import Dashboard from './ui';
import SetupRequired from './setup-required';
import {env} from 'cloudflare:workers';
export const dynamic='force-dynamic';
export default async function Home(){if(!cloudflareAuthReady()||!env.DB)return <SetupRequired/>;await requireChatGPTUser('/');const user=await getActor();if(!user)return <AccessDenied/>;return <Dashboard name={user.displayName} role={user.role}/>}
