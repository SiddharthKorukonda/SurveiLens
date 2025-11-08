export function connectEvents(siteId: string, onEvent:(e:any)=>void){
  const base = (import.meta as any).env.VITE_BACKEND_BASE_URL || (window as any).BACKEND_BASE_URL || 'http://localhost:8000'
  const url = `${base}/events?site_id=${encodeURIComponent(siteId)}`
  const ev = new EventSource(url, { withCredentials: false })
  ev.onmessage = (m)=>{ try{ const data = JSON.parse(m.data); onEvent(data) }catch{} }
  return ()=>ev.close()
}
