import React, { useEffect, useState } from "react"
import AlertCard from "../components/AlertCard"


export default function ReviewQueue() {
const [items, setItems] = useState<any[]>([])
const [busy, setBusy] = useState(false)


useEffect(() => {
// seed a few demo items
setItems([
{ alert_id: "a1", camera_id: "cam-a", created_at: Date.now(), danger_level: "HIGH", danger_score: 93, confidence: 0.91, reason: "Object resembles a knife" },
{ alert_id: "a2", camera_id: "cam-b", created_at: Date.now(), danger_level: "MED", danger_score: 71, confidence: 0.78, reason: "Aggressive motion cluster" },
])
}, [])


function onApprove(a: any) {
setBusy(true)
setTimeout(() => {
setItems((arr) => arr.filter((x) => x.alert_id !== a.alert_id))
setBusy(false)
}, 600)
}


return (
<div className="mx-auto max-w-4xl p-6">
<div className="mb-2 text-sm text-white/70">Human‑in‑the‑loop triage. Approve or dismiss machine‑flagged events.</div>
<div className="text-2xl font-bold">Review</div>
<div className="mt-4 space-y-2">
{items.length === 0 ? (
<div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">Nothing to review.</div>
) : (
items.map((a) => (
<div key={a.alert_id} className="flex items-center justify-between gap-4">
<AlertCard a={a} />
<div className="flex gap-2">
<button disabled={busy} onClick={() => onApprove(a)} className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50">Approve</button>
<button disabled={busy} onClick={() => onApprove(a)} className="rounded-lg bg-red-500/20 px-3 py-1.5 text-red-300 hover:bg-red-500/25 disabled:opacity-50">Dismiss</button>
</div>
</div>
))
)}
</div>
</div>
)
}