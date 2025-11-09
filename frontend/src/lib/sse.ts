import { cfg } from "./config";

/**
 * Connect to server-sent events for ALERTS.
 * Backend endpoint: GET {API_BASE}/servers/:id/events  (text/event-stream)
 */
export function connectEvents(serverId: string, onEvent: (e: any) => void) {
  let es: EventSource | null = null;

  if (cfg.USE_BACKEND) {
    const url = `${cfg.API_BASE}/servers/${encodeURIComponent(serverId)}/events`;
    es = new EventSource(url);
    es.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        onEvent(payload);
      } catch (e) {
        // ignore malformed lines
      }
    };
    es.onerror = () => {
      // Let the browser retry automatically
    };
    return () => es?.close();
  }

  // No mocks. No random generation.
  console.warn("connectEvents: backend disabled and mocks disabled; no alerts will be received.");
  return () => {};
}

/**
 * Connect to server-sent events for LOGS.
 * Backend endpoint: GET {API_BASE}/servers/:id/logs  (text/event-stream)
 */
export function connectLogs(serverId: string, onLine: (line: string) => void) {
  if (!cfg.USE_BACKEND) {
    console.warn("connectLogs: backend disabled; no logs will be received.");
    return () => {};
  }
  const url = `${cfg.API_BASE}/servers/${encodeURIComponent(serverId)}/logs`;
  const es = new EventSource(url);
  es.onmessage = (ev) => {
    try {
      const line = ev.data as string;
      if (line) onLine(line);
    } catch {}
  };
  es.onerror = () => {};
  return () => es.close();
}
