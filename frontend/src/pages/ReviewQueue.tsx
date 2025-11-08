import React, { useEffect, useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { approve, getFeed } from '../lib/api'
import AlertCard from '../components/AlertCard'
export default function ReviewQueue(){
  const { getAccessTokenSilently } = useAuth0()
  const [items, setItems] = useState<any[]>([])
  const [busy, setBusy] = useState(false)
  useEffect(()=>{ (async()=>{ const tok = await getAccessTokenSilently().catch(()=>undefined); const data = await getFeed('site-01','MED', tok); setItems(data) })() },[])
  async function onApprove(a:any){ setBusy(true); const tok = await getAccessTokenSilently().catch(()=>undefined); await approve(a.alert_id, a.camera_id, 'ok', tok); setBusy(false) }
  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="text-2xl font-bold mb-4">Review Queue</div>
      <div className="grid gap-3">{items.map(a=>(
        <div className="p-3 rounded-xl border border-white/10" key={a.alert_id}>
          <AlertCard a={a}/>
          <div className="mt-2 flex gap-2">
            <button disabled={busy} onClick={()=>onApprove(a)} className="px-3 py-1.5 rounded-xl bg-mil-green text-black font-bold">Approve</button>
            <button className="px-3 py-1.5 rounded-xl bg-white/10">Dismiss</button>
            <button className="px-3 py-1.5 rounded-xl bg-white/10">Snooze</button>
          </div>
        </div>
      ))}</div>
    </div>
  )
}
