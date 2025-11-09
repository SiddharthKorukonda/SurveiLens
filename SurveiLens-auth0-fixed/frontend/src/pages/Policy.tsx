import React, { useState } from "react"


export default function Policy() {
const [p, setP] = useState({
highThreshold: 0.85,
medThreshold: 0.65,
retentionHours: 24,
redactFaces: true,
})


return (
<div className="mx-auto max-w-3xl p-6">
<div className="mb-2 text-sm text-white/70">Tune detection thresholds and privacy defaults. Changes apply immediately.</div>
<div className="text-2xl font-bold">Policy</div>


<div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
<div className="rounded-xl border border-white/10 bg-white/5 p-4">
<div className="text-sm">High Threshold</div>
<input type="range" min={0.5} max={0.99} step={0.01} value={p.highThreshold} onChange={(e) => setP({ ...p, highThreshold: Number(e.target.value) })} className="mt-2 w-full" />
<div className="text-xs text-white/70">{p.highThreshold.toFixed(2)}</div>
</div>
<div className="rounded-xl border border-white/10 bg-white/5 p-4">
<div className="text-sm">Medium Threshold</div>
<input type="range" min={0.5} max={0.9} step={0.01} value={p.medThreshold} onChange={(e) => setP({ ...p, medThreshold: Number(e.target.value) })} className="mt-2 w-full" />
<div className="text-xs text-white/70">{p.medThreshold.toFixed(2)}</div>
</div>
<div className="rounded-xl border border-white/10 bg-white/5 p-4">
<div className="text-sm">Retention (hours)</div>
<input type="number" value={p.retentionHours} onChange={(e) => setP({ ...p, retentionHours: parseInt(e.target.value || "0") })} className="mt-2 w-full rounded-lg border border-white/10 bg-black/50 p-2" />
</div>
<div className="rounded-xl border border-white/10 bg-white/5 p-4">
<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.redactFaces} onChange={(e) => setP({ ...p, redactFaces: e.target.checked })} /> Redact faces by default</label>
</div>
</div>


<div className="mt-4 flex gap-3">
<button className="rounded-xl bg-mil-green px-4 py-2 font-semibold text-black">Save</button>
<button className="rounded-xl bg-white/10 px-4 py-2 hover:bg-white/15">Reset</button>
</div>
</div>
)
}