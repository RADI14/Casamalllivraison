export function cancellableOrder(o:any){return o.status!=='cancelled'&&o.status!=='sending'&&(!!o.tracking||o.status==='draft');}
export function escapeLabel(value:unknown){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));}
