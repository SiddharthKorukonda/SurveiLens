import React from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../lib/state";

export default function UserHome() {
  const servers = useStore((s) => s.servers);
  const remove = useStore((s) => s.removeServer);
  const nav = useNavigate();

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-2 text-sm text-white/70">
        Manage your deployments. Use the action buttons to navigate. Clicking the card background does nothing.
      </div>
      <div className="flex items-center justify-between">
        <div className="text-2xl font-bold">Your Servers</div>
        <button
          onClick={() => nav("/servers/new")}
          className="rounded-xl bg-white/10 px-3 py-1.5 hover:bg-white/15"
        >
          Create Server
        </button>
      </div>

      {servers.length === 0 ? (
        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4 text-white/70">
          No servers yet. Click “Create Server”.
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
          {servers.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-white/10 bg-white/5 p-4"
            >
              <div className="text-lg font-semibold">{s.name}</div>
              <div className="text-sm text-white/70">
                {s.cameras.length} camera(s) • {new Date(s.createdAt).toLocaleString()}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <button onClick={() => nav(`/servers/${s.id}/analyze`)} className="rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/15">Analyze</button>
                <button onClick={() => nav(`/servers/${s.id}/reports`)} className="rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/15">Reports</button>
                <button onClick={() => nav(`/servers/${s.id}/review`)}  className="rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/15">Reviews</button>
                <button onClick={() => nav(`/servers/${s.id}/audit`)}   className="rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/15">Audit</button>
                <button onClick={() => nav(`/servers/${s.id}/policy`)}  className="rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/15">Policy</button>
                <button
                  onClick={() => remove(s.id)}
                  className="rounded-lg bg-red-500/15 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/25"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
