import React, { useEffect, useRef } from "react"


export default function LogsBox({ lines }: { lines: string[] }) {
const ref = useRef<HTMLDivElement>(null)
useEffect(() => {
const el = ref.current
if (!el) return
el.scrollTop = el.scrollHeight
}, [lines.length])


return (
<div ref={ref} className="h-80 w-full overflow-auto rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-xs leading-relaxed">
{lines.length === 0 ? (
<div className="opacity-60">No logs yet. Live server output will appear here.</div>
) : (
lines.map((l, i) => (
<div key={i} className="whitespace-pre">
{l}
</div>
))
)}
</div>
)
}