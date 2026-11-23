import {getActor} from '../../access';
import {atlasFetch, retryAfterMs} from '../../atlas-http';

type Parcel = {code: string; stateId: number; price: string | number; cfees: string | number};
type Invoice = {id: string; type: string; updatedAt: string; colisCount: number};
type Snapshot = {asOf: string; count: number; grossCents: number; feesCents: number; netCents: number};
const base = 'https://api.atlaslivraison.com/api/external';
const refreshMs = 300_000;
const invoiceLines = new Map<string, {version: string; expires: number; codes: string[]}>();
let snapshot: Snapshot | null = null;
let refresh: Promise<void> | null = null;
let retryAt = 0;
let failed = false;

class AtlasReadError extends Error {
 constructor(message: string, readonly retryDelayMs = 30_000) {
  super(message);
 }
}

async function readAtlas<T>(key: string, path: string) {
 for (const delay of [0, 2_000, 5_000]) {
  if (delay) await new Promise(resolve => setTimeout(resolve, delay));
  let result: Response;
  try {
   result = await atlasFetch(base + path, {
    cache: 'no-store',
    headers: {'x-api-key': key},
    signal: AbortSignal.timeout(30_000),
   });
  } catch (error) {
   if (!(error instanceof TypeError) &&
       !(error instanceof DOMException && error.name === 'TimeoutError')) throw error;
   if (delay === 5_000) throw new AtlasReadError('Atlas connection failed after three attempts');
   continue;
  }
  if (result.status === 429) {
   throw new AtlasReadError('Atlas HTTP 429', Math.max(30_000, retryAfterMs(result.headers.get('Retry-After'))));
  }
  if (result.status >= 500 && delay < 5_000) {
   continue;
  }
  if (!result.ok) throw new AtlasReadError('Atlas HTTP ' + result.status, result.status >= 500 ? 30_000 : refreshMs);
  const body = await result.json() as {success?: boolean; data?: T; totalPages?: number} | null;
  if (body?.success !== true) throw new Error('Invalid Atlas response');
  return body;
 }
 throw new AtlasReadError('Atlas read failed');
}

async function list<T>(key: string, path: string) {
 const rows: T[] = [];
 for (let page = 1; ; page++) {
  const body = await readAtlas<T[]>(key, path + '&limit=100&page=' + page);
  if (!Array.isArray(body.data) || typeof body.totalPages !== 'number' || !Number.isSafeInteger(body.totalPages) ||
      body.totalPages < 0 || body.totalPages > 1000 || (body.totalPages > page && !body.data.length)) {
   throw new Error('Invalid Atlas pagination');
  }
  rows.push(...body.data);
  if (page >= body.totalPages) return rows;
 }
}

function cents(value: unknown) {
 if ((typeof value !== 'string' && typeof value !== 'number') ||
     !/^-?\d+(\.\d{1,2})?$/.test(String(value))) throw new Error('Invalid Atlas amount');
 const amount = Math.round(Number(value) * 100);
 if (!Number.isSafeInteger(amount)) throw new Error('Invalid Atlas amount');
 return amount;
}

async function calculate(key: string): Promise<Snapshot> {
 const asOf = new Date().toISOString();
 const invoices = await list<Invoice>(key, '/factures?type=FAC');
 const billed = new Set<string>();
 const invoiceIds = new Set<string>();
 for (const invoice of invoices) {
  if (invoice.type !== 'FAC' || !invoice.id || typeof invoice.updatedAt !== 'string') {
   throw new Error('Invalid Atlas client invoice');
  }
  invoiceIds.add(invoice.id);
  let entry = invoiceLines.get(invoice.id);
  if (!entry || entry.version !== invoice.updatedAt || entry.expires < Date.now()) {
   const {data} = await readAtlas<{id: string; items: {colisCode?: string}[]}>(key, '/factures/' + encodeURIComponent(invoice.id));
   if (data?.id !== invoice.id || !Array.isArray(data.items) || data.items.length !== invoice.colisCount) {
    throw new Error('Incomplete Atlas invoice');
   }
   const codes: string[] = data.items.map((item: {colisCode?: string}) => {
    if (typeof item.colisCode !== 'string' || !item.colisCode) throw new Error('Missing Atlas parcel code');
    return item.colisCode;
   });
   entry = {version: invoice.updatedAt, expires: Date.now() + 86400_000, codes};
   invoiceLines.set(invoice.id, entry);
  }
  for (const code of entry.codes) billed.add(code);
 }
 for (const id of invoiceLines.keys()) if (!invoiceIds.has(id)) invoiceLines.delete(id);

 const parcels = await list<Parcel>(key, '/colis?stateId=17');
 const seen = new Set<string>();
 let grossCents = 0;
 let feesCents = 0;
 for (const parcel of parcels) {
  if (parcel.stateId !== 17 || typeof parcel.code !== 'string' || !parcel.code) {
   throw new Error('Invalid Atlas delivery');
  }
  if (billed.has(parcel.code) || seen.has(parcel.code)) continue;
  grossCents += cents(parcel.price);
  feesCents += cents(parcel.cfees);
  seen.add(parcel.code);
 }
 return {asOf, count: seen.size, grossCents, feesCents, netCents: grossCents - feesCents};
}

export async function GET() {
 if ((await getActor())?.role !== 'admin') {
  return Response.json({error: 'Accès administrateur requis'},{status: 403});
 }
 const key = process.env.ATLAS_API_KEY;
 if (key && !refresh && Date.now() >= retryAt) {
  refresh = calculate(key).then(value => {
   snapshot = value;
   failed = false;
   retryAt = Date.now() + refreshMs;
  }).catch(error => {
   console.error('Atlas receivable refresh failed:', error instanceof Error ? error.message : 'Unknown error');
   failed = true;
   retryAt = Date.now() + (error instanceof AtlasReadError ? error.retryDelayMs : refreshMs);
  }).finally(() => { refresh = null; });
 }
 return Response.json({snapshot, refreshing: !!refresh, unavailable: !key || failed}, {
  headers: {'Cache-Control': 'private, no-store'},
 });
}
