export const websiteStatuses=[
 ['new','New','جديد'],
 ['no_reply_1','Pas de réponse 1','بدون جواب 1'],
 ['no_reply_2','Pas de réponse 2','بدون جواب 2'],
 ['no_reply_3','Pas de réponse 3','بدون جواب 3'],
 ['no_reply_4','Pas de réponse 4','بدون جواب 4'],
 ['cancelled','Annuler','ملغى'],
 ['confirmed','Confirmer','مؤكد'],
] as const;
export function validWebsiteStatus(value:unknown){return websiteStatuses.some(([key])=>key===value)}
