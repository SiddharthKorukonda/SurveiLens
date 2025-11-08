import React, { useState } from 'react'
export default function Ask(){
  const [q, setQ] = useState('show High in last hour from cam-b')
  return (<div className="max-w-3xl mx-auto p-6"><div className="text-2xl font-bold mb-3">Ask NeuralSeek</div><input value={q} onChange={e=>setQ(e.target.value)} className="w-full p-3 rounded-xl bg-black/40 border border-white/10" /><div className="opacity-70 mt-3">Demo text input only</div></div>)
}
