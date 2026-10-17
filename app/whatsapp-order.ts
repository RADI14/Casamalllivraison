export function parseWhatsAppOrder(text:string,cities:{id:string;name:string}[]=[]){
 const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const clean=text.replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)));
 const lines=clean.split(/\r?\n/).map(l=>l.replace(/^\[?\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}.*?\s[-–]\s/,'').trim());
 const result:Record<string,string>={};
 const phones=[...clean.matchAll(/(?:\+212|00212|0)[\s.-]*[567](?:[\s.-]*\d){8}(?!\d)/g)].map(m=>m[0].replace(/[\s.-]/g,'').replace(/^(?:\+212|00212)/,'0'));
 const unique=[...new Set(phones)];if(unique[0])result.phone=unique[0];if(unique[1])result.phone2=unique[1];
 for(const line of lines){
  const name=line.match(/^(?:nom(?:\s+(?:complet|et\s+pr[ée]nom))?|full\s*name|name|destinataire|الاسم(?:\s+الكامل)?|الإسم|سمية)\s*[:：=\-]\s*(.+)$/i);
  const address=line.match(/^(?:adresse|address|العنوان|عنوان)\s*[:：=\-]\s*(.+)$/i);
  const city=line.match(/^(?:ville|city|المدينة|مدينة)\s*[:：=\-]\s*(.+)$/i);
  if(name)result.fullname=name[1].trim();if(address)result.address=address[1].trim();
  if(city){const matches=cities.filter(c=>normalize(c.name)===normalize(city[1]));if(matches.length===1){result.cityId=matches[0].id;result.cityName=matches[0].name;}}
 }
 return result;
}
