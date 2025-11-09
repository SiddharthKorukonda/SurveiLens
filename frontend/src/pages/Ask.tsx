import React, { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"


type Msg = { role: "user" | "assistant"; text: string }


export default function Ask() {
const [input, setInput] = useState("")
const [msgs, setMsgs] = useState<Msg[]>([
{ role: "assistant", text: "Hi, I’m your SurveiLens assistant. Ask me to focus on a camera, summarize alerts, or filter events." },
])
const endRef = useRef<HTMLDivElement>(null)
useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [msgs.length])


function handleSend() {
const text = input.trim()
if (!text) return
setMsgs((m) => [...m, { role: "user", text }])
setInput("")


// Simple local command handling
if (/focus\s+cam-([abcd])/i.test(text)) {
const id = text.match(/focus\s+cam-([abcd])/i)![1]
setMsgs((m) => [...m, { role: "assistant", text: `Okay, pinning cam-${id} to the top left and increasing sample rate for the next 10 minutes.` }])
return
}


// Default mock reply
setTimeout(() => {
setMsgs((m) => [...m, { role: "assistant", text: "Got it. I’ll watch for spikes and notify you if anything crosses your HIGH threshold." }])
}, 600)
}


return (
<div className="mx-auto flex h-[76vh] max-w-3xl flex-col p-6">
<div className="mb-2 text-sm text-white/70">Ask the AI to steer attention, summarize alerts, or query logs.</div>
<div className="text-2xl font-bold">Chat</div>


<div className="mt-4 flex-1 overflow-auto rounded-xl border border-white/10 bg-black/40 p-4">
{msgs.map((m, i) => (
<motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`mb-3 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
<div className={`${m.role === "user" ? "bg-mil-green text-black" : "bg-white/10 text-white"} max-w-[80%] rounded-2xl px-3 py-2 text-sm`}>{m.text}</div>
</motion.div>
))}
<div ref={endRef} />
</div>


<div className="mt-3 flex gap-2">
<input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSend()} className="w-full rounded-xl border border-white/10 bg-black/60 p-3" placeholder="e.g., focus cam-b and summarize last 10 mins" />
<button onClick={handleSend} className="rounded-xl bg-mil-green px-4 py-2 font-semibold text-black">Send</button>
</div>
</div>
)
}