import { API_BASE } from "./env.js";
import { prettySeconds } from "./ui-helpers.js";

const runningEl = document.getElementById("home-running");
const uptimeEl = document.getElementById("home-uptime");
const statusEl = document.getElementById("home-status-msg");

async function fetchStatus() {
  try {
    const res = await fetch(`${API_BASE}/pipeline/status`);
    if (!res.ok) throw new Error("bad status");
    const data = await res.json();
    runningEl.textContent = data.running ? "Online" : "Idle";
    runningEl.className = data.running ? "badge" : "badge";
    uptimeEl.textContent = prettySeconds(data.uptime_sec);
    statusEl.textContent = "Latest status fetched.";
  } catch {
    statusEl.textContent = "Status: Unknown";
  }
}

if (runningEl) {
  fetchStatus();
}
