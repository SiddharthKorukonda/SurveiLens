import React from "react"
import { useAuth0 } from "@auth0/auth0-react"
import { motion } from "framer-motion"
import RadarBackground from "../components/RadarBackground"


export default function Home() {
const { loginWithRedirect } = useAuth0()
return (
<div className="relative flex h-[84vh] items-center justify-center overflow-hidden">
<RadarBackground />
<motion.div
initial={{ opacity: 0, y: 12 }}
animate={{ opacity: 1, y: 0 }}
transition={{ type: "spring", stiffness: 260, damping: 24 }}
className="relative z-10 mx-auto max-w-3xl text-center"
>
<div className="text-6xl font-extrabold tracking-tight text-mil-green">SurveiLens</div>
<p className="mx-auto mt-4 max-w-2xl text-lg text-white/85">
Real‑time, privacy‑aware security analytics with human‑in‑the‑loop guidance.
</p>
<button
onClick={() => loginWithRedirect()}
className="mt-8 rounded-2xl bg-mil-green px-6 py:3 py-2.5 text-lg font-bold text-black shadow-lg shadow-mil-green/20 transition hover:scale-[1.02]"
>
Get Started
</button>
</motion.div>
</div>
)
}