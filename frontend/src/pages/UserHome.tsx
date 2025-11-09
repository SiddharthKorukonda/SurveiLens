import React from "react"
import { Link } from "react-router-dom"
import { useStore } from "../lib/state"


export default function UserHome() {
const servers = useStore((s) => s.servers)
return (
<div className="mx-auto max-w-5xl p-6">
<div className="mb-2 text-sm text-white/70">Manage your deployments. Click a server to view live feeds and alerts.</div>
<div className="flex items-center justify-between">
<div className="text-2xl font-bold">Your Servers</div>
<Link to="/servers/new" className="rounded-xl bg-white/10 px-3 py-1.5 hover:bg-white/15">Create Server</Link>
</div>


{servers.length === 0 ? (
<div className="mt-8 rounded-xl border border-white/10 bg-black/40 p-6 text-white/80">
No servers yet. Click <span className="font-semibold">Create Server</span> to add up to 4 cameras.
</div>
) : (
<div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
{servers.map((s) => (
<Link key={s.id} to={`/servers/${s.id}`} className="rounded-xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10">
<div className="text-lg font-semibold">{s.name}</div>
<div className="text-sm text-white/70">{s.cameras.length} camera(s) • {new Date(s.createdAt).toLocaleString()}</div>
<div className="mt-2 text-xs text-emerald-400/80">Live server log active</div>
</Link>
))}
</div>
)}
</div>
)
}