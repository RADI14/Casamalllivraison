import {moroccoDay,validDay} from './team-statistics.ts';
const str=(value:unknown,max=1000)=>typeof value==='string'?value.slice(0,max):'';
const date=(value:unknown)=>typeof value==='string'&&!Number.isNaN(Date.parse(value))?value:null;
export function parcelMessages(data:unknown){if(!Array.isArray(data))throw Error('Messages Atlas invalides.');return data.filter(m=>m&&typeof m.id==='string').map(m=>({id:str(m.id,160),message:m.deletedAt?'':str(m.message,10000),messageType:str(m.messageType,40),senderType:str(m.senderType,40),senderName:str(m.senderName,160),hasAttachment:m.hasAttachment===true,createdAt:date(m.createdAt),deleted:!!m.deletedAt})).sort((a,b)=>(a.createdAt??'').localeCompare(b.createdAt??'')||a.id.localeCompare(b.id));}
export function parcelHistory(data:unknown){if(!Array.isArray(data))throw Error('Historique Atlas invalide.');return data.filter(h=>h&&Number.isInteger(h.stateId)).map(h=>({stateId:h.stateId,stateName:str(h.stateName,160),entity:str(h.entity,160),note:str(h.note,1000),at:date(h.at)})).sort((a,b)=>(a.at??'').localeCompare(b.at??''));}
export function parcelAction(raw:any,today=moroccoDay(new Date())){
 if(!raw||typeof raw!=='object'||!['reschedule','return_request','confirm_interest','cancel_return','change_recipient'].includes(raw.action))throw Error('Action Atlas invalide.');
 const allowed=['action','note',...(raw.action==='reschedule'?['scheduledDate']:raw.action==='change_recipient'?['recipientPhone','recipientCityId']:[])];
 if(Object.keys(raw).some(k=>!allowed.includes(k)))throw Error('Champs d’action invalides.');
 const action:Record<string,any>={action:raw.action};
 if(raw.note!==undefined){if(typeof raw.note!=='string'||raw.note.length>1000)throw Error('Note invalide.');if(raw.note.trim())action.note=raw.note.trim()}
 if(raw.action==='reschedule'){if(typeof raw.scheduledDate!=='string'||!validDay(raw.scheduledDate)||raw.scheduledDate<=today)throw Error('Choisissez une date à partir de demain.');action.scheduledDate=raw.scheduledDate}
 if(raw.action==='change_recipient'){
  if(raw.recipientPhone){if(typeof raw.recipientPhone!=='string')throw Error('Téléphone invalide.');const phone=raw.recipientPhone.replace(/\s/g,'').replace(/^\+212/,'0');if(!/^0[67]\d{8}$/.test(phone))throw Error('Téléphone invalide (06/07).');action.recipientPhone=phone}
  if(raw.recipientCityId){if(typeof raw.recipientCityId!=='string'||raw.recipientCityId.length>1000)throw Error('Ville invalide.');action.recipientCityId=raw.recipientCityId}
  if(!action.recipientPhone&&!action.recipientCityId)throw Error('Indiquez un nouveau téléphone ou une nouvelle ville.');
 }
 return action;
}
