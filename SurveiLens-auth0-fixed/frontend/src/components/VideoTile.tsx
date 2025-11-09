import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Info } from "lucide-react"


export type VideoMetrics = {
latencyMs: number
fps: number
resolution: string
dropped: number
}


export default function VideoTile({
label,
streamUrl,
metrics,
}: {
label: string
streamUrl?: string
metrics: VideoMetrics
}) {
const [open, setOpen] = useState(false)


return (
<div className="relative rounded-2xl border border-white/10 bg-black/40 overflow-hidden group">
{/* Header */}
<div className="absolute left-3 top-3 z-10 rounded-md bg-black/60 px-2 py-1 text-xs text-white/90 backdrop-blur">
{label}
</div>


{/* Video or placeholder */}
{streamUrl ? (
<video src={streamUrl} className="h-full w-full object-cover" playsInline autoPlay muted />
) : (
<div className="flex h-full w-full items-center justify-center text-sm opacity-70">
Awaiting stream…
</div>
)}


{/* Info button */}
<button
onClick={() => setOpen((v) => !v)}
className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1 text-xs text-white/90 backdrop-blur transition hover:bg-black/80"
>
<Info className="h-4 w-4" /> Info
</button>


{/* Popover */}
<AnimatePresence>
{open && (
<motion.div
initial={{ opacity: 0, y: 8 }}
animate={{ opacity: 1, y: 0 }}
exit={{ opacity: 0, y: 8 }}
transition={{ type: "spring", stiffness: 260, damping: 22 }}
className="absolute bottom-12 right-3 z-20 w-56 rounded-xl border border-white/10 bg-zinc-900/95 p-3 text-sm shadow-2xl"
>
<div className="mb-1 text-xs uppercase tracking-wide text-white/60">Diagnostics</div>
<div className="space-y-1.5">
<div className="flex justify-between"><span className="text-white/70">Latency</span><span className="font-mono">{metrics.latencyMs} ms</span></div>
<div className="flex justify-between"><span className="text-white/70">FPS</span><span className="font-mono">{metrics.fps}</span></div>
<div className="flex justify-between"><span className="text-white/70">Resolution</span><span className="font-mono">{metrics.resolution}</span></div>
<div className="flex justify-between"><span className="text-white/70">Dropped</span><span className="font-mono">{metrics.dropped}</span></div>
</div>
</motion.div>
)}
</AnimatePresence>


{/* subtle gradient on hover */}
<div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100" style={{ background: "linear-gradient(180deg, rgba(16,255,120,0.05), transparent 50%, rgba(16,255,120,0.03))" }} />
</div>
)
}