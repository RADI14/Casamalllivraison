import {AsyncLocalStorage} from 'node:async_hooks';
export const auditActor=new AsyncLocalStorage<string>();
