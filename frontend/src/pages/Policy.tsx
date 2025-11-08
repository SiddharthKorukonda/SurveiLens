import React, { useEffect, useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { getPolicy, setPolicy } from '../lib/api'
export default function Policy(){
  const { getAccessTokenSilently } = useAuth0()
  const [p, setP] = useState<any>({})
  useEffect(()=>{ (async()=>{ const tok = await getAccessTokenSilently().catch(()=>undefined); const data = await getPolicy(tok); setP(data) })() },[])
  async function save(){ const tok = await getAccessTokenSilently().catch(()=>undefined); await setPolicy(p, tok); alert('Saved') }
  function num(name:string){ return { value: p[name] ?? 0, onChange:(e:any)=>setP({...p, [name]: parseFloat(e.target.value)}) } }
  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="text-2xl font-bold mb-4">Policy</div>
      <div className="grid gap-3">
        <label className="flex justify-between"><span>weapon_conf_fast</span><input type="number" step="0.01" className="w-32 bg-black/40 border border-white/10 p-2 rounded" {...num('weapon_conf_fast')}/></label>
        <label className="flex justify-between"><span>weapon_fast_rule_frames</span><input type="number" className="w-32 bg-black/40 border border-white/10 p-2 rounded" {...num('weapon_fast_rule_frames')}/></label>
        <label className="flex justify-between"><span>weapon_fast_rule_min</span><input type="number" className="w-32 bg-black/40 border border-white/10 p-2 rounded" {...num('weapon_fast_rule_min')}/></label>
        <label className="flex justify-between"><span>multi_signal_threshold</span><input type="number" step="0.01" className="w-32 bg-black/40 border border-white/10 p-2 rounded" {...num('multi_signal_threshold')}/></label>
      </div>
      <button onClick={save} className="mt-4 px-4 py-2 rounded-2xl bg-mil-green text-black font-bold">Save</button>
    </div>
  )
}
