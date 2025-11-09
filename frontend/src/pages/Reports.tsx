import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import BackButton from "../components/BackButton";
import LogsBox from "../components/LogsBox";
import { connectLogs } from "../lib/sse";

export default function Reports() {
  const { id } = useParams();
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    if (!id) return;
    return connectLogs(id, (line) =>
      setLines((arr) => [...arr, line].slice(-1000)) // keep last 1000
    );
  }, [id]);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <BackButton />
      <div className="mb-2 text-sm text-white/70">
        Live system output. Video/audio recording notices, JSON creation, alert sends, Snowflake writes, SOS, transcript, and any errors.
      </div>
      <div className="text-2xl font-bold">Reports</div>
      <div className="mt-4">
        <LogsBox lines={lines} />
      </div>
    </div>
  );
}
