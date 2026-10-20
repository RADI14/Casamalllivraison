import {test} from 'node:test';import assert from 'node:assert/strict';
import {parcelMessages,parcelHistory,parcelAction} from '../app/atlas-feed-rules.ts';
test('messages and history expose only display fields and never deleted content or attachment URLs',()=>{
 const rows=parcelMessages([{id:'2',message:'secret deleted',deletedAt:'2026-01-01',createdAt:'2026-01-02',attachmentUrl:'secret',senderName:'Agent'},{id:'1',message:'<script>x</script>',createdAt:'2026-01-01',hasAttachment:true,token:'secret'}]);
 assert.equal(rows[0].message,'<script>x</script>');assert.equal(rows[1].message,'');assert.equal(rows[1].deleted,true);assert.ok(!JSON.stringify(rows).includes('secret'));assert.equal(rows[0].hasAttachment,true);
 assert.deepEqual(parcelHistory([{stateId:1,stateName:'Nouveau',entity:'Shop',at:'2026-01-01',gpsLat:34,privateNote:'hidden'}]),[{stateId:1,stateName:'Nouveau',entity:'Shop',note:'',at:'2026-01-01'}]);
});
test('only documented actions and fields pass; report dates start tomorrow in Morocco',()=>{
 assert.deepEqual(parcelAction({action:'change_recipient',recipientPhone:'+212 6 12 34 56 78'},'2026-10-20'),{action:'change_recipient',recipientPhone:'0612345678'});
 assert.deepEqual(parcelAction({action:'reschedule',scheduledDate:'2026-10-21',note:' Away '},'2026-10-20'),{action:'reschedule',note:'Away',scheduledDate:'2026-10-21'});
 for(const action of [{action:'refund'},{action:'change_recipient'},{action:'change_recipient',recipientPhone:'0512345678'},{action:'confirm_interest',stateId:17},{action:'reschedule',scheduledDate:'2026-10-20'},{action:'reschedule',scheduledDate:'2026-02-30'}])assert.throws(()=>parcelAction(action,'2026-10-20'));
});
