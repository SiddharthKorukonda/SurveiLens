# danger_yolo_live.py  (YOLO + ElevenLabs STT via REST, 10s chunks → JSONL)
# [resilient, selectable alarm backend + BLARING siren/file options, macOS-safe playback]
# [+ NeuralSeek Governor/Interpreter pipeline with direct endpoint support]

import argparse
import threading
import time
import json
import os
from datetime import datetime
from io import BytesIO
import wave
import traceback
import platform
import subprocess
import tempfile
from collections import deque

# --- optional .env autoload ---
try:
    from dotenv import load_dotenv, find_dotenv
    load_dotenv(find_dotenv())
except Exception:
    pass

import numpy as np
import cv2
from ultralytics import YOLO

import sounddevice as sd
import simpleaudio as sa
import requests

# -------------------------
# Configuration
# -------------------------
DANGER_CONFIG = {
    "HIGH": {"knife", "gun", "pistol", "rifle", "revolver", "firearm"},
    "MEDIUM": {"scissors"},
}
COLORS = {
    "LOW": (60, 180, 75),      # BGR
    "MEDIUM": (0, 215, 255),
    "HIGH": (0, 0, 255),
}
ALARM_FREQ_HZ = 1000
ALARM_DUR_SEC = 0.35
ALARM_COOLDOWN_SEC = 1.5

# Default to our BLARING siren; on macOS we'll route it via afplay to avoid PortAudio clashes.
DEFAULT_ALARM_BACKEND = "blaring"

# -------------------------
# Utils
# -------------------------
def canonical_label(name: str) -> str:
    return name.strip().lower()

def danger_level_for_label(name: str) -> str:
    n = canonical_label(name)
    if n in DANGER_CONFIG["HIGH"]:
        return "HIGH"
    if n in DANGER_CONFIG["MEDIUM"]:
        return "MEDIUM"
    return "LOW"

def highest_danger_level(levels):
    if "HIGH" in levels: return "HIGH"
    if "MEDIUM" in levels: return "MEDIUM"
    return "LOW"

def overlay_safe(frame, text, color=(0,0,255), alpha=0.35):
    """Translucent overlay; fallback to banner if blending fails."""
    try:
        if frame.dtype != np.uint8:
            frame = np.clip(frame, 0, 255).astype(np.uint8)
        overlay = frame.copy(); overlay[:] = color
        cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)
        h, _ = frame.shape[:2]
        cv2.putText(frame, text, (30, int(0.12*h)),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.5, (255,255,255), 4, cv2.LINE_AA)
        return frame
    except Exception as e:
        try:
            h, w = frame.shape[:2]
            thick = max(10, min(h, w)//50)
            cv2.rectangle(frame, (0,0), (w-1,h-1), color, thickness=thick)
            cv2.rectangle(frame, (0,0), (w, int(0.18*h)), color, thickness=-1)
            cv2.putText(frame, text, (30, int(0.12*h)),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.5, (255,255,255), 4, cv2.LINE_AA)
        except Exception as e2:
            print(f"[WARN] Overlay fallback failed: {e2}")
        return frame

# ---------- Alarm synthesis helpers ----------
def _tone_simpleaudio(freq=ALARM_FREQ_HZ, duration=ALARM_DUR_SEC, fs=44100, volume=1.0):
    t = np.linspace(0, duration, int(fs*duration), False)
    tone = np.sin(2*np.pi*freq*t)
    audio = (tone * (32767 * max(0.0, min(1.0, volume)))).astype(np.int16)
    sa.play_buffer(audio, 1, 2, fs)

def _siren_wave_int16(duration=2.5, f_low=600, f_high=1600, cycles=3, fs=44100, volume=1.0):
    """Return sine-chirp siren as int16 mono array (no playback)."""
    segs = []
    total_segments = cycles * 2
    seg_dur = max(0.1, duration / max(1, total_segments))
    for _ in range(cycles):
        t = np.linspace(0, seg_dur, int(fs*seg_dur), False)
        f = np.linspace(f_low, f_high, t.size)
        wave_up = np.sin(2*np.pi * np.cumsum(f)/fs)
        segs.append(wave_up)
        t = np.linspace(0, seg_dur, int(fs*seg_dur), False)
        f = np.linspace(f_high, f_low, t.size)
        wave_dn = np.sin(2*np.pi * np.cumsum(f)/fs)
        segs.append(wave_dn)
    y = np.concatenate(segs)
    fade = int(0.02*fs)
    y[:fade] *= np.linspace(0,1,fade)
    y[-fade:] *= np.linspace(1,0,fade)
    return (y * (32767 * max(0.0, min(1.0, volume)))).astype(np.int16)

def _blaring_wave_int16(duration=4.0, f_low=550, f_high=2000, cycles=4,
                        tremolo_hz=12.0, fs=44100, volume=1.0):
    """Return aggressive square-wave siren as int16 mono array (no playback)."""
    segs = []
    total_segments = cycles * 2
    seg_dur = max(0.15, duration / max(1, total_segments))

    def chirp_square(f_start, f_end, seg_len):
        t = np.linspace(0, seg_len, int(fs*seg_len), False)
        f = np.linspace(f_start, f_end, t.size)
        phase = 2*np.pi * np.cumsum(f)/fs
        s = np.sign(np.sin(phase))
        phase2 = 2*np.pi * np.cumsum(f*1.06)/fs  # detune
        s2 = np.sign(np.sin(phase2))
        delay = int(0.0015 * fs)
        if delay < s2.size:
            s2 = np.concatenate([np.zeros(delay), s2[:-delay]])
        return 0.7*s + 0.6*s2

    for _ in range(cycles):
        segs.append(chirp_square(f_low,  f_high, seg_dur))
        segs.append(chirp_square(f_high, f_low,  seg_dur))

    y = np.concatenate(segs)
    n = y.size
    t = np.arange(n)/fs
    trem = 0.65 + 0.45*np.sin(2*np.pi*tremolo_hz*t)
    y *= trem

    peak = np.max(np.abs(y)) + 1e-9
    y = y / peak
    fade = int(0.02*fs)
    y[:fade] *= np.linspace(0,1,fade)
    y[-fade:] *= np.linspace(1,0,fade)
    return (y * (32767 * max(0.0, min(1.0, volume)))).astype(np.int16)

def pcm16_to_wav_bytes(mono_int16: np.ndarray, samplerate: int) -> bytes:
    buf = BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(samplerate)
        wf.writeframes(mono_int16.tobytes())
    return buf.getvalue()

def _afplay_wav_bytes(wav_bytes: bytes, estimated_duration: float):
    """Play WAV bytes via macOS afplay in a separate process; cleanup temp file."""
    try:
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        tmp.write(wav_bytes)
        tmp.flush()
        tmp.close()
        subprocess.Popen(["afplay", tmp.name])
        # Cleanup file later
        def _cleanup(path, delay):
            time.sleep(delay)
            try: os.unlink(path)
            except Exception: pass
        threading.Thread(target=_cleanup, args=(tmp.name, max(1.0, estimated_duration + 1.0)), daemon=True).start()
    except Exception as e:
        print(f"[WARN] afplay failed: {e}")

# Global to prevent overlapping alarm synthesis/play (optional extra guard)
_ALARM_BUSY = threading.Event()

def play_alarm(backend="blaring", sound_file=None, duration=4.0, volume=1.0):
    """
    backends:
      - 'blaring'  → aggressive siren. On macOS: play via afplay (no PortAudio). Else: simpleaudio.
      - 'siren'    → smooth siren (afplay on macOS, else simpleaudio).
      - 'beep'     → single tone (simpleaudio).
      - 'afplay'   → macOS system player (built-in or file).
      - 'file'     → play provided sound_file.
      - 'simpleaudio' → alias for 'beep'.
    """
    if _ALARM_BUSY.is_set():
        return
    _ALARM_BUSY.set()
    try:
        duration = float(duration)
        volume = float(volume)

        is_mac = (platform.system() == "Darwin")
        if backend == "blaring":
            if is_mac:
                # synth → afplay (separate process; avoids PortAudio crash with sounddevice)
                y = _blaring_wave_int16(duration=duration, volume=volume)
                wav_bytes = pcm16_to_wav_bytes(y, 44100)
                _afplay_wav_bytes(wav_bytes, duration)
            else:
                # non-mac fallback
                y = _blaring_wave_int16(duration=duration, volume=volume)
                sa.play_buffer(y, 1, 2, 44100)
        elif backend == "siren":
            if is_mac:
                y = _siren_wave_int16(duration=max(2.0, duration), volume=volume)
                _afplay_wav_bytes(pcm16_to_wav_bytes(y, 44100), max(2.0, duration))
            else:
                y = _siren_wave_int16(duration=max(2.0, duration), volume=volume)
                sa.play_buffer(y, 1, 2, 44100)
        elif backend in ("beep", "simpleaudio"):
            _tone_simpleaudio(duration=max(0.3, duration), volume=volume)
        elif backend == "afplay":
            path = sound_file or "/System/Library/Sounds/Sosumi.aiff"
            subprocess.Popen(["afplay", path])
        elif backend == "file":
            if not sound_file:
                print("[WARN] 'file' backend requires --alarm-sound-file path")
            else:
                if is_mac:
                    subprocess.Popen(["afplay", sound_file])
                else:
                    try:
                        subprocess.Popen([sound_file])
                    except Exception as e:
                        print(f"[WARN] Could not launch file '{sound_file}': {e}")
        else:
            # default fallback
            if is_mac:
                y = _blaring_wave_int16(duration=duration, volume=volume)
                _afplay_wav_bytes(pcm16_to_wav_bytes(y, 44100), duration)
            else:
                y = _blaring_wave_int16(duration=duration, volume=volume)
                sa.play_buffer(y, 1, 2, 44100)
    except Exception as e:
        print(f"[WARN] Alarm playback failed ({backend}): {e}")
    finally:
        # release after approx duration to prevent overlaps
        def _release_after(d):
            time.sleep(max(0.5, d))
            _ALARM_BUSY.clear()
        threading.Thread(target=_release_after, args=(duration,), daemon=True).start()

# -------------------------
# NeuralSeek client + helpers
# -------------------------
class NeuralSeekClient:
    """
    New format (preferred):
      - Use NEURALSEEK_BASE_URL + NEURALSEEK_INSTANCE + NEURALSEEK_API_KEY
      - Auth header: apiKey
      - Endpoint: POST {base_url}/v1/{instance}/agents/{agent}:invoke

    Legacy (still supported, deprecated):
      - NEURALSEEK_ENDPOINT + NEURALSEEK_API_KEY (Authorization: Bearer)
      - Single endpoint handles agent name in payload (we still support for compatibility).
    """
    def __init__(
        self,
        endpoint: str | None = None,          # legacy optional
        base_url: str | None = None,
        instance: str | None = None,
        api_key: str | None = None,
        auth_mode: str = "apikey",            # 'apikey' (new) or 'bearer' (legacy)
        timeout: float = 8.0,
    ):
        # Legacy endpoint (env or arg)
        self.legacy_endpoint = (endpoint or os.getenv("NEURALSEEK_ENDPOINT") or "").strip()
        self._warned_legacy = False

        # New-style config
        self.base_url = (base_url or os.getenv("NEURALSEEK_BASE_URL") or "https://api.neuralseek.com").rstrip("/")
        self.instance = (instance or os.getenv("NEURALSEEK_INSTANCE") or "").strip()
        self.api_key = (api_key or os.getenv("NEURALSEEK_API_KEY") or "").strip()
        self.auth_mode = (auth_mode or os.getenv("NEURALSEEK_AUTH_MODE") or "apikey").lower()
        self.timeout = float(timeout)

        # Enabled if (new) base+instance+key OR (legacy) endpoint+key
        self.enabled = bool((self.instance and self.api_key) or (self.legacy_endpoint and self.api_key))

    def _url(self, agent: str) -> str:
        if self.legacy_endpoint:
            if not self._warned_legacy:
                print("[WARN] NEURALSEEK_ENDPOINT is deprecated; migrate to NEURALSEEK_BASE_URL + NEURALSEEK_INSTANCE.")
                self._warned_legacy = True
            return self.legacy_endpoint
        agent = (agent or "").strip()
        return f"{self.base_url}/v1/{self.instance}/agents/{agent}:invoke"

    def _headers(self) -> dict:
        if self.auth_mode == "apikey" and not self.legacy_endpoint:
            return {"Content-Type": "application/json", "apiKey": self.api_key}
        # default to bearer
        return {"Content-Type": "application/json", "Authorization": f"Bearer {self.api_key}"}

    def call_agent(self, agent: str, vars_dict: dict | None = None, input_text: str | None = None) -> dict:
        if not self.enabled:
            raise RuntimeError("NeuralSeek is not configured (missing endpoint/instance or api key).")

        if self.legacy_endpoint:
            # Legacy: agent included in payload
            payload = {"agent": agent}
            if vars_dict is not None: payload["vars"] = vars_dict
            if input_text: payload["input"] = input_text
        else:
            # New: agent in URL, payload only vars/input
            payload = {}
            if vars_dict is not None: payload["vars"] = vars_dict
            if input_text: payload["input"] = input_text

        resp = requests.post(self._url(agent), headers=self._headers(), json=payload, timeout=self.timeout)
        resp.raise_for_status()
        try:
            return resp.json()
        except Exception:
            return {"raw": resp.text}

def _contains_html(s: str | None) -> bool:
    if not s: return False
    s = s.lstrip().lower()
    return s.startswith("<!doctype html") or s.startswith("<html")

# High-level run function (your requested shape)
def run_neuralseek_governor(ns: NeuralSeekClient | None, event_payload: dict, policy: dict,
                            incident_agent: str, governor_agent: str) -> dict:
    """
    Call NeuralSeek agents if configured; otherwise fallback to a simple rule.
    We first call the Incident_Summarizer agent, then pass its summary into the Governor agent.
    Returns a compact dict with escalation_level, summary, action, confidence, policy,
    plus raw NeuralSeek responses.
    """
    vars_payload = {
        "people_count": event_payload.get("people_count"),
        "weapons_detected": event_payload.get("weapons_detected") or [],
        "actions_detected": event_payload.get("actions_detected") or [],
        "danger_score": float(event_payload.get("danger_score") or 0.0),
        "danger_level": event_payload.get("danger_level"),
        "transcript": event_payload.get("transcript") or "",
        "snapshots_b64": event_payload.get("snapshots_b64") or [],
    }

    summarizer_raw = None
    governor_raw = None

    if ns and ns.enabled:
        try:
            summarizer_raw = ns.call_agent(agent=incident_agent, vars_dict=vars_payload)
        except Exception as e:
            print("NeuralSeek Incident_Summarizer call failed, continuing with fallback.", str(e))

        # Try to extract a human-readable summary
        summary_text = None
        try:
            if isinstance(summarizer_raw, dict):
                # common shapes: {"summary": "..."} or {"neuralseek": {"summary": "..."}}
                summary_text = summarizer_raw.get("summary") \
                    or (summarizer_raw.get("neuralseek") or {}).get("summary") \
                    or summarizer_raw.get("output")
        except Exception:
            pass
        if not summary_text:
            summary_text = "Possible risk detected based on recent frames and transcript."

        # detect accidental HTML (Auth0 etc.)
        try:
            raw_blob = (summarizer_raw.get("raw") if isinstance(summarizer_raw, dict) else None) or ""
            if _contains_html(raw_blob):
                print("[WARN] Incident_Summarizer returned HTML (likely SSO/login). Provide raw text/frames or public URLs.")
        except Exception:
            pass

        try:
            governor_vars = dict(vars_payload)
            governor_vars["summary"] = summary_text
            governor_vars["policy"] = policy
            governor_raw = ns.call_agent(agent=governor_agent, vars_dict=governor_vars)

            ns_body = None
            if isinstance(governor_raw, dict):
                ns_body = governor_raw.get("neuralseek") or governor_raw
            level = (ns_body or {}).get("escalation_level") or (ns_body or {}).get("level")
            action = (ns_body or {}).get("action")
            confidence = (ns_body or {}).get("confidence")

            if level and action and (confidence is not None):
                return {
                    "escalation_level": level,
                    "summary": summary_text,
                    "action": action,
                    "confidence": float(confidence),
                    "policy": policy,
                    "summarizer_raw": summarizer_raw,
                    "governor_raw": governor_raw,
                }

            # HTML guard for governor
            try:
                graw = (governor_raw.get("raw") if isinstance(governor_raw, dict) else None) or ""
                if _contains_html(graw):
                    print("[WARN] Governor returned HTML (likely SSO/login).")
            except Exception:
                pass

        except Exception as e:
            print("NeuralSeek Governor_AI call failed, falling back to rules.", str(e))

    # Fallback heuristic
    score = float(event_payload.get("danger_score") or 0.0)
    has_weapon = bool(event_payload.get("weapons_detected"))
    level = "high" if (score >= policy["high_threshold"] or has_weapon) else \
            "medium" if (score >= policy["med_threshold"]) else "low"

    return {
        "escalation_level": level,
        "summary": "Possible risk detected based on recent frames and transcript.",
        "action": "If high, notify operator immediately; otherwise log and continue monitoring.",
        "confidence": round(min(0.99, max(0.5, score)), 2),
        "policy": policy,
        "summarizer_raw": summarizer_raw,
        "governor_raw": governor_raw,
    }

# -------------------------
# Rolling transcript buffer (thread-safe)
# -------------------------
class TranscriptBuffer:
    def __init__(self, max_seconds: int = 180):
        self.max_seconds = max_seconds
        self.buf = deque()  # each item: (start_ts, end_ts, text)
        self.lock = threading.Lock()

    def add(self, start_ts: float, end_ts: float, text: str):
        with self.lock:
            self.buf.append((start_ts, end_ts, text))
            cutoff = end_ts - self.max_seconds
            while self.buf and self.buf[0][1] < cutoff:
                self.buf.popleft()

    def recent_text(self, seconds: int = 30) -> str:
        now = time.time()
        since = now - seconds
        chunks = []
        with self.lock:
            for (s, e, t) in reversed(self.buf):
                if e < since: break
                if t: chunks.append(t)
        return " ".join(reversed(chunks)).strip()

# -------------------------
# ElevenLabs REST helper
# -------------------------
def run_stt_bytes(
    audio_wav_bytes: bytes,
    api_key: str,
    stt_url: str = "https://api.elevenlabs.io/v1/speech-to-text",
    model_id: str = "scribe_v1",
    language_code: str = "eng",
    diarize: bool = False,
    tag_audio_events: bool = False,
    timestamps_granularity: str = "word",
    timeout_sec: int = 60,
) -> dict:
    headers = {"xi-api-key": api_key}
    files = {"file": ("audio.wav", audio_wav_bytes, "audio/wav")}
    data = {
        "model_id": model_id,
        "language_code": language_code,
        "diarize": str(diarize).lower(),
        "tag_audio_events": str(tag_audio_events).lower(),
        "timestamps_granularity": timestamps_granularity,
    }
    resp = requests.post(stt_url, headers=headers, files=files, data=data, timeout=timeout_sec)
    resp.raise_for_status()
    return resp.json()

# -------------------------
# Audio → ElevenLabs STT (10s JSON)
# -------------------------
class ElevenLabsChunkTranscriber(threading.Thread):
    def __init__(
        self,
        jsonl_path="audio_segments.jsonl",
        chunk_sec=10,
        samplerate=16000,
        device=None,
        api_key: str | None = None,
        stt_url: str = "https://api.elevenlabs.io/v1/speech-to-text",
        model_id: str = "scribe_v1",
        language_code: str = "eng",
        diarize: bool = False,
        tag_audio_events: bool = False,
        timestamps_granularity: str = "word",
        collector: TranscriptBuffer | None = None,
    ):
        super().__init__(daemon=True)
        self.jsonl_path = jsonl_path
        self.chunk_sec = chunk_sec
        self.samplerate = samplerate
        self.device = device

        self.api_key = api_key or os.getenv("ELEVENLABS_API_KEY")
        if not self.api_key:
            raise RuntimeError("Missing ElevenLabs key. Set ELEVENLABS_API_KEY or pass --elevenlabs-api-key.")

        self.stt_url = stt_url or os.getenv("ELEVENLABS_STT_URL", "https://api.elevenlabs.io/v1/speech-to-text")
        self.model_id = model_id
        self.language_code = language_code
        self.diarize = diarize
        self.tag_audio_events = tag_audio_events
        self.timestamps_granularity = timestamps_granularity

        self.collector = collector
        self._stop = threading.Event()

    def stop(self): self._stop.set()

    def run(self):
        while not self._stop.is_set():
            start_ts = time.time()
            # robust audio capture
            try:
                rec = sd.rec(
                    int(self.chunk_sec * self.samplerate),
                    samplerate=self.samplerate, channels=1, dtype="int16",
                    blocking=True, device=self.device
                )
            except Exception as e:
                end_ts = time.time()
                payload = {
                    "type": "audio_segment",
                    "timestamp_start": datetime.utcfromtimestamp(start_ts).isoformat() + "Z",
                    "timestamp_end": datetime.utcfromtimestamp(end_ts).isoformat() + "Z",
                    "duration_sec": round(end_ts - start_ts, 3),
                    "error": f"AudioCaptureError: {e}",
                }
                _safe_append_jsonl(self.jsonl_path, payload)
                continue

            end_ts = time.time()
            wav_bytes = _numpy_pcm16_to_wav_bytes(rec.reshape(-1), self.samplerate)

            try:
                stt = run_stt_bytes(
                    audio_wav_bytes=wav_bytes,
                    api_key=self.api_key,
                    stt_url=self.stt_url,
                    model_id=self.model_id,
                    language_code=self.language_code,
                    diarize=self.diarize,
                    tag_audio_events=self.tag_audio_events,
                    timestamps_granularity=self.timestamps_granularity,
                )
                transcript_text = stt.get("text", "")
                payload = {
                    "type": "audio_segment",
                    "timestamp_start": datetime.utcfromtimestamp(start_ts).isoformat() + "Z",
                    "timestamp_end": datetime.utcfromtimestamp(end_ts).isoformat() + "Z",
                    "duration_sec": round(end_ts - start_ts, 3),
                    "transcript": transcript_text,
                }
                if "words" in stt:
                    payload["words"] = stt["words"]
                if self.collector and transcript_text:
                    self.collector.add(start_ts, end_ts, transcript_text)
            except Exception as e:
                payload = {
                    "type": "audio_segment",
                    "timestamp_start": datetime.utcfromtimestamp(start_ts).isoformat() + "Z",
                    "timestamp_end": datetime.utcfromtimestamp(end_ts).isoformat() + "Z",
                    "duration_sec": round(end_ts - start_ts, 3),
                    "error": f"STTError: {type(e).__name__}: {e}",
                }

            _safe_append_jsonl(self.jsonl_path, payload)

# helper to avoid reusing BytesIO function name
def _numpy_pcm16_to_wav_bytes(mono_int16: np.ndarray, samplerate: int) -> bytes:
    buf = BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(samplerate)
        wf.writeframes(mono_int16.tobytes())
    return buf.getvalue()

def _safe_append_jsonl(path: str, obj: dict):
    try:
        with open(path, "a", encoding="utf-8") as f:
            f.write(json.dumps(obj, ensure_ascii=False) + "\n")
        print(f"[JSONL] {obj}")
    except Exception as e:
        print(f"[WARN] Failed to write JSONL '{path}': {e}")

# -------------------------
# YOLO Live App
# -------------------------
class DangerYOLOApp:
    def __init__(self, model_path="yolo11n.pt", source=0, imgsz=640, conf_thres=0.25, device=None,
                 write_alerts_jsonl="alerts.jsonl", alarm_enabled=True, overlay_enabled=True,
                 alarm_backend=DEFAULT_ALARM_BACKEND, alarm_sound_file=None,
                 alarm_duration=4.0, alarm_volume=1.0,
                 # NeuralSeek
                 ns_client: NeuralSeekClient | None = None,
                 ns_incident_agent: str | None = None,
                 ns_governor_agent: str | None = None,
                 ns_gov_blocking: bool = False,
                 ns_gov_timeout: float = 1.0,
                 ns_med_threshold: float = 0.4,
                 ns_high_threshold: float = 0.7,
                 transcript_buffer: TranscriptBuffer | None = None,
                 debug=False):
        self.model = YOLO(model_path)
        self.source = source
        self.imgsz = imgsz
        self.conf = conf_thres
        self.device = device
        self.last_alarm = 0.0
        self.write_alerts_jsonl = write_alerts_jsonl
        self.alarm_enabled = alarm_enabled
        self.overlay_enabled = overlay_enabled
        self.alarm_backend = alarm_backend
        self.alarm_sound_file = alarm_sound_file
        self.alarm_duration = alarm_duration
        self.alarm_volume = alarm_volume

        # NeuralSeek
        self.ns = ns_client
        self.ns_incident_agent = ns_incident_agent
        self.ns_governor_agent = ns_governor_agent
        self.ns_gov_blocking = ns_gov_blocking
        self.ns_gov_timeout = ns_gov_timeout
        self.ns_policy = {
            "med_threshold": float(ns_med_threshold),
            "high_threshold": float(ns_high_threshold),
        }
        self.transcript_buffer = transcript_buffer

        self.debug = debug
        _ = self.model.to(device) if device else None

    def log_alert(self, labels, frame_time, extra: dict | None = None):
        payload = {
            "type": "high_danger_alert",
            "timestamp": datetime.utcfromtimestamp(frame_time).isoformat() + "Z",
            "labels": sorted({canonical_label(l) for l in labels}),
        }
        if extra:
            payload.update(extra)
        _safe_append_jsonl(self.write_alerts_jsonl, payload)

    # ---- NeuralSeek gating helpers ----
    def _ns_decide(self, detections: list[dict], frame_level: str, transcript: str) -> dict:
        # Build event_payload similar to your example
        people_count = sum(1 for d in detections if canonical_label(d["label"]) == "person")
        weapons_detected = [d["label"] for d in detections if d.get("level") == "HIGH"]
        danger_score = 0.0
        try:
            # max confidence among high level as danger score proxy
            danger_score = max([float(d["conf"]) for d in detections if d.get("level") == "HIGH"] or [0.0])
        except Exception:
            pass

        payload = {
            "people_count": people_count,
            "weapons_detected": sorted(set(weapons_detected)),
            "actions_detected": [],
            "danger_score": danger_score,
            "danger_level": frame_level.lower(),
            "transcript": transcript or "",
            "snapshots_b64": [],
        }
        try:
            return run_neuralseek_governor(
                self.ns,
                payload,
                self.ns_policy,
                incident_agent=self.ns_incident_agent or "Incident_Summarizer",
                governor_agent=self.ns_governor_agent or "Governor",
            )
        except Exception as e:
            if self.debug:
                traceback.print_exc()
            # fallback
            return {
                "escalation_level": frame_level.lower(),
                "summary": "Governor error; fallback.",
                "action": "alarm" if frame_level == "HIGH" else "log",
                "confidence": danger_score,
                "policy": self.ns_policy,
                "summarizer_raw": None,
                "governor_raw": None,
                "error": str(e),
            }

    @staticmethod
    def _ns_allows_alarm(ns_result: dict) -> bool:
        # Heuristic mapping if agent doesn't give a strict boolean
        action = (ns_result.get("action") or "").lower()
        level = (ns_result.get("escalation_level") or "").lower()
        if action in {"suppress", "ignore", "hold", "wait"}:
            return False
        if action in {"alarm", "notify", "escalate"}:
            return True
        # otherwise base it on level
        return level in {"high", "critical"}  # conservative

    def run(self):
        cap = cv2.VideoCapture(self.source)
        if not cap.isOpened():
            raise RuntimeError(f"Unable to open video source: {self.source}")

        fps_t0 = time.time()
        fps_count = 0
        fps_val = 0.0
        print("Press 'q' to quit.")

        while True:
            try:
                ok, frame = cap.read()
                if not ok:
                    print("[WARN] Capture read failed, attempting reopen...")
                    cap.release()
                    time.sleep(0.2)
                    cap = cv2.VideoCapture(self.source)
                    continue

                t_frame = time.time()

                results = self.model(frame, imgsz=self.imgsz, verbose=False, conf=self.conf)
                res = results[0]
                names = res.names if hasattr(res, "names") else self.model.names

                hazards = []
                draw_items = []
                detections = []
                if res.boxes is not None and len(res.boxes) > 0:
                    for box in res.boxes:
                        cls_id = int(box.cls.item())
                        label = names.get(cls_id, str(cls_id)) if isinstance(names, dict) else str(cls_id)
                        conf = float(box.conf.item()) if box.conf is not None else 0.0
                        x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                        level = danger_level_for_label(label)
                        hazards.append(level)
                        draw_items.append(((x1, y1, x2, y2), label, conf, level))
                        detections.append({
                            "label": label,
                            "conf": round(conf, 3),
                            "bbox_xyxy": [x1, y1, x2, y2],
                            "level": level,
                        })

                frame_level = highest_danger_level(hazards)

                # Draw boxes
                for (x1, y1, x2, y2), label, conf, level in draw_items:
                    color = COLORS[level]
                    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                    caption = f"{label} {conf:.2f} [{level}]"
                    cv2.putText(frame, caption, (x1, max(0, y1 - 8)),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2, cv2.LINE_AA)

                # HIGH-danger branch
                if frame_level == "HIGH":
                    try:
                        transcript_text = self.transcript_buffer.recent_text(30) if self.transcript_buffer else ""

                        ns_result = None
                        allow_alarm = True
                        gov_note = {}

                        if self.ns and self.ns.enabled:
                            if self.ns_gov_blocking:
                                # Temporarily tighten timeout for gating
                                old_timeout = self.ns.timeout
                                self.ns.timeout = float(self.ns_gov_timeout)
                                ns_result = self._ns_decide(detections, frame_level, transcript_text)
                                self.ns.timeout = old_timeout
                                allow_alarm = self._ns_allows_alarm(ns_result)
                                gov_note = {"neuralseek": ns_result, "governed": "blocking"}
                            else:
                                # Async: fire decision in background, but do not block alarm
                                def _bg():
                                    res_bg = self._ns_decide(detections, frame_level, transcript_text)
                                    try:
                                        self.log_alert(
                                            [d["label"] for d in detections if d.get("level") == "HIGH"],
                                            time.time(),
                                            {"neuralseek_async": res_bg, "governed": "async"}
                                        )
                                    except Exception:
                                        pass
                                threading.Thread(target=_bg, daemon=True).start()
                                allow_alarm = True
                                gov_note = {"governed": "async"}

                        if self.overlay_enabled:
                            text = "DANGEROUS OBJECT DETECTED" + ("" if allow_alarm else " (SUPPRESSED)")
                            frame = overlay_safe(frame, text, color=COLORS["HIGH"], alpha=0.35)

                        # Cooldown (can be extended via NS by adding suppress_seconds in future)
                        effective_cooldown = max(ALARM_COOLDOWN_SEC, self.alarm_duration * 0.9)
                        should_fire = allow_alarm and ((time.time() - self.last_alarm) > effective_cooldown)
                        if should_fire:
                            self.last_alarm = time.time()
                            high_labels = [lbl for (_, lbl, _, lvl) in draw_items if lvl == "HIGH"]
                            try:
                                self.log_alert(high_labels, t_frame, gov_note if gov_note else None)
                            except Exception as e:
                                print(f"[WARN] Failed to write alert JSON: {e}")

                            if self.alarm_enabled and allow_alarm:
                                threading.Thread(
                                    target=play_alarm,
                                    args=(self.alarm_backend, self.alarm_sound_file, self.alarm_duration, self.alarm_volume),
                                    daemon=True
                                ).start()

                    except Exception as e:
                        print(f"[WARN] High-danger handling crashed this frame: {e}")
                        if self.debug:
                            traceback.print_exc()

                # FPS meter
                fps_count += 1
                if (time.time() - fps_t0) >= 1.0:
                    fps_val = fps_count / (time.time() - fps_t0)
                    fps_count = 0
                    fps_t0 = time.time()

                # HUD
                h, _ = frame.shape[:2]
                status = f"FPS: {fps_val:.1f} | Danger: {frame_level}"
                cv2.putText(frame, status, (12, h - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255,255,255), 2, cv2.LINE_AA)

                # Show
                try:
                    cv2.imshow("Danger Detector (YOLO + ElevenLabs REST STT)", frame)
                    if (cv2.waitKey(1) & 0xFF) == ord('q'):
                        break
                except Exception as e:
                    print(f"[WARN] imshow/waitKey failed: {e}")
                    if self.debug:
                        traceback.print_exc()

            except Exception as loop_e:
                print(f"[WARN] Uncaught error in frame loop: {loop_e}")
                if self.debug:
                    traceback.print_exc()
                continue

        cap.release()
        try:
            cv2.destroyAllWindows()
        except Exception as e:
            print(f"[WARN] destroyAllWindows failed: {e}")

# -------------------------
# Main
# -------------------------
def main():
    parser = argparse.ArgumentParser(description="YOLO live danger detector + 10s audio STT (ElevenLabs REST) → JSON")
    parser.add_argument("--yolo-weights", default="yolo11n.pt", help="YOLO weights (e.g., yolo11n.pt / yolov8n.pt / custom.pt)")
    parser.add_argument("--source", default=0, help="Video source (int index, path, or URL)")
    parser.add_argument("--imgsz", type=int, default=640, help="Inference size")
    parser.add_argument("--conf", type=float, default=0.25, help="Confidence threshold")
    parser.add_argument("--device", default=None, help="cuda, cpu, mps, or index")

    # ElevenLabs REST STT options
    parser.add_argument("--elevenlabs-api-key", default=None, help="API key (or set ELEVENLABS_API_KEY)")
    parser.add_argument("--stt-url", default=os.getenv("ELEVENLABS_STT_URL", "https://api.elevenlabs.io/v1/speech-to-text"), help="STT REST endpoint")
    parser.add_argument("--stt-model", default="scribe_v1", help="Model id")
    parser.add_argument("--language-code", default="eng", help="ISO 639 code (use 'none' to let server auto-detect)")
    parser.add_argument("--diarize", action="store_true", help="Enable speaker diarization")
    parser.add_argument("--tag-audio-events", action="store_true", help="Tag audio events (laughter, etc.)")
    parser.add_argument("--timestamps-granularity", default="word", help="word|sentence|none")

    # Audio capture
    parser.add_argument("--audio-json", default="audio_segments.jsonl", help="Output JSONL for 10s transcripts")
    parser.add_argument("--audio-chunk-sec", type=int, default=10, help="Seconds per audio chunk")
    parser.add_argument("--audio-samplerate", type=int, default=16000, help="Sample rate (try 44100 if needed)")
    parser.add_argument("--audio-device", default=None, help="sounddevice input device id/name (optional)")

    parser.add_argument("--alerts-json", default="alerts.jsonl", help="Output JSONL for HIGH danger alerts")

    # Alarm / isolation / debug
    parser.add_argument("--no-alarm", action="store_true", help="Disable alarm sound on HIGH danger")
    parser.add_argument("--no-overlay", action="store_true", help="Disable red overlay on HIGH danger")
    parser.add_argument("--alarm-backend",
                        choices=["blaring", "siren", "beep", "afplay", "file", "simpleaudio"],
                        default=DEFAULT_ALARM_BACKEND,
                        help="Alarm playback backend/style")
    parser.add_argument("--alarm-sound-file", default=None,
                        help="Path to custom WAV/AIFF (for 'file' or 'afplay')")
    parser.add_argument("--alarm-duration", type=float, default=4.0,
                        help="Seconds the alarm plays (synthetic backends)")
    parser.add_argument("--alarm-volume", type=float, default=1.0,
                        help="0.0–1.0 volume (synthetic backends)")

    # NeuralSeek switches (new format preferred)
    parser.add_argument("--ns-enable", action="store_true",
                        help="Enable NeuralSeek integration")
    parser.add_argument("--ns-endpoint", default=os.getenv("NEURALSEEK_ENDPOINT", ""),
                        help="[DEPRECATED] Direct NeuralSeek endpoint (uses Authorization: Bearer)")
    parser.add_argument("--ns-base-url", default=os.getenv("NEURALSEEK_BASE_URL", "https://api.neuralseek.com"),
                        help="NeuralSeek base URL (preferred)")
    parser.add_argument("--ns-instance", default=os.getenv("NEURALSEEK_INSTANCE", ""),
                        help="NeuralSeek instance slug (preferred)")
    parser.add_argument("--ns-api-key", default=os.getenv("NEURALSEEK_API_KEY", ""),
                        help="NeuralSeek API key (Bearer token or apiKey)")
    parser.add_argument("--ns-auth-mode", choices=["bearer", "apikey"],
                        default=os.getenv("NEURALSEEK_AUTH_MODE", "apikey"),
                        help="Auth header style; 'apikey' for base/instance (preferred), 'bearer' for legacy endpoint")
    parser.add_argument("--ns-incident-agent", default=os.getenv("NEURALSEEK_INCIDENT_AGENT", "Incident_Summarizer"),
                        help="Incident summarizer agent name")
    parser.add_argument("--ns-governor-agent", default=os.getenv("NEURALSEEK_GOVERNOR_AGENT", "Governor"),
                        help="Governor agent name")
    parser.add_argument("--ns-gov-blocking", action="store_true",
                        help="If set, wait briefly for Governor decision to gate alarm")
    parser.add_argument("--ns-gov-timeout", type=float, default=1.0,
                        help="Seconds to wait for blocking Governor call")
    parser.add_argument("--ns-med-threshold", type=float, default=float(os.getenv("NS_MED_THRESHOLD", "0.4")),
                        help="Fallback medium threshold (0-1) when NS unavailable")
    parser.add_argument("--ns-high-threshold", type=float, default=float(os.getenv("NS_HIGH_THRESHOLD", "0.7")),
                        help="Fallback high threshold (0-1) when NS unavailable")

    parser.add_argument("--debug", action="store_true", help="Print full tracebacks on errors")

    args = parser.parse_args()

    # Rolling transcript buffer for agent context
    tbuf = TranscriptBuffer(max_seconds=180)

    transcriber = ElevenLabsChunkTranscriber(
        jsonl_path=args.audio_json,
        chunk_sec=args.audio_chunk_sec,
        samplerate=args.audio_samplerate,
        device=args.audio_device,
        api_key=args.elevenlabs_api_key,
        stt_url=args.stt_url,
        model_id=args.stt_model,
        language_code=None if str(args.language_code).lower() == "none" else args.language_code,
        diarize=args.diarize,
        tag_audio_events=args.tag_audio_events,
        timestamps_granularity=args.timestamps_granularity,
        collector=tbuf,
    )
    transcriber.start()

    ns_client = None
    if args.ns_enable:
        ns_client = NeuralSeekClient(
            endpoint=args.ns_endpoint or None,          # legacy tolerated
            base_url=args.ns_base_url or None,
            instance=args.ns_instance or None,
            api_key=args.ns_api_key or None,
            auth_mode=args.ns_auth_mode,
            timeout=max(0.5, min(10.0, args.ns_gov_timeout if args.ns_gov_blocking else 8.0)),
        )
        if not ns_client.enabled:
            print("[WARN] NeuralSeek not fully configured (need --ns-base-url + --ns-instance + --ns-api-key, or legacy ENDPOINT+key). NS features disabled.")
            ns_client = None

    app = DangerYOLOApp(
        model_path=args.yolo_weights,
        source=int(args.source) if str(args.source).isdigit() else args.source,
        imgsz=args.imgsz,
        conf_thres=args.conf,
        device=args.device,
        write_alerts_jsonl=args.alerts_json,
        alarm_enabled=not args.no_alarm,
        overlay_enabled=not args.no_overlay,
        alarm_backend=args.alarm_backend,
        alarm_sound_file=args.alarm_sound_file,
        alarm_duration=args.alarm_duration,
        alarm_volume=args.alarm_volume,
        ns_client=ns_client,
        ns_incident_agent=args.ns_incident_agent if ns_client else None,
        ns_governor_agent=args.ns_governor_agent if ns_client else None,
        ns_gov_blocking=args.ns_gov_blocking,
        ns_gov_timeout=args.ns_gov_timeout,
        ns_med_threshold=args.ns_med_threshold,
        ns_high_threshold=args.ns_high_threshold,
        transcript_buffer=tbuf,
        debug=args.debug,
    )
    try:
        app.run()
    finally:
        transcriber.stop()
        time.sleep(0.2)

if __name__ == "__main__":
    main()
