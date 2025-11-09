import React, { useState } from "react"
import LogsBox from "../components/LogsBox"


export default function Audit() {
const [range, setRange] = useState(24)
const [lines] = useState<string[]>([
`${new Date().toISOString()} POLICY armed policy v1.2 loaded`,
`${new Date().toISOString()} CHAIN solana anchor recorded tx aaf9c..e12`,
`${new Date().toISOString()} AUTH Auth0 token verified for user: sid@stonybrook.edu`,
])


return (
<div className="mx-auto max-w-5xl p-6">
<div className="mb-2 text-sm text-white/70">Time‑filter logs, on‑chain receipts, and auth events for compliance audits.</div>
<div className="text-2xl font-bold">Audit</div>


<div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
<div className="rounded-xl border border-white/10 bg-white/5 p-4">
<div className="text-sm font-semibold">Time Range</div>
<input type="range" min={1} max={72} value={range} onChange={(e) => setRange(parseInt(e.target.value))} className="mt-3 w-full" />
<div className="mt-1 text-xs text-white/70">Last {range} hours</div>
</div>
<div className="rounded-xl border border-white/10 bg-white/5 p-4">
<div className="text-sm font-semibold">Filters</div>
<div className="mt-2 space-y-2 text-sm">
<label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> Alerts</label>
<label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> Auth</label>
<label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> Chain</label>
</div>
</div>
<div className="rounded-xl border border-white/10 bg-white/5 p-4">
<div className="text-sm font-semibold">Export</div>
<button className="mt-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/15">Download CSV</button>
</div>
</div>


<div className="mt-4">
<LogsBox lines={lines} />
</div>
</div>
)
}