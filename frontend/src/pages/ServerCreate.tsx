import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
export default function ServerCreate(){
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [cams, setCams] = useState<string[]>([])
  const addCam = ()=>{ if(cams.length>=4) return; setCams([...cams, `cam-${String.fromCharCode(97 + cams.length)}`]) }
  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="text-2xl font-bold mb-4">Create Server</div>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Server name" className="w-full mb-4 p-3 rounded-xl bg-black/40 border border-white/10"/>
      <div className="mb-3">Cameras</div>
      <div className="grid gap-2">{cams.map(c=><div key={c} className="p-3 rounded-xl border border-white/10">{c}</div>)}</div>
      <button onClick={addCam} className="mt-3 px-3 py-1.5 rounded-xl bg-white/10">Add camera</button>
      <div className="mt-6"><button onClick={()=>nav('/home')} className="px-4 py-2 rounded-2xl bg-mil-green text-black font-bold">Done</button></div>
    </div>
  )
}
