import os, json, time, uuid, redis, hashlib
from flask import Flask, request, jsonify, Response, abort
from flask_cors import CORS
from .config import Config
from .auth0_jwt import requires_auth
from .snowflake_io import insert_observation, recent_alerts, get_alert, insert_action, insert_audit
from .tasks import classify_observation
from .storage import presign_clip
from .policy import get_policy, set_policy
from .elevenlabs_io import generate_voice_brief
from .solana_io import write_receipt_memo

app = Flask(__name__)
app.config["SECRET_KEY"] = Config.FLASK_SECRET
CORS(app)

def _site_id_from_token():
    payload = getattr(request, "jwt_payload", {})
    return payload.get("site_id", os.getenv("SITE_ID","site-01"))

@app.route("/observe", methods=["POST"])
@requires_auth(required_scopes=["ingest:observe"], m2m=True)
def observe():
    body = request.get_json(force=True)
    insert_observation(body)
    context = {"recent_obs": [], "site_stats":{"false_positive_24h":0.0,"peak_hour":"18-19"}, "recent_weapon_conf": body.get("video_facts",{}).get("recent_weapon_conf", [])}
    classify_observation.delay(body, context)
    return jsonify({"queued": True, "alert_id": str(uuid.uuid4())})

@app.route("/feed")
@requires_auth(roles=["dispatcher","detective","manager","admin"])
def feed():
    site_id = request.args.get("site_id", _site_id_from_token())
    level = request.args.get("level")
    return jsonify(recent_alerts(site_id, level))

@app.route("/alerts/<alert_id>")
@requires_auth(roles=["dispatcher","detective","manager","admin"])
def alert(alert_id):
    data = get_alert(alert_id)
    if not data: abort(404)
    obs = data["observation"] or {}
    clip_url = presign_clip(obs.get("clip_key","clips/demo.mp4"))
    return jsonify({"alert": data["inference"], "transcript": obs, "clip_url": clip_url})

@app.route("/events")
def events():
    site_id = request.args.get("site_id", os.getenv("SITE_ID","site-01"))
    r = redis.from_url(Config.REDIS_URL); p = r.pubsub(); p.subscribe(f"events:{site_id}")
    def gen():
        yield "event: ping\n"
        yield "data: {}\n\n"
        for msg in p.listen():
            if msg["type"] != "message": continue
            yield f"data: {msg['data'].decode('utf-8')}\n\n"
    headers = {"Content-Type":"text/event-stream","Cache-Control":"no-cache","Connection":"keep-alive"}
    return Response(gen(), headers=headers)

@app.route("/admin/policy", methods=["GET","POST"])
@requires_auth(roles=["admin"])
def policy_api():
    if request.method == "GET": return jsonify(get_policy())
    p = request.get_json(force=True); return jsonify(set_policy(p))

def _mfa_required_check(): return True

@app.route("/actions/approve", methods=["POST"])
@requires_auth(roles=["dispatcher","manager","admin"])
def approve_action():
    if not _mfa_required_check(): abort(403, "MFA required")
    body = request.get_json(force=True); alert_id = body["alert_id"]; actor = request.jwt_payload.get("sub","user")
    act = {"action_id": str(uuid.uuid4()), "alert_id": alert_id, "site_id": _site_id_from_token(),
           "camera_id": body.get("camera_id",""), "action_type":"approve", "actor_user": actor, "notes": body.get("notes","")}
    insert_action(act)
    alert_bundle = get_alert(alert_id) or {}
    bundle_bytes = json.dumps({"transcript": (alert_bundle.get("observation") or {}), "inference": (alert_bundle.get("inference") or {}), "action": act, "ts": time.time()}, default=str).encode("utf-8")
    hash_hex = hashlib.sha256(bundle_bytes).hexdigest()
    txid = write_receipt_memo(hash_hex)
    insert_audit({"audit_id": str(uuid.uuid4()), "alert_id": alert_id, "site_id": _site_id_from_token(), "hash_fingerprint": hash_hex, "solana_tx_id": txid})
    brief_key = generate_voice_brief(f"Alert {alert_id} approved by {actor}", f"briefs/{_site_id_from_token()}/{alert_id}")
    return jsonify({"ok": True, "solana_tx_id": txid, "brief_key": brief_key})

@app.route("/actions/dismiss", methods=["POST"])
@requires_auth(roles=["dispatcher","detective","manager","admin"])
def dismiss_action():
    body = request.get_json(force=True)
    act = {"action_id": str(uuid.uuid4()), "alert_id": body["alert_id"], "site_id": _site_id_from_token(),
           "camera_id": body.get("camera_id",""), "action_type":"dismiss", "actor_user": request.jwt_payload.get("sub","user"), "notes": body.get("notes","")}
    insert_action(act); return jsonify({"ok": True})

@app.route("/actions/snooze", methods=["POST"])
@requires_auth(roles=["dispatcher","detective","manager","admin"])
def snooze_action():
    body = request.get_json(force=True)
    act = {"action_id": str(uuid.uuid4()), "alert_id": body["alert_id"], "site_id": _site_id_from_token(),
           "camera_id": body.get("camera_id",""), "action_type":"snooze", "actor_user": request.jwt_payload.get("sub","user"), "notes": body.get("notes","")}
    insert_action(act); return jsonify({"ok": True})

@app.route("/health")
def health(): return jsonify({"ok": True, "time": time.time()})
