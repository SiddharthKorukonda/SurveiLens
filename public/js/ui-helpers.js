let toastContainer;

function ensureToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.className = "toast-container";
    document.body.appendChild(toastContainer);
  }
}

export function toast(message, type = "info", ttlMs = 4000) {
  ensureToastContainer();
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  toastContainer.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(-6px)";
  }, ttlMs - 600);
  setTimeout(() => el.remove(), ttlMs);
}

export function prettySeconds(seconds) {
  if (seconds == null) return "—";
  const s = Number(seconds);
  if (!Number.isFinite(s)) return "—";
  if (s < 60) return `${s.toFixed(1)}s`;
  const mins = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${mins}m ${rem}s`;
}

export function toLocal(isoString) {
  if (!isoString) return "—";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return date.toLocaleString();
}

export function setStatusPill(text, live = false) {
  const pill = document.getElementById("status-text");
  const dot = document.getElementById("status-dot");
  if (pill) pill.textContent = text;
  if (dot) dot.classList.toggle("live", !!live);
}

export function updateBadge(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
