import React from 'react'
export default function AlertCard({a, onClick}:{a:any, onClick?:()=>void}){
  const color = a.danger_level==='HIGH' ? 'border-mil-red' : a.danger_level==='MED' ? 'border-mil-amber' : a.danger_level==='LOW' ? 'border-white/20' : 'border-white/10'
  return (
    <div className={`p-3 rounded-xl border ${color} hover:bg-white/5 cursor-pointer`} onClick={onClick}>
      <div className="text-xs opacity-60">{a.camera_id} • {new Date(a.created_at || Date.now()).toLocaleTimeString()}</div>
      <div className="text-lg font-semibold">{a.danger_level} <span className="text-sm opacity-70">score {a.danger_score} • conf {a.confidence}</span></div>
      <div className="text-sm opacity-80">{a.reason}</div>
    </div>
  )
}
