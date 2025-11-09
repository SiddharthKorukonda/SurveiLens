import React, { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import BackButton from "../components/BackButton";
import { cfg } from "../lib/config";

type Row = string[];

export default function Audit() {
  const { id } = useParams();
  const [hours, setHours] = useState(24);
  const [rows, setRows] = useState<Row[]>([]);
  const [header, setHeader] = useState<string[] | null>(null);

  const range = useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - hours * 3600 * 1000);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [hours]);

  const preview = async () => {
    if (!id || !cfg.USE_BACKEND) return;
    const url = `${cfg.API_BASE}/servers/${encodeURIComponent(id)}/audit.csv?from=${encodeURIComponent(
      range.from
    )}&to=${encodeURIComponent(range.to)}&limit=100`;
    const res = await fetch(url);
    const text = await res.text();
    const lines = text.trim().split(/\r?\n/);
    if (lines.length === 0) {
      setHeader(null);
      setRows([]);
      return;
    }
    const head = lines[0].split(",");
    const body = lines.slice(1).map((l) => l.split(","));
    setHeader(head);
    setRows(body);
  };

  const downloadUrl = id
    ? `${cfg.API_BASE}/servers/${encodeURIComponent(id)}/audit.csv?from=${encodeURIComponent(
        range.from
      )}&to=${encodeURIComponent(range.to)}`
    : "#";

  return (
    <div className="mx-auto max-w-5xl p-6">
      <BackButton />
      <div className="mb-2 text-sm text-white/70">
        Audit the information captured in the selected window. Preview rows below and download a CSV. All downloads are logged in Reports.
      </div>
      <div className="text-2xl font-bold">Audits</div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold">Time Range</div>
          <div className="mt-2 text-xs opacity-80">Past {hours} hour(s)</div>
          <input
            type="range"
            min={1}
            max={168}
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="mt-3 w-full"
          />
          <div className="mt-2 text-xs opacity-70">
            {new Date(range.from).toLocaleString()} → {new Date(range.to).toLocaleString()}
          </div>
          <button onClick={preview} className="mt-3 rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/15">
            Preview
          </button>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold">Export</div>
          <a
            href={downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block rounded-lg bg-mil-green px-3 py-1.5 text-sm font-semibold text-black"
          >
            Download CSV
          </a>
        </div>
      </div>

      <div className="mt-4 overflow-auto rounded-xl border border-white/10">
        {header ? (
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/10">
              <tr>
                {header.map((h, i) => (
                  <th key={i} className="px-3 py-2 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="odd:bg-white/5">
                  {r.map((c, j) => (
                    <td key={j} className="whitespace-pre-wrap px-3 py-2">{c}</td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="px-3 py-3 text-white/70">No rows.</td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <div className="p-4 text-sm text-white/70">Click Preview to load recent records.</div>
        )}
      </div>
    </div>
  );
}
