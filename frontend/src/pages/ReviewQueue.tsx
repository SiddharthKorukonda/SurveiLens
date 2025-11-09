import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import BackButton from "../components/BackButton";
import AlertCard from "../components/AlertCard";
import { cfg } from "../lib/config";

export default function ReviewQueue() {
  const { id } = useParams();
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!id || !cfg.USE_BACKEND) return setItems([]);
    try {
      const res = await fetch(
        `${cfg.API_BASE}/servers/${encodeURIComponent(id)}/alerts?status=pending&levels=MED,HIGH`
      );
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [id]);

  const action = async (kind: "approve" | "dismiss", a: any) => {
    if (!id || !cfg.USE_BACKEND) return;
    setBusy(true);
    try {
      await fetch(`${cfg.API_BASE}/servers/${encodeURIComponent(id)}/alerts/${a.alert_id}/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ camera_id: a.camera_id, reason: a.reason || "", source: "review" }),
      });
      // Reload queue; backend should also log to /reports SSE
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <BackButton />
      <div className="mb-2 text-sm text-white/70">
        Medium and high danger events for human confirmation. Accepted items trigger the same SOS flow. All accepts/denies are logged in Reports.
      </div>
      <div className="text-2xl font-bold">Reviews</div>

      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">No items.</div>
        ) : (
          items.map((a) => (
            <div key={a.alert_id} className="flex items-center justify-between gap-4">
              <AlertCard a={a} />
              <div className="flex gap-2">
                <button
                  disabled={busy}
                  onClick={() => action("approve", a)}
                  className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-sm text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
                >
                  Accept &amp; Send SOS
                </button>
                <button
                  disabled={busy}
                  onClick={() => action("dismiss", a)}
                  className="rounded-lg bg-red-500/15 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/25 disabled:opacity-50"
                >
                  Deny
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
