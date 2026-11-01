export async function register(){
 if(process.env.NEXT_RUNTIME==='nodejs'&&process.env.NODE_ENV==='production'){
  const {startAtlasSyncWorker}=await import('./server/atlas-sync-worker');
  startAtlasSyncWorker();
  const {startAtlasStockWorker}=await import('./server/atlas-stock-refresh');
  startAtlasStockWorker();
 }
}
