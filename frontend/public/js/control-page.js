import { readSecretFromQuery, getParam, getNumberParam, getBoolParam } from "./env.js";
import { toast, setStatusPill, updateBadge, prettySeconds } from "./ui-helpers.js";
import { startDetection, stopDetection, getStatus } from "./pipeline-api.js";
import { connectViewer } from "./webrtc.js";

const videoEl = document.getElementById("video");
const roomInput = document.getElementById("room-input");
const sourceInput = document.getElementById("source-input");
const weightsInput = document.getElementById("weights-input");
const confInput = document.getElementById("conf-input");

const startBtn = document.getElementById("start-btn");
const stopBtn = document.getElementById("stop-btn");
const connectBtn = document.getElementById("connect-btn");
const disconnectBtn = document.getElementById("disconnect-btn");
const bitrateEl = document.getElementById("bitrate");

const pipeRunning = document.getElementById("pipe-running");
const pipeUptime = document.getElementById("pipe-uptime");
const pipePid = document.getElementById("pipe-pid");
const pipeArgs = document.getElementById("pipe-args");

const debugLog = document.getElementById("debug-log");
const debugToggle = document.getElementById("debug-toggle");

const state = { viewer: null };

const params = new URLSearchParams(window.location.search);
roomInput.value = getParam("room", "cam-1");
sourceInput.value = getParam("source", "0");
weightsInput.value = getParam("weights", "yolo11n.pt");
confInput.value = getParam("conf", "0.25");

function log(...args) {
  const line = `[viewer] ${args.join(" ")}`;
  console.log(line);
  if (debugLog) {
    debugLog.textContent += `${line}\n`;
    debugLog.scrollTop = debugLog.scrollHeight;
  }
}

async function refreshStatus() {
  try {
    const status = await getStatus();
    pipeRunning.textContent = `running: ${status.running}`;
    pipeUptime.textContent = `uptime: ${prettySeconds(status.uptime_sec)}`;
    pipePid.textContent = `pid: ${status.pid ?? "—"}`;
    pipeArgs.textContent = status.args ? JSON.stringify(status.args, null, 2) : "—";
    stopBtn.disabled = !status.running;
  } catch (err) {
    pipeRunning.textContent = "running: —";
    pipeUptime.textContent = "uptime: —";
    pipePid.textContent = "pid: —";
    pipeArgs.textContent = "—";
    stopBtn.disabled = true;
    console.warn("status error", err);
  }
}

async function handleStart() {
  startBtn.disabled = true;
  try {
    const payload = {
      source: sourceInput.value.trim() || "0",
      yolo_weights: weightsInput.value.trim() || "yolo11n.pt",
      conf: parseFloat(confInput.value || "0.25"),
    };
    await startDetection(payload);
    toast("Pipeline start requested");
  } catch (err) {
    toast(`Failed to start: ${err.message}`, "error");
  } finally {
    startBtn.disabled = false;
    refreshStatus();
  }
}

async function handleStop() {
  stopBtn.disabled = true;
  try {
    await stopDetection();
    toast("Pipeline stop requested");
  } catch (err) {
    toast(`Failed to stop: ${err.message}`, "error");
  } finally {
    refreshStatus();
  }
}

function setConnectionButtons(connected) {
  connectBtn.disabled = connected;
  disconnectBtn.disabled = !connected;
}

function disconnectStream() {
  if (state.viewer) {
    state.viewer.disconnect();
    state.viewer = null;
  }
  if (videoEl) {
    videoEl.srcObject = null;
  }
  bitrateEl.textContent = "Bitrate: —";
  updateBadge("conn-state", "PC: —");
  updateBadge("ice-state", "ICE: —");
  setConnectionButtons(false);
  setStatusPill("Disconnected", false);
}

function connectStream() {
  if (state.viewer) return;
  const room = roomInput.value.trim() || "cam-1";
  setStatusPill("Connecting…", false);
  debugLog.textContent = "";
  setConnectionButtons(true);

  state.viewer = connectViewer({
    room,
    token: readSecretFromQuery(),
    onTrack: (stream) => {
      videoEl.srcObject = stream;
      const playPromise = videoEl.play();
      if (playPromise?.catch) playPromise.catch(() => {});
      setStatusPill("Live", true);
    },
    onState: (pcState) => {
      updateBadge("conn-state", `PC: ${pcState}`);
      if (pcState === "connected") {
        setStatusPill("Live", true);
      } else if (pcState === "failed" || pcState === "disconnected") {
        setStatusPill("Disconnected", false);
      }
    },
    onIceState: (iceState) => updateBadge("ice-state", `ICE: ${iceState}`),
    onBitrate: (kbps) => {
      bitrateEl.textContent = `Bitrate: ${kbps.toFixed(1)} kbps`;
    },
    onLog: (...args) => log(...args),
  });
}

function wireEvents() {
  startBtn.addEventListener("click", handleStart);
  stopBtn.addEventListener("click", handleStop);
  connectBtn.addEventListener("click", connectStream);
  disconnectBtn.addEventListener("click", () => {
    disconnectStream();
  });
  debugToggle?.addEventListener("click", (event) => {
    event.preventDefault();
    const hidden = debugLog.style.display === "none";
    debugLog.style.display = hidden ? "block" : "none";
    debugToggle.textContent = hidden ? "Hide debug log" : "Show debug log";
  });
}

function init() {
  wireEvents();
  refreshStatus();
  setInterval(refreshStatus, 3000);

  if (getBoolParam("autostart")) {
    handleStart();
  }
  if (getBoolParam("autoconnect")) {
    setTimeout(connectStream, 500);
  }
}

window.addEventListener("beforeunload", () => {
  disconnectStream();
});

setStatusPill("Disconnected", false);
init();
