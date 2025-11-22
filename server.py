# server.py — WebRTC sender with live YOLO overlays
import asyncio
import json
import os
import time
from typing import Dict, Optional

import cv2
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi import Request
from pydantic import BaseModel

from fractions import Fraction
from aiortc import RTCPeerConnection, RTCSessionDescription, MediaStreamTrack
from aiortc.contrib.media import MediaRelay
from av import VideoFrame

# ---------- YOLO ----------
try:
    from ultralytics import YOLO
except Exception as e:
    YOLO = None
    print("[WARN] ultralytics not available; stream will be raw video only.", e)

# ===== settings =====
WEBRTC_SHARED_SECRET = os.getenv("WEBRTC_SHARED_SECRET", "CHANGE_ME_SHARED_SECRET")
DEFAULT_SOURCE = int(os.getenv("VIDEO_SOURCE", "0"))     # camera index or RTSP/URL
IMG_SIZE = int(os.getenv("IMG_SIZE", "640"))
FPS = int(os.getenv("FPS", "30"))
DEFAULT_WEIGHTS = os.getenv("YOLO_WEIGHTS", "yolo11n.pt")
DEFAULT_CONF = float(os.getenv("YOLO_CONF", "0.25"))
ALERTS_JSONL_PATH = os.getenv("ALERTS_JSONL", "alerts.jsonl")
MAX_ALERTS_RETURNED = int(os.getenv("MAX_ALERTS_RETURNED", "250"))
YOLO_DEVICE = os.getenv("YOLO_DEVICE", None)  # "cpu", "mps", "cuda", or index

# Danger label config
DANGER_CONFIG = {
    "HIGH": {"knife", "gun", "pistol", "rifle", "revolver", "firearm"},
    "MEDIUM": {"scissors"},
}
COLORS = {"LOW": (60, 180, 75), "MEDIUM": (0, 215, 255), "HIGH": (0, 0, 255)}

def canonical(s: str) -> str:
    return s.strip().lower()

def danger_level_for_label(name: str) -> str:
    n = canonical(name)
    if n in DANGER_CONFIG["HIGH"]:
        return "HIGH"
    if n in DANGER_CONFIG["MEDIUM"]:
        return "MEDIUM"
    return "LOW"

def highest_danger_level(levels) -> str:
    if "HIGH" in levels: return "HIGH"
    if "MEDIUM" in levels: return "MEDIUM"
    return "LOW"

def overlay_safe(frame, text, color=(0,0,255), alpha=0.35):
    try:
        if frame.dtype != np.uint8:
            frame = np.clip(frame, 0, 255).astype(np.uint8)
        overlay = frame.copy(); overlay[:] = color
        cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)
        h, _ = frame.shape[:2]
        cv2.putText(frame, text, (30, int(0.12*h)),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.5, (255,255,255), 4, cv2.LINE_AA)
    except Exception:
        pass
    return frame

# ===== app =====
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # lock down in prod
    allow_methods=["*"],
    allow_headers=["*"],
)
relay = MediaRelay()

class PipelineState(BaseModel):
    running: bool = False
    started_at: Optional[float] = None

state = PipelineState()

# Global capture / model
_cap = None
_cap_lock = asyncio.Lock()

_yolo = None
_yolo_conf = DEFAULT_CONF
_yolo_weights = DEFAULT_WEIGHTS
_source = DEFAULT_SOURCE

# ---------- helpers ----------
def _status_payload():
    uptime = None
    if state.running and state.started_at:
        uptime = max(0.0, time.time() - state.started_at)
    return {
        "running": state.running,
        "uptime_sec": uptime,
        "pid": os.getpid(),
        "args": {"VIDEO_SOURCE": _source, "IMG_SIZE": IMG_SIZE, "FPS": FPS,
                 "YOLO_WEIGHTS": _yolo_weights, "YOLO_CONF": _yolo_conf},
    }


def _read_alerts_from_file(limit: int = MAX_ALERTS_RETURNED):
    if not os.path.exists(ALERTS_JSONL_PATH):
        return []
    rows = []
    try:
        with open(ALERTS_JSONL_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    rows.append(json.loads(line))
                except Exception:
                    continue
    except Exception as e:
        print(f"[WARN] Failed to read alerts JSONL: {e}")
        return []
    if limit and limit > 0:
        rows = rows[-limit:]
    return list(reversed(rows))

def _load_model(weights: str):
    global _yolo
    if YOLO is None:
        print("[WARN] ultralytics not installed; skipping model load.")
        _yolo = None
        return
    if (_yolo is None) or (weights != _yolo_weights):
        print(f"[INFO] Loading YOLO weights: {weights}")
        _yolo = YOLO(weights)
        if YOLO_DEVICE:
            try:
                _yolo.to(YOLO_DEVICE)
            except Exception as e:
                print(f"[WARN] Could not move model to {YOLO_DEVICE}: {e}")

def _start_capture(source):
    global _cap, state, _source
    if state.running:
        return
    _source = source
    _cap = cv2.VideoCapture(source)
    if not _cap.isOpened():
        raise RuntimeError(f"Unable to open video source: {source}")
    try: _cap.set(cv2.CAP_PROP_FPS, FPS)
    except Exception: pass
    state.running = True
    state.started_at = time.time()

def _stop_capture():
    global _cap, state
    if _cap is not None:
        try: _cap.release()
        except: pass
        _cap = None
    state.running = False

# ---------- request bodies ----------
class StartBody(BaseModel):
    source: Optional[str | int] = None
    yolo_weights: Optional[str] = None
    conf: Optional[float] = None

# ---------- WebRTC video track ----------
class VideoTrack(MediaStreamTrack):
    kind = "video"
    def __init__(self):
        super().__init__()
        self._ts = 0
        self._time_base = Fraction(1, FPS)

    async def recv(self):
        await asyncio.sleep(1 / FPS)

        async with _cap_lock:
            if not state.running or _cap is None:
                h, w = 480, 640
                img = np.zeros((h, w, 3), dtype=np.uint8)
            else:
                ok, img = _cap.read()
                if not ok or img is None:
                    h, w = 480, 640
                    img = np.zeros((h, w, 3), dtype=np.uint8)

        # ----- YOLO inference & drawing -----
        hazards = []
        if _yolo is not None:
            try:
                # run fast inference (no verbose)
                res = _yolo.predict(img, imgsz=IMG_SIZE, conf=_yolo_conf, verbose=False)[0]
                names = res.names if hasattr(res, "names") else {}
                if res.boxes is not None and len(res.boxes) > 0:
                    for box in res.boxes:
                        cls_id = int(box.cls.item())
                        label = names.get(cls_id, str(cls_id)) if isinstance(names, dict) else str(cls_id)
                        conf = float(box.conf.item()) if box.conf is not None else 0.0
                        x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                        level = danger_level_for_label(label)
                        hazards.append(level)
                        color = COLORS[level]
                        cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)
                        caption = f"{label} {conf:.2f} [{level}]"
                        cv2.putText(img, caption, (x1, max(0, y1 - 8)),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2, cv2.LINE_AA)
            except Exception as e:
                # draw a tiny hint if inference failed (keeps stream alive)
                cv2.putText(img, f"YOLO error: {type(e).__name__}",
                            (10, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,0,255), 2, cv2.LINE_AA)

        frame_level = highest_danger_level(hazards)
        if frame_level == "HIGH":
            img = overlay_safe(img, "DANGEROUS OBJECT DETECTED", color=COLORS["HIGH"], alpha=0.35)

        # convert to AV frame with timestamps
        frame = VideoFrame.from_ndarray(img, format="bgr24")
        frame.pts = self._ts
        frame.time_base = self._time_base
        self._ts += 1
        return frame

# Room -> { "pc": RTCPeerConnection, "track": VideoTrack }
rooms: Dict[str, dict] = {}

async def create_or_get_publisher(room: str):
    if not state.running:
        _start_capture(_source)

    if room in rooms and rooms[room].get("pc"):
        return rooms[room]["pc"]

    pc = RTCPeerConnection()
    track = VideoTrack()
    pc.addTrack(track)

    rooms[room] = {"pc": pc, "track": track}

    @pc.on("connectionstatechange")
    async def _on_state():
        if pc.connectionState in ("failed", "closed", "disconnected"):
            try: await pc.close()
            except: pass
            rooms.pop(room, None)

    return pc

# ---------- REST controls ----------
@app.post("/pipeline/start")
def api_pipeline_start(body: StartBody | None = None):
    global _yolo_weights, _yolo_conf
    # parse settings
    src = body.source if body and (body.source is not None) else _source
    try:
        # allow "0" as string
        src = int(src) if isinstance(src, str) and src.isdigit() else src
    except Exception:
        pass

    if body and body.yolo_weights: _yolo_weights = body.yolo_weights
    if body and (body.conf is not None): _yolo_conf = float(body.conf)

    # (re)load model if available
    _load_model(_yolo_weights)
    _start_capture(src)
    return _status_payload()

@app.post("/pipeline/stop")
def api_pipeline_stop():
    _stop_capture()
    for r in list(rooms.keys()):
        pc = rooms[r]["pc"]
        try: asyncio.create_task(pc.close())
        except: pass
        rooms.pop(r, None)
    return _status_payload()

@app.get("/pipeline/status")
def api_pipeline_status():
    return _status_payload()


@app.get("/alerts")
def api_alerts(limit: int = MAX_ALERTS_RETURNED):
    data = _read_alerts_from_file(limit)
    return JSONResponse(data, headers={"Cache-Control": "no-store"})


@app.get("/alerts.jsonl")
def api_alerts_file(limit: int = MAX_ALERTS_RETURNED):
    data = _read_alerts_from_file(limit)
    body = "\n".join(json.dumps(item, ensure_ascii=False) for item in data)
    return PlainTextResponse(body, headers={"Cache-Control": "no-store"})

# Friendly aliases used by your page
@app.post("/start")
def api_start_alias(body: StartBody | None = None): return api_pipeline_start(body)
@app.post("/stop")
def api_stop_alias(): return api_pipeline_stop()
@app.get("/status")
def api_status_alias(): return api_pipeline_status()

# ---------- WebSocket signaling ----------
@app.websocket("/ws")
async def ws_signaling(ws: WebSocket):
    await ws.accept()
    try:
        reg = await ws.receive_text()
        msg = json.loads(reg)
        if msg.get("type") != "register" or msg.get("role") != "viewer":
            await ws.close(); return
        if msg.get("token") != WEBRTC_SHARED_SECRET:
            await ws.close(); return
        room = (msg.get("room") or "cam-1").strip()

        pc = await create_or_get_publisher(room)
        offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await _await_ice_complete(pc)
        await ws.send_json({"type": "offer", "room": room, "sdp": pc.localDescription.sdp})

        while True:
            data = await ws.receive_text()
            m = json.loads(data)
            if m.get("room") != room: continue
            if m.get("type") == "answer":
                answer = RTCSessionDescription(sdp=m["sdp"], type="answer")
                await pc.setRemoteDescription(answer)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        try: await ws.close()
        except: pass

async def _await_ice_complete(pc: RTCPeerConnection, timeout=3.0):
    done = asyncio.get_event_loop().create_future()
    @pc.on("icegatheringstatechange")
    def _on_igs():
        if pc.iceGatheringState == "complete" and not done.done():
            done.set_result(True)
    try:
        await asyncio.wait_for(done, timeout=timeout)
    except asyncio.TimeoutError:
        pass

# Serve static files - catch-all route (must be last)
@app.get("/{path:path}")
async def serve_static(request: Request, path: str):
    # API routes are handled above, so this only catches non-API paths
    import os
    # Remove leading slash and "public/" prefix if present
    path = path.lstrip("/")
    if path.startswith("public/"):
        path = path[7:]  # Remove "public/" prefix
    # If path is empty, serve index.html
    if not path:
        file_path = os.path.join("public", "index.html")
    else:
        file_path = os.path.join("public", path)
    # If file doesn't exist or is a directory, try index.html
    if not os.path.exists(file_path) or os.path.isdir(file_path):
        file_path = os.path.join("public", "index.html")
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return FileResponse(file_path)
    return FileResponse(os.path.join("public", "index.html"))
