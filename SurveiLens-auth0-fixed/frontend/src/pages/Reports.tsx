import React, { useEffect, useState } from "react"
import LogsBox from "../components/LogsBox"


export default function Reports() {
const [lines, setLines] = useState<string[]>([])
useEffect(() => {
const id = setInterval(() => {
const stamp = new Date().toISOString()
setLines((arr) => [...arr, `${stamp} INFO [worker] heartbeat ok`].slice(-200))
}, 4000)
return () => clearInterval(id)
}, [])


return (
<div className="mx-auto max-w-5xl p-6">
<div className="mb-2 text-sm text-white/70">System logs and pipeline messages. Useful for debugging and audits.</div>
<div className="text-2xl font-bold">Reports</div>
<div className="mt-4">
<LogsBox lines={lines} />
</div>
</div>
)
}