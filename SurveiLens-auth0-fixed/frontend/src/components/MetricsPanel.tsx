import React from "react"
import { motion } from "framer-motion"


export default function MetricsPanel({ latency = 120, queue = 0 }: { latency?: number; queue?: number }) {
return (
<motion.div
initial={{ opacity: 0, y: 8 }}
animate={{ opacity: 1, y: 0 }}
transition={{ type: "spring", stiffness: 260, damping: 22 }}
className="rounded-2xl border border-white/10 bg-black/40 p-4"
>
<div className="text-lg font-semibold">Server Health</div>
<div className="mt-3 grid grid-cols-2 gap-3 text-sm">
<div className="rounded-lg bg-white/5 p-3">
<div className="opacity-70">Latency</div>
<div className="font-mono text-2xl">{latency} ms</div>
</div>
<div className="rounded-lg bg-white/5 p-3">
<div className="opacity-70">Worker queue</div>
<div className="font-mono text-2xl">{queue}</div>
</div>
</div>
</motion.div>
)
}