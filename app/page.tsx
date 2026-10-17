import {requireChatGPTUser} from './chatgpt-auth';
import {getActor} from './access';
import AccessDenied from './access-denied';
import Dashboard from './ui';
export const dynamic='force-dynamic';
export default async function Home(){await requireChatGPTUser('/');const user=await getActor();if(!user)return <AccessDenied/>;return <Dashboard name={user.displayName} role={user.role}/>}
