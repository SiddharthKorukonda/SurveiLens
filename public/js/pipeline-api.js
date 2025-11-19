import { API_BASE } from "./env.js";

async function http(path, { method = "GET", body } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

export function startDetection(payload) {
  return http("/start", { method: "POST", body: payload });
}

export function stopDetection() {
  return http("/stop", { method: "POST" });
}

export function getStatus() {
  return http("/pipeline/status");
}
