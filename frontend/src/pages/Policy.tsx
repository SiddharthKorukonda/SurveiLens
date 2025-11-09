import React, { useEffect, useState } from "react";
import BackButton from "../components/BackButton";
import { useParams } from "react-router-dom";
import { useStore, type Policy as P } from "../lib/state";
import { cfg } from "../lib/config";

export default function Policy() {
  const { id } = useParams();
  const localPolicy = useStore((s) => s.servers.find((x) => x.id === id)?.policy);
  const setPolicy = useStore((s) => s.setPolicy);

  const [p, setP] = useState<P>(
    localPolicy ?? { highThreshold: 0.85, medThreshold: 0.65, retentionHours: 24, redactFaces: true }
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id || !cfg.USE_BACKEND) return;
    (async () => {
      try {
        const res = await fetch(`${cfg.API_BASE}/servers/${encodeURIComponent(id)}/policy`);
        const data = await res.json();
        if (data && typeof data === "object") setP({
          highThreshold: Number(data.highThreshold ?? p.highThreshold),
          medThreshold: Number(data.medThreshold ?? p.medThreshold),
          retentionHours: Number(data.retentionHours ?? p.retentionHours),
          redactFaces: Boolean(data.redactFaces ?? p.redactFaces),
        });
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const save = async () => {
    if (!id) return;
    setSaving(true);
    try {
      // Persist locally for immediate UX
      setPolicy(id, p);

      // Persist to backend so scoring uses your thresholds
      if (cfg.USE_BACKEND) {
        await fetch(`${cfg.API_BASE}/servers/${encodeURIComponent(id)}/policy`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p),
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <BackButton />
      <div className="mb-2 text-sm text-white/70">
        Set detection thresholds and privacy defaults. The backend will classify HIGH at ≥ highThreshold and MED at ≥ medThreshold.
      </div>
      <div className="text-2xl font-bold">Policy</div>

      <div className="mt-4 grid grid-cols-1 gap-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <label className="text-xs text-white/60">High threshold</label>
          <input
            type="number"
            step="0.01"
            min={0}
            max={1}
            value={p.highThreshold}
            onChange={(e) => setP({ ...p, highThreshold: Number(e.target.value) })}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 p-2"
          />
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <label className="text-xs text-white/60">Medium threshold</label>
          <input
            type="number"
            step="0.01"
            min={0}
            max={1}
            value={p.medThreshold}
            onChange={(e) => setP({ ...p, medThreshold: Number(e.target.value) })}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 p-2"
          />
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <label className="text-xs text-white/60">Retention (hours)</label>
          <input
            type="number"
            min={1}
            value={p.retentionHours}
            onChange={(e) => setP({ ...p, retentionHours: Number(e.target.value) })}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 p-2"
          />
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={p.redactFaces}
              onChange={(e) => setP({ ...p, redactFaces: e.target.checked })}
            />
            Redact faces by default
          </label>
        </div>
      </div>

      <div className="mt-4 flex gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-xl bg-mil-green px-4 py-2 font-semibold text-black disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={() =>
            setP({ highThreshold: 0.85, medThreshold: 0.65, retentionHours: 24, redactFaces: true })
          }
          className="rounded-xl bg-white/10 px-4 py-2 hover:bg-white/15"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
