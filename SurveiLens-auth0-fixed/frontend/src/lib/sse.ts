export function connectEvents(serverId: string, onEvent: (e: any) => void) {
// Mocked stream: emits an alert every ~4–8 seconds
let alive = true
const levels = ["LOW", "MED", "HIGH"]
const cams = ["cam-a", "cam-b", "cam-c", "cam-d"]


async function loop() {
while (alive) {
await new Promise((r) => setTimeout(r, 3500 + Math.random() * 3000))
const lvl = levels[Math.floor(Math.random() * levels.length)]
const payload = {
type: "alert",
alert: {
alert_id: Math.random().toString(36).slice(2),
camera_id: cams[Math.floor(Math.random() * cams.length)],
created_at: Date.now(),
danger_level: lvl,
danger_score: Math.floor(50 + Math.random() * 50),
confidence: Number((0.5 + Math.random() * 0.5).toFixed(2)),
reason: lvl === "HIGH" ? "Weapon-like object detected" : lvl === "MED" ? "Unusual motion pattern" : "Noise spike",
},
}
onEvent(payload)
}
}


loop()
return () => {
alive = false
}
}