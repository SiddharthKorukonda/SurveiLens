import React, { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { useStore } from "../lib/state"
import MetricsPanel from "../components/MetricsPanel"
import VideoTile from "../components/VideoTile"
import { connectEvents } from "../lib/sse"
import AlertCard from "../components/AlertCard"


export default function ServerAnalyze() {
const { id } = useParams()
const server = useStore((s) => s.servers.find((x) => x.id === id))
const [alerts, setAlerts] = useState<any[]>([])


useEffect(() => {
if (!server) return
const off = connectEvents(server.id, (e) => {
if (e?.type === "alert") setAlerts((a) => [e.alert, ...a].slice(0, 50))
})
return off
}, [server?.id])


const metrics = useMemo(() => ({ latencyMs: 110, fps: 29, resolution: "1280×720", dropped: 0 }), [])


if (!server) return <div className="p-6">Server not found.</div>


return (
<div className="mx-auto max-w-6xl p-6">
<div className="mb-2 text-sm text-white/70">Live video wall from paired devices. Click Info on a tile for diagnostics.</div>
<div className="mb-4 text-2xl font-bold">{server.name}</div>


<div className="grid grid-cols-4 gap-4">
<div className="col-span-3 grid grid-cols-2 gap-3">
{server.cameras.slice(0, 4).map((c) => (
<div key={c.id} className="h-52 md:h-64 lg:h-72">
<VideoTile label={`${c.label} (${c.id})`} streamUrl={c.streamUrl} metrics={metrics} />
</div>
))}
</div>
<div className="col-span-1 space-y-4">
<MetricsPanel latency={metrics.latencyMs} queue={Math.max(0, 4 - alerts.length % 4)} />
<div className="space-y-2">
<div className="text-lg font-semibold">Live Alerts</div>
<div className="space-y-2">
{alerts.length === 0 ? (
<div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">No alerts yet.</div>
) : (
alerts.map((a) => <AlertCard a={a} key={a.alert_id} />)
)}
</div>
</div>
</div>
</div>
</div>
)
}