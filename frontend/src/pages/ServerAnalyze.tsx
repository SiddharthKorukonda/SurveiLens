import React, { useEffect, useState } from 'react'
import MetricsPanel from '../components/MetricsPanel'
import { connectEvents } from '../lib/sse'
import AlertCard from '../components/AlertCard'
export default function ServerAnalyze(){
  const [alerts, setAlerts] = useState<any[]>([])
  useEffect(()=>{ const off = connectEvents('site-01', e=>{ if(e.type==='alert.new') setAlerts(a=>[e.alert, ...a].slice(0,50)) }); return off },[])
  return (
    <div className="max-w-6xl mx-auto p-6 grid grid-cols-4 gap-4">
      <div className="col-span-3 grid grid-cols-2 gap-3">
        <div className="h-48 rounded-xl bg-black/30 border border-white/10"></div>
        <div className="h-48 rounded-xl bg-black/30 border border-white/10"></div>
        <div className="h-48 rounded-xl bg-black/30 border border-white/10"></div>
        <div className="h-48 rounded-xl bg-black/30 border border-white/10"></div>
      </div>
      <div className="col-span-1 space-y-4">
        <MetricsPanel latency={120} queue={0}/>
        <div className="space-y-2">
          <div className="text-lg font-semibold">Live Alerts</div>
          <div className="space-y-2">{alerts.map(a=><AlertCard a={a} key={a.alert_id}/>)}</div>
        </div>
      </div>
    </div>
  )
}
