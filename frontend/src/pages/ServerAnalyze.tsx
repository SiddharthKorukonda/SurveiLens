import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useStore } from "../lib/state";
import { connectEvents } from "../lib/sse";
import BackButton from "../components/BackButton";
import VideoTile from "../components/VideoTile";
import AlertCard from "../components/AlertCard";

type Toast = { id: string; a: any; at: number };

export default function ServerAnalyze() {
  const { id } = useParams();
  const server = useStore((s) => s.servers.find((x) => x.id === id));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  // health stub (you can wire to backend /servers/:id/health)
  const health = useMemo(() => {
    return {
      status: "Healthy",
      cams: server?.cameras.length ?? 0,
      started: server ? new Date(server.createdAt).toLocaleString() : "",
    };
  }, [server]);

  useEffect(() => {
    if (!id) return;
    return connectEvents(id, (payload) => {
      if (payload?.type === "alert") {
        const a = payload.alert || payload;
        const level = a.danger_level || a.level;
        if (level === "HIGH" || level === "MED") {
          setToasts((arr) => [
            ...arr,
            { id: a.alert_id || Math.random().toString(36).slice(2), a, at: Date.now() },
          ]);
        }
      }
    });
  }, [id]);

  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      setToasts((arr) => arr.filter((x) => now - x.at < 8000)); // auto-dismiss after 8s
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const cams = server?.cameras ?? [];
  const cols = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(cams.length))));
  const gridCls = `grid grid-cols-1 gap-3 md:grid-cols-${cols}`;

  return (
    <div className="relative h-[calc(100vh-72px)] w-full p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <BackButton label="Back" />
        <div className="text-lg font-semibold">Video Surveillance</div>
        <div />
      </div>

      {/* Video wall */}
      <div className={`${gridCls} h-[calc(100%-3rem)] overflow-auto`}>
        {cams.map((c) => (
          <VideoTile key={c.id} label={c.label} streamUrl={c.streamUrl} />
        ))}
        {cams.length === 0 && (
          <div className="flex h-full items-center justify-center rounded-xl border border-white/10 bg-white/5 p-6 text-white/70">
            No cameras configured.
          </div>
        )}
      </div>

      {/* Health small box top-left */}
      <div className="pointer-events-none absolute left-3 top-[4.25rem] rounded-xl border border-white/10 bg-black/50 p-3 text-xs backdrop-blur">
        <div className="font-semibold">Server Health</div>
        <div className="opacity-80">Status: {health.status}</div>
        <div className="opacity-80">Cameras: {health.cams}</div>
        <div className="opacity-80">{health.started}</div>
      </div>

      {/* MED/HIGH toasts top-right */}
      <div className="pointer-events-none absolute right-3 top-[4.25rem] flex w-[340px] flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <AlertCard a={t.a} />
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
