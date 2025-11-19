import { API_BASE } from "./env.js";
import { toLocal } from "./ui-helpers.js";

const timeFilterEl = document.getElementById("alerts-time");
const severityFilterEl = document.getElementById("alerts-severity");
const searchInputEl = document.getElementById("alerts-search");
const tableEl = document.getElementById("alerts-table");
const emptyEl = document.getElementById("alerts-empty");

let alerts = [];
let pollingId;
let sourceLabel = null;
let configured = true;
let lastDigest = null;

const ALERT_SOURCES = [
  { url: `${API_BASE}/alerts`, parser: "json", label: "Live alerts API" },
  { url: `${API_BASE}/alerts.jsonl`, parser: "text", label: "alerts.jsonl (API host)" },
  { url: "/alerts", parser: "json", label: "Local /alerts" },
  { url: "/alerts.jsonl", parser: "text", label: "alerts.jsonl" },
];

async function fetchPayload(url, parser) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "pragma": "no-cache", "cache-control": "no-cache" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return parser === "json" ? response.json() : response.text();
}

async function loadAlerts() {
  let lastError;
  for (const source of ALERT_SOURCES) {
    try {
      const payload = await fetchPayload(source.url, source.parser);
      sourceLabel = source.label;
      configured = true;
      return source.parser === "json" ? normalizeArray(payload) : normalizeLines(payload);
    } catch (err) {
      lastError = err;
    }
  }
  configured = false;
  throw lastError || new Error("Alerts endpoint not configured");
}

function normalizeArray(payload) {
  if (!Array.isArray(payload)) return [];
  return payload;
}

function normalizeLines(text) {
  if (!text) return [];
  const lines = text.split(/\n+/).filter(Boolean);
  const parsed = [];
  for (const line of lines) {
    try {
      parsed.push(JSON.parse(line));
    } catch {
      // skip malformed
    }
  }
  return parsed;
}

function applyFilters() {
  const windowMinutes = Number(timeFilterEl.value);
  const severity = severityFilterEl.value;
  const searchTerm = searchInputEl.value.trim().toLowerCase();
  const now = Date.now();

  return alerts.filter((alert) => {
    if (windowMinutes) {
      const ts = Date.parse(alert.timestamp || alert.created_at || 0);
      if (Number.isFinite(ts)) {
        if (now - ts > windowMinutes * 60 * 1000) return false;
      }
    }
    if (severity !== "all") {
      const level = (alert.frame_level || alert.severity || "").toLowerCase();
      if (level !== severity) return false;
    }
    if (searchTerm) {
      const labels = (alert.labels || []).join(" ").toLowerCase();
      if (!labels.includes(searchTerm)) return false;
    }
    return true;
  });
}

function severityClass(level) {
  const l = (level || "").toLowerCase();
  if (l.includes("high")) return "alert-pill alert-high";
  if (l.includes("medium")) return "alert-pill alert-medium";
  return "alert-pill alert-low";
}

function determineSeverity(alert) {
  return (alert.frame_level || alert.danger_level || alert.severity || (alert.neuralseek?.escalation_level) || "low").toLowerCase();
}

function buildSummary(alert) {
  if (alert.summary) return alert.summary;
  if (alert.description) return alert.description;
  if (alert.neuralseek?.summary) return alert.neuralseek.summary;
  if (alert.neuralseek_async?.summary) return alert.neuralseek_async.summary;
  const labels = (alert.labels || alert.weapons_detected || []).filter(Boolean);
  if (labels.length) {
    return `Detected ${labels.join(", ")} with elevated risk`;
  }
  if (alert.danger_score) {
    return `Danger score ${Number(alert.danger_score).toFixed(2)}`;
  }
  return "High danger frame detected";
}

function digestAlerts(list) {
  return list.map((a) => `${a.timestamp || a.created_at}-${(a.labels || []).join(".")}`).join("|");
}

function renderTable() {
  const filtered = applyFilters();
  if (!configured) {
    emptyEl.textContent = "Alerts API not configured yet.";
    emptyEl.style.display = "block";
    tableEl.innerHTML = "";
    return;
  }
  if (!filtered.length) {
    emptyEl.textContent = sourceLabel ? `No alerts (${sourceLabel})` : "No alerts";
    emptyEl.style.display = "block";
    tableEl.innerHTML = "";
    return;
  }
  emptyEl.style.display = "none";
  const rows = filtered.map((alert) => {
    const ts = toLocal(alert.timestamp || alert.created_at);
    const level = determineSeverity(alert);
    const labels = (alert.labels || alert.weapons_detected || []).join(", ") || "—";
    const summary = buildSummary(alert);
    return `
      <tr>
        <td>${ts}</td>
        <td><span class="${severityClass(level)}">${level}</span></td>
        <td>${labels}</td>
        <td>${summary}</td>
      </tr>
    `;
  });
  tableEl.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Time</th>
          <th>Severity</th>
          <th>Labels</th>
          <th>Summary</th>
        </tr>
      </thead>
      <tbody>${rows.join("")}</tbody>
    </table>
  `;
}

async function pollAlerts() {
  try {
    const next = await loadAlerts();
    const digest = digestAlerts(next);
    if (digest !== lastDigest) {
      alerts = next.sort((a, b) => {
        const ta = Date.parse(a.timestamp || a.created_at || 0);
        const tb = Date.parse(b.timestamp || b.created_at || 0);
        return (tb || 0) - (ta || 0);
      });
      lastDigest = digest;
    }
  } catch (err) {
    if (!configured) {
      renderTable();
      clearInterval(pollingId);
      return;
    }
    console.warn("alerts", err);
  }
  renderTable();
}

function init() {
  [timeFilterEl, severityFilterEl, searchInputEl].forEach((el) => {
    el?.addEventListener("input", renderTable);
    el?.addEventListener("change", renderTable);
  });
  pollAlerts();
  pollingId = setInterval(pollAlerts, 3000);
}

init();
