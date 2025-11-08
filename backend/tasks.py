import json, time, uuid, redis
from celery import Celery
from .config import Config
from .snowflake_io import insert_inference
from .neuralseek_client import classify
from .models.scoring import apply_rules

celery = Celery(__name__, broker=Config.REDIS_URL, backend=Config.REDIS_URL)

def _publish_event(site_id: str, event: dict):
    r = redis.from_url(Config.REDIS_URL)
    r.publish(f"events:{site_id}", json.dumps(event))

@celery.task
def classify_observation(transcript: dict, context: dict):
    recent_weapon_conf = context.get("recent_weapon_conf", [])
    rule = apply_rules(transcript, recent_weapon_conf)
    if rule.level == "LLM":
        result = classify(transcript, context)
        level = result.get("danger_level", "NONE")
        score = result.get("danger_score", 0.0)
        conf = result.get("confidence", 0.0)
        reason = result.get("reason", "llm")
        policy = result.get("policy", {})
    else:
        level = rule.level; score = 0.90; conf = 0.75; reason = rule.reason; policy = {"requires_mfa": level=="HIGH", "cooldown_applied": False}
    alert_id = str(uuid.uuid4())
    inf = {"alert_id": alert_id, "site_id": transcript["site_id"], "camera_id": transcript["camera_id"],
           "window_start": transcript["window_start"], "window_end": transcript["window_end"],
           "danger_level": level, "danger_score": score, "confidence": conf, "reason": reason, "policy": policy,
           "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    insert_inference(inf)
    _publish_event(transcript["site_id"], {"type":"alert.new","alert":inf})
    return {"queued": True, "alert_id": alert_id, "level": level}
