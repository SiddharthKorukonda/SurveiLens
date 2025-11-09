import random, requests
from .config import Config

def classify(transcript: dict, context: dict):
    if Config.DEMO_MODE or not Config.NEURALSEEK_URL:
        vf = transcript.get("video_facts", {}); af = transcript.get("audio_facts", {})
        weapon = float(vf.get("weapon_like_conf", 0.0)); aggr = float(vf.get("aggression_conf", 0.0)); shout = float(af.get("shouting_conf", 0.0))
        score = max(weapon, aggr*0.8 + shout*0.2)
        if score > 0.85 and ((weapon>0.6)+(aggr>0.6)+(shout>0.6) >= 2): level = "HIGH"
        elif score > 0.6: level = "MED"
        elif score > 0.35: level = "LOW"
        else: level = "NONE"
        return {"danger_level": level, "danger_score": round(score,2), "confidence": round(0.6 + 0.4*random.random(),2), "reason": "demo heuristic", "policy": {"requires_mfa": level=="HIGH", "cooldown_applied": False}}
    headers = {"Authorization": f"Bearer {Config.NEURALSEEK_KEY}"}
    body = {"transcript": transcript, "context": context, "model": Config.GEMINI_MODEL, "task": "classify_danger"}
    r = requests.post(Config.NEURALSEEK_URL, json=body, headers=headers, timeout=15)
    r.raise_for_status()
    return r.json()
