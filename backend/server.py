# server.py — Multi-camera WebRTC sender with live YOLO overlays
import asyncio
import json
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, Literal

import cv2
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from fractions import Fraction
from aiortc import RTCPeerConnection, RTCSessionDescription, MediaStreamTrack
from aiortc.contrib.media import MediaRelay
from av import VideoFrame

# ---------- paths / constants ----------
BASE_DIR = Path(__file__).resolve().parent

# ---------- YOLO ----------
try:
    from ultralytics import YOLO
except Exception as e:
    YOLO = None
    print("[WARN] ultralytics not available; stream will be raw video only.", e)

# ===== settings =====
WEBRTC_SHARED_SECRET = os.getenv("WEBRTC_SHARED_SECRET", "CHANGE_ME_SHARED_SECRET")
DEFAULT_SOURCE = int(os.getenv("VIDEO_SOURCE", "0"))
IMG_SIZE = int(os.getenv("IMG_SIZE", "640"))
FPS = int(os.getenv("FPS", "30"))

DEFAULT_WEIGHTS = os.getenv(
    "YOLO_WEIGHTS",
    str((BASE_DIR / "yolo11n.pt").resolve())
)
DEFAULT_CONF = float(os.getenv("YOLO_CONF", "0.25"))
ALERTS_JSONL_PATH = os.getenv(
    "ALERTS_JSONL",
    str((BASE_DIR / "alerts.jsonl").resolve())
)
MAX_ALERTS_RETURNED = int(os.getenv("MAX_ALERTS_RETURNED", "250"))
YOLO_DEVICE = os.getenv("YOLO_DEVICE", None)

# Danger label config
DANGER_CONFIG = {
    "HIGH": {"knife", "gun", "pistol", "rifle", "revolver", "firearm"},
    "MEDIUM": {"scissors"},
}
COLORS = {"LOW": (60, 180, 75), "MEDIUM": (0, 215, 255), "HIGH": (0, 0, 255)}

# Camera IDs
CameraId = Literal["cam1", "cam2", "cam3", "cam4"]
VALID_CAMERA_IDS = {"cam1", "cam2", "cam3", "cam4"}

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
        overlay = frame.copy()
        overlay[:] = color
        cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)
        h, _ = frame.shape[:2]
        cv2.putText(frame, text, (30, int(0.12*h)),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.5, (255,255,255), 4, cv2.LINE_AA)
    except Exception:
        pass
    return frame

# ===== app =====
app = FastAPI(title="SurveiLens API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
relay = MediaRelay()

# ---------- Per-camera state ----------
class CameraState(BaseModel):
    running: bool = False
    started_at: Optional[float] = None
    source: Optional[str] = None
    yolo_weights: str = DEFAULT_WEIGHTS
    conf: float = DEFAULT_CONF

# Multi-camera state management
camera_states: Dict[str, CameraState] = {
    "cam1": CameraState(),
    "cam2": CameraState(),
    "cam3": CameraState(),
    "cam4": CameraState(),
}

# Per-camera captures and locks
caps: Dict[str, cv2.VideoCapture] = {}
cap_locks: Dict[str, asyncio.Lock] = {
    "cam1": asyncio.Lock(),
    "cam2": asyncio.Lock(),
    "cam3": asyncio.Lock(),
    "cam4": asyncio.Lock(),
}

# Per-camera YOLO models (lazy loaded)
yolo_models: Dict[str, any] = {}

def _get_yolo_model(weights: str):
    """Get or load a YOLO model for given weights."""
    if YOLO is None:
        return None
    if weights not in yolo_models:
        print(f"[INFO] Loading YOLO weights: {weights}")
        model = YOLO(weights)
        if YOLO_DEVICE:
            try:
                model.to(YOLO_DEVICE)
            except Exception as e:
                print(f"[WARN] Could not move model to {YOLO_DEVICE}: {e}")
        yolo_models[weights] = model
    return yolo_models[weights]

# ---------- helpers ----------
def _camera_status_payload(camera_id: str) -> dict:
    """Get status for a single camera."""
    state = camera_states.get(camera_id)
    if not state:
        return {"error": f"Invalid camera_id: {camera_id}"}
    
    uptime = None
    if state.running and state.started_at:
        uptime = max(0.0, time.time() - state.started_at)
    
    return {
        "camera_id": camera_id,
        "running": state.running,
        "uptime_sec": uptime,
        "source": state.source,
        "conf": state.conf,
        "yolo_weights": state.yolo_weights,
    }

def _status_payload() -> dict:
    """Get overall status with all cameras."""
    # Check if any camera is running
    any_running = any(s.running for s in camera_states.values())
    
    # Find earliest start time among running cameras
    earliest_start = None
    for s in camera_states.values():
        if s.running and s.started_at:
            if earliest_start is None or s.started_at < earliest_start:
                earliest_start = s.started_at
    
    uptime = None
    if any_running and earliest_start:
        uptime = max(0.0, time.time() - earliest_start)
    
    # Per-camera status
    cameras_status = {}
    for cam_id in VALID_CAMERA_IDS:
        cameras_status[cam_id] = _camera_status_payload(cam_id)
    
    return {
        "running": any_running,
        "uptime_sec": uptime,
        "pid": os.getpid(),
        "cameras": cameras_status,
        # Legacy fields for backward compatibility
        "args": {
            "VIDEO_SOURCE": camera_states["cam1"].source or DEFAULT_SOURCE,
            "IMG_SIZE": IMG_SIZE,
            "FPS": FPS,
            "YOLO_WEIGHTS": camera_states["cam1"].yolo_weights,
            "YOLO_CONF": camera_states["cam1"].conf,
        },
    }

def _read_alerts_from_file(limit: int = MAX_ALERTS_RETURNED, camera_id: Optional[str] = None):
    """Read alerts from JSONL file, optionally filtered by camera_id."""
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
                    alert = json.loads(line)
                    # Filter by camera_id if specified
                    if camera_id and alert.get("camera_id") != camera_id:
                        continue
                    rows.append(alert)
                except Exception:
                    continue
    except Exception as e:
        print(f"[WARN] Failed to read alerts JSONL: {e}")
        return []
    if limit and limit > 0:
        rows = rows[-limit:]
    return list(reversed(rows))

def _write_alert(alert_data: dict):
    """Append an alert to the JSONL file."""
    try:
        with open(ALERTS_JSONL_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(alert_data, ensure_ascii=False) + "\n")
    except Exception as e:
        print(f"[WARN] Failed to write alert: {e}")

def _start_capture(camera_id: str, source, weights: str, conf: float):
    """Start capture for a specific camera."""
    global caps, camera_states
    
    if camera_id not in VALID_CAMERA_IDS:
        raise ValueError(f"Invalid camera_id: {camera_id}")
    
    state = camera_states[camera_id]
    if state.running:
        return  # Already running
    
    # Parse source
    try:
        src = int(source) if isinstance(source, str) and source.isdigit() else source
    except Exception:
        src = source
    
    cap = cv2.VideoCapture(src)
    if not cap.isOpened():
        raise RuntimeError(f"Unable to open video source: {source}")
    
    try:
        cap.set(cv2.CAP_PROP_FPS, FPS)
    except Exception:
        pass
    
    caps[camera_id] = cap
    state.running = True
    state.started_at = time.time()
    state.source = str(source)
    state.yolo_weights = weights
    state.conf = conf
    
    # Pre-load the YOLO model
    _get_yolo_model(weights)
    
    print(f"[INFO] Started camera {camera_id}: source={source}, weights={weights}, conf={conf}")

def _stop_capture(camera_id: Optional[str] = None):
    """Stop capture for a specific camera or all cameras."""
    global caps, camera_states
    
    if camera_id:
        # Stop specific camera
        if camera_id in caps:
            try:
                caps[camera_id].release()
            except Exception:
                pass
            del caps[camera_id]
        if camera_id in camera_states:
            camera_states[camera_id].running = False
            camera_states[camera_id].started_at = None
        print(f"[INFO] Stopped camera {camera_id}")
    else:
        # Stop all cameras
        for cam_id in list(caps.keys()):
            try:
                caps[cam_id].release()
            except Exception:
                pass
        caps.clear()
        for state in camera_states.values():
            state.running = False
            state.started_at = None
        print("[INFO] Stopped all cameras")

# ---------- request bodies ----------
class StartBody(BaseModel):
    camera_id: Optional[str] = "cam1"
    source: Optional[str | int] = None
    yolo_weights: Optional[str] = None
    conf: Optional[float] = None

class StopBody(BaseModel):
    camera_id: Optional[str] = None  # None = stop all

# ---------- WebRTC video track ----------
class CameraVideoTrack(MediaStreamTrack):
    """Video track for a specific camera."""
    kind = "video"
    
    def __init__(self, camera_id: str):
        super().__init__()
        self.camera_id = camera_id
        self._ts = 0
        self._time_base = Fraction(1, FPS)
        self._last_alert_time = 0
        self._alert_cooldown = 5.0  # seconds between alerts

    async def recv(self):
        await asyncio.sleep(1 / FPS)
        
        state = camera_states.get(self.camera_id)
        cap = caps.get(self.camera_id)
        lock = cap_locks.get(self.camera_id)
        
        if not lock:
            lock = asyncio.Lock()
            cap_locks[self.camera_id] = lock
        
        async with lock:
            if not state or not state.running or cap is None:
                h, w = 480, 640
                img = np.zeros((h, w, 3), dtype=np.uint8)
                # Add "No Signal" text
                cv2.putText(img, f"Camera {self.camera_id}: No Signal", (50, 240),
                           cv2.FONT_HERSHEY_SIMPLEX, 1, (100, 100, 100), 2, cv2.LINE_AA)
            else:
                ok, img = cap.read()
                if not ok or img is None:
                    h, w = 480, 640
                    img = np.zeros((h, w, 3), dtype=np.uint8)
                    cv2.putText(img, f"Camera {self.camera_id}: Read Error", (50, 240),
                               cv2.FONT_HERSHEY_SIMPLEX, 1, (100, 100, 100), 2, cv2.LINE_AA)

        # ----- YOLO inference & drawing -----
        hazards = []
        detected_labels = []
        
        if state and state.running:
            yolo = _get_yolo_model(state.yolo_weights)
            if yolo is not None:
                try:
                    res = yolo.predict(img, imgsz=IMG_SIZE, conf=state.conf, verbose=False)[0]
                    names = res.names if hasattr(res, "names") else {}
                    if res.boxes is not None and len(res.boxes) > 0:
                        for box in res.boxes:
                            cls_id = int(box.cls.item())
                            label = names.get(cls_id, str(cls_id)) if isinstance(names, dict) else str(cls_id)
                            conf_val = float(box.conf.item()) if box.conf is not None else 0.0
                            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                            level = danger_level_for_label(label)
                            hazards.append(level)
                            detected_labels.append(label)
                            color = COLORS[level]
                            cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)
                            caption = f"{label} {conf_val:.2f} [{level}]"
                            cv2.putText(img, caption, (x1, max(0, y1 - 8)),
                                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2, cv2.LINE_AA)
                except Exception as e:
                    cv2.putText(img, f"YOLO error: {type(e).__name__}",
                                (10, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,0,255), 2, cv2.LINE_AA)

        frame_level = highest_danger_level(hazards)
        
        # Generate alert for HIGH danger
        if frame_level == "HIGH":
            img = overlay_safe(img, "DANGEROUS OBJECT DETECTED", color=COLORS["HIGH"], alpha=0.35)
            
            # Write alert with cooldown
            current_time = time.time()
            if current_time - self._last_alert_time > self._alert_cooldown:
                self._last_alert_time = current_time
                alert = {
                    "type": "high_danger_alert",
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                    "camera_id": self.camera_id,
                    "labels": list(set(detected_labels)),
                    "danger_level": frame_level,
                    "severity": "high",
                }
                _write_alert(alert)
        elif frame_level == "MEDIUM":
            # Write medium alerts less frequently
            current_time = time.time()
            if current_time - self._last_alert_time > self._alert_cooldown * 2:
                self._last_alert_time = current_time
                alert = {
                    "type": "medium_danger_alert",
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                    "camera_id": self.camera_id,
                    "labels": list(set(detected_labels)),
                    "danger_level": frame_level,
                    "severity": "medium",
                }
                _write_alert(alert)

        # Add camera ID overlay
        cv2.putText(img, f"[{self.camera_id}]", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2, cv2.LINE_AA)

        # Convert to AV frame with timestamps
        frame = VideoFrame.from_ndarray(img, format="bgr24")
        frame.pts = self._ts
        frame.time_base = self._time_base
        self._ts += 1
        return frame

# Room -> { "pc": RTCPeerConnection, "track": CameraVideoTrack }
rooms: Dict[str, dict] = {}

async def create_or_get_publisher(room: str, camera_id: str):
    """Create or get a publisher for a specific camera."""
    room_key = f"{room}:{camera_id}"
    
    if room_key in rooms and rooms[room_key].get("pc"):
        return rooms[room_key]["pc"]

    pc = RTCPeerConnection()
    track = CameraVideoTrack(camera_id)
    pc.addTrack(track)

    rooms[room_key] = {"pc": pc, "track": track}

    @pc.on("connectionstatechange")
    async def _on_state():
        if pc.connectionState in ("failed", "closed", "disconnected"):
            try:
                await pc.close()
            except Exception:
                pass
            rooms.pop(room_key, None)

    return pc

# ---------- REST controls ----------
@app.post("/pipeline/start")
@app.post("/start")
def api_start(body: StartBody | None = None):
    """Start detection for a camera."""
    camera_id = (body.camera_id if body and body.camera_id else "cam1")
    
    if camera_id not in VALID_CAMERA_IDS:
        return JSONResponse(
            {"error": f"Invalid camera_id: {camera_id}. Valid: {list(VALID_CAMERA_IDS)}"},
            status_code=400
        )
    
    source = body.source if body and body.source is not None else DEFAULT_SOURCE
    weights = body.yolo_weights if body and body.yolo_weights else DEFAULT_WEIGHTS
    conf = body.conf if body and body.conf is not None else DEFAULT_CONF
    
    try:
        _start_capture(camera_id, source, weights, conf)
        return _status_payload()
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/pipeline/stop")
@app.post("/stop")
def api_stop(body: StopBody | None = None):
    """Stop detection for a camera or all cameras."""
    camera_id = body.camera_id if body else None
    
    if camera_id and camera_id not in VALID_CAMERA_IDS:
        return JSONResponse(
            {"error": f"Invalid camera_id: {camera_id}. Valid: {list(VALID_CAMERA_IDS)}"},
            status_code=400
        )
    
    _stop_capture(camera_id)
    
    # Close WebRTC connections for stopped cameras
    rooms_to_close = []
    for room_key in list(rooms.keys()):
        if camera_id is None or room_key.endswith(f":{camera_id}"):
            rooms_to_close.append(room_key)
    
    for room_key in rooms_to_close:
        pc = rooms[room_key].get("pc")
        if pc:
            try:
                asyncio.create_task(pc.close())
            except Exception:
                pass
        rooms.pop(room_key, None)
    
    return _status_payload()

@app.get("/pipeline/status")
@app.get("/status")
def api_status():
    """Get status of all cameras."""
    return _status_payload()

@app.get("/camera/{camera_id}/status")
def api_camera_status(camera_id: str):
    """Get status of a specific camera."""
    if camera_id not in VALID_CAMERA_IDS:
        return JSONResponse(
            {"error": f"Invalid camera_id: {camera_id}. Valid: {list(VALID_CAMERA_IDS)}"},
            status_code=400
        )
    return _camera_status_payload(camera_id)

@app.get("/alerts")
def api_alerts(limit: int = MAX_ALERTS_RETURNED, camera_id: Optional[str] = None):
    """Get alerts, optionally filtered by camera_id."""
    data = _read_alerts_from_file(limit, camera_id)
    return JSONResponse(data, headers={"Cache-Control": "no-store"})

@app.get("/alerts.jsonl")
def api_alerts_file(limit: int = MAX_ALERTS_RETURNED, camera_id: Optional[str] = None):
    """Get alerts as JSONL."""
    data = _read_alerts_from_file(limit, camera_id)
    body = "\n".join(json.dumps(item, ensure_ascii=False) for item in data)
    return PlainTextResponse(body, headers={"Cache-Control": "no-store"})

@app.delete("/alerts")
def api_clear_alerts():
    """Clear all alerts."""
    try:
        if os.path.exists(ALERTS_JSONL_PATH):
            os.remove(ALERTS_JSONL_PATH)
        return {"status": "cleared"}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

# ---------- Health check ----------
@app.get("/health")
def api_health():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "cameras_active": sum(1 for s in camera_states.values() if s.running),
    }

# ---------- WebSocket signaling ----------
@app.websocket("/ws")
async def ws_signaling(ws: WebSocket):
    await ws.accept()
    try:
        reg = await ws.receive_text()
        msg = json.loads(reg)
        
        if msg.get("type") != "register" or msg.get("role") != "viewer":
            await ws.close()
            return
        
        if msg.get("token") != WEBRTC_SHARED_SECRET:
            await ws.close()
            return
        
        room = (msg.get("room") or "default").strip()
        camera_id = (msg.get("camera_id") or "cam1").strip()
        
        if camera_id not in VALID_CAMERA_IDS:
            camera_id = "cam1"
        
        pc = await create_or_get_publisher(room, camera_id)
        offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await _await_ice_complete(pc)
        
        await ws.send_json({
            "type": "offer",
            "room": room,
            "camera_id": camera_id,
            "sdp": pc.localDescription.sdp
        })

        while True:
            data = await ws.receive_text()
            m = json.loads(data)
            if m.get("room") != room:
                continue
            if m.get("type") == "answer":
                answer = RTCSessionDescription(sdp=m["sdp"], type="answer")
                await pc.setRemoteDescription(answer)
                
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WS] Error: {e}")
    finally:
        try:
            await ws.close()
        except Exception:
            pass

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

# ---------- Serve static frontend (optional) ----------
# Uncomment to serve built frontend from FastAPI
# frontend_path = BASE_DIR.parent / "frontend" / "dist"
# if frontend_path.exists():
#     app.mount("/", StaticFiles(directory=str(frontend_path), html=True), name="frontend")
