import { create } from "zustand"


export type Camera = {
id: string // cam-a, cam-b, etc
label: string
host: string
port: string
streamUrl?: string // ws/webrtc/http
os?: string
}


export type Server = {
id: string // slug
name: string
cameras: Camera[]
createdAt: number
}


type Store = {
servers: Server[]
addServer: (s: Server) => void
updateServer: (id: string, next: Partial<Server>) => void
addOrUpdateCamera: (serverId: string, cam: Camera) => void
}


const key = "surveilens.store.v1"


const load = () => {
try {
const raw = localStorage.getItem(key)
if (!raw) return [] as Server[]
return JSON.parse(raw) as Server[]
} catch {
return [] as Server[]
}
}


const save = (servers: Server[]) => {
try {
localStorage.setItem(key, JSON.stringify(servers))
} catch {}
}


export const useStore = create<Store>((set, get) => ({
servers: [],
addServer: (s) => set((st) => { const next = [...st.servers, s]; save(next); return { servers: next } }),
updateServer: (id, next) => set((st) => { const arr = st.servers.map((sv) => (sv.id === id ? { ...sv, ...next } : sv)); save(arr); return { servers: arr } }),
addOrUpdateCamera: (serverId, cam) => set((st) => {
const arr = st.servers.map((sv) => {
if (sv.id !== serverId) return sv
const idx = sv.cameras.findIndex((c) => c.id === cam.id)
const cams = idx >= 0 ? sv.cameras.map((c, i) => (i === idx ? cam : c)) : [...sv.cameras, cam]
return { ...sv, cameras: cams }
})
save(arr)
return { servers: arr }
}),
}))


// initialize from localStorage once
if (typeof window !== "undefined") {
const servers = load()
;(useStore as any).setState({ servers })
}