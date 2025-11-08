import React from 'react'
export default function MetricsPanel({latency=120, queue=0}:{latency?:number, queue?:number}){
  return (<div className="p-4 rounded-xl border border-white/10 bg-black/30"><div className="text-lg font-semibold mb-2">Metrics</div><div className="text-sm opacity-80">Latency: {latency} ms</div><div className="text-sm opacity-80">Worker queue: {queue}</div></div>)
}
