// src/pages/ServerCreate.tsx
import React, { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { useStore, type Camera, type Server } from "../lib/state"

function CamEditor({ cam, onChange, onRemove, disableId }: {
  cam: Camera; onChange: (c: Camera) => void; onRemove: () => void; disableId?: boolean
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="text-xs text-white/60">Camera ID</label>
          <input value={cam.id} disabled={!!disableId}
                 onChange={(e) => onChange({ ...cam, id: e.target.value })}
                 className="mt-1 w-full rounded-lg border border-white/10 bg-black/60 p-2" />
        </div>
        <div>
          <label className="text-xs text-white/60">Label</label>
          <input value={cam.label}
                 onChange={(e) => onChange({ ...cam, label: e.target.value })}
                 className="mt-1 w-full rounded-lg border border-white/10 bg-black/60 p-2"
                 placeholder="South Entrance" />
        </div>
        <div>
          <label className="text-xs text-white/60">Peer Host/IP</label>
          <input required value={cam.host}
                 onChange={(e) => onChange({ ...cam, host: e.target.value })}
                 className="mt-1 w-full rounded-lg border border-white/10 bg-black/60 p-2"
                 placeholder="192.168.1.25" />
        </div>
        <div>
          <label className="text-xs text-white/60">Port</label>
          <input required value={cam.port}
                 onChange={(e) => onChange({ ...cam, port: e.target.value })}
                 className="mt-1 w-full rounded-lg border border-white/10 bg-black/60 p-2"
                 placeholder="8080" />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-white/60">Stream URL (WebRTC / WS / HLS)</label>
          <input value={cam.streamUrl ?? ""}
                 onChange={(e) => onChange({ ...cam, streamUrl: e.target.value })}
                 className="mt-1 w-full rounded-lg border border-white/10 bg-black/60 p-2 font-mono"
                 placeholder="wss://peer-1.local/stream/cam-a" />
        </div>
        <div>
          <label className="text-xs text-white/60">OS</label>
          <input value={cam.os ?? ""}
                 onChange={(e) => onChange({ ...cam, os: e.target.value })}
                 className="mt-1 w-full rounded-lg border border-white/10 bg-black/60 p-2"
                 placeholder="macOS / Windows / Linux" />
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <button onClick={onRemove} className="rounded-lg bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10">Remove</button>
      </div>
    </div>
  )
}

export default function ServerCreate() {
  const nav = useNavigate()
  const addServer = useStore((s) => s.addServer)
  const [name, setName] = useState("")
  const [cams, setCams] = useState<Camera[]>([])

  const canAddMore = cams.length < 4
  const nextId = useMemo(() => `cam-${String.fromCharCode(97 + cams.length)}`, [cams.length])

  function addCam() {
    if (!canAddMore) return
    setCams((arr) => [...arr, {
      id: nextId, label: nextId.toUpperCase(), host: "", port: "", streamUrl: "", os: ""
    }])
  }

  function save() {
    if (!name) return alert("Please name your server")
    if (cams.length === 0) return alert("Add at least one camera")
    if (cams.some((c) => !c.host || !c.port)) return alert("All cameras need Host and Port")

    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
    const server: Server = { id, name, cameras: cams, createdAt: Date.now() }
    addServer(server)
    nav(`/servers/${id}/analyze`)   // go straight to the live view of the server you just made
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-2 text-sm text-white/70">Create a server and pair up to four teammate computers as cameras.</div>
      <div className="text-2xl font-bold">Create Server</div>

      <div className="mt-4">
        <label className="text-xs text-white/60">Server name</label>
        <input value={name} onChange={(e) => setName(e.target.value)}
               className="mt-1 w-full rounded-xl border border-white/10 bg-black/50 p-3"
               placeholder="Campus West – K3" />
      </div>

      <div className="mt-6 text-lg font-semibold">Cameras</div>
      <div className="mt-2 grid gap-3">
        {cams.map((c, idx) => (
          <motion.div key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <CamEditor
              cam={c}
              disableId
              onChange={(next) => setCams((arr) => arr.map((x, i) => (i === idx ? next : x)))}
              onRemove={() => setCams((arr) => arr.filter((_, i) => i !== idx))}
            />
          </motion.div>
        ))}
      </div>

      {canAddMore ? (
        <button onClick={addCam} className="mt-3 rounded-xl bg-white/10 px-3 py-1.5 hover:bg-white/15">Add camera</button>
      ) : (
        <div className="mt-3 text-sm text-white/70">Max 4 cameras reached. Add/Remove above to adjust.</div>
      )}

      <div className="mt-6 flex gap-3">
        <button onClick={save} className="rounded-xl bg-mil-green px-4 py-2 font-semibold text-black">Done</button>
        <button onClick={() => nav("/home")} className="rounded-xl bg-white/10 px-4 py-2 hover:bg-white/15">Cancel</button>
      </div>
    </div>
  )
}
