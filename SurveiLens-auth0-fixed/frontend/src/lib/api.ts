import axios from 'axios'
const base = (import.meta as any).env.VITE_BACKEND_BASE_URL || (window as any).BACKEND_BASE_URL || 'http://localhost:8000'
export async function getFeed(siteId?:string, level?:string, token?:string){
  const params:any = {}; if(siteId) params.site_id = siteId; if(level) params.level = level
  return axios.get(base + '/feed', { params, headers: token? {Authorization:`Bearer ${token}`} : {} }).then(r=>r.data)
}
export async function getAlert(alertId:string, token?:string){
  return axios.get(base + `/alerts/${alertId}`, { headers: token? {Authorization:`Bearer ${token}`} : {} }).then(r=>r.data)
}
export async function getPolicy(token?:string){ return axios.get(base + '/admin/policy', { headers: token? {Authorization:`Bearer ${token}`} : {} }).then(r=>r.data) }
export async function setPolicy(p:any, token?:string){ return axios.post(base + '/admin/policy', p, { headers: token? {Authorization:`Bearer ${token}`} : {} }).then(r=>r.data) }
export async function approve(alertId:string, cameraId:string, notes:string, token?:string){
  return axios.post(base + '/actions/approve', { alert_id: alertId, camera_id: cameraId, notes }, { headers: token? {Authorization:`Bearer ${token}`} : {} }).then(r=>r.data)
}
export async function dismiss(alertId:string, cameraId:string, notes:string, token?:string){
  return axios.post(base + '/actions/dismiss', { alert_id: alertId, camera_id: cameraId, notes }, { headers: token? {Authorization:`Bearer ${token}`} : {} }).then(r=>r.data)
}
export async function snooze(alertId:string, cameraId:string, notes:string, token?:string){
  return axios.post(base + '/actions/snooze', { alert_id: alertId, camera_id: cameraId, notes }, { headers: token? {Authorization:`Bearer ${token}`} : {} }).then(r=>r.data)
}
