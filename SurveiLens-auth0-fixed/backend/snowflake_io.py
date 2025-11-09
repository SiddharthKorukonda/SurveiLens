import os, json, time
from typing import Optional, Dict, Any
from .config import Config

try:
    import snowflake.connector
except Exception:
    snowflake = None

_memory = {"observations": [], "inferences": [], "actions": [], "audit": []}

def _conn():
    if Config.DEMO_MODE or not Config.SNOW_ACCOUNT:
        return None
    return snowflake.connector.connect(
        account=Config.SNOW_ACCOUNT,
        user=Config.SNOW_USER,
        password=Config.SNOW_PASS,
        warehouse=Config.SNOW_WH,
        database=Config.SNOW_DB
    )

def insert_observation(obs: Dict[str, Any]):
    if Config.DEMO_MODE or not Config.SNOW_ACCOUNT:
        _memory["observations"].append(obs); return
    cn = _conn(); cs = cn.cursor()
    try:
        cs.execute("USE SCHEMA {}.{}".format(Config.SNOW_DB, Config.SNOW_SCHEMA))
        sql = ("INSERT INTO CORE.OBSERVATIONS(site_id,camera_id,window_start,window_end,transcript_json,clip_key) "
               "VALUES(%s,%s,%s,%s,%s,%s)")
        cs.execute(sql, (obs["site_id"], obs["camera_id"], obs["window_start"], obs["window_end"], json.dumps(obs), obs.get("clip_key")))
        cn.commit()
    finally:
        cs.close(); cn.close()

def insert_inference(inf: Dict[str, Any]):
    if Config.DEMO_MODE or not Config.SNOW_ACCOUNT:
        _memory["inferences"].append(inf); return
    cn = _conn(); cs = cn.cursor()
    try:
        cs.execute("USE SCHEMA {}.{}".format(Config.SNOW_DB, Config.SNOW_SCHEMA))
        sql = ("INSERT INTO CORE.INFERENCES(alert_id,site_id,camera_id,window_start,window_end,"
               "danger_level,danger_score,confidence,reason,policy) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)")
        cs.execute(sql, (inf["alert_id"], inf["site_id"], inf["camera_id"], inf["window_start"], inf["window_end"],
                         inf["danger_level"], inf["danger_score"], inf["confidence"], inf["reason"], json.dumps(inf.get("policy",{}))))
        cn.commit()
    finally:
        cs.close(); cn.close()

def insert_action(act: Dict[str, Any]):
    if Config.DEMO_MODE or not Config.SNOW_ACCOUNT:
        _memory["actions"].append(act); return
    cn = _conn(); cs = cn.cursor()
    try:
        cs.execute("USE SCHEMA {}.AUDIT".format(Config.SNOW_DB))
        sql = ("INSERT INTO AUDIT.ACTIONS(action_id,alert_id,site_id,camera_id,action_type,actor_user,notes) "
               "VALUES(%s,%s,%s,%s,%s,%s,%s)")
        cs.execute(sql, (act["action_id"], act["alert_id"], act["site_id"], act["camera_id"],
                         act["action_type"], act["actor_user"], act.get("notes","")))
        cn.commit()
    finally:
        cs.close(); cn.close()

def insert_audit(aud: Dict[str, Any]):
    if Config.DEMO_MODE or not Config.SNOW_ACCOUNT:
        _memory["audit"].append(aud); return
    cn = _conn(); cs = cn.cursor()
    try:
        cs.execute("USE SCHEMA {}.AUDIT".format(Config.SNOW_DB))
        sql = ("INSERT INTO AUDIT.AUDIT_LOG(audit_id,alert_id,site_id,hash_fingerprint,solana_tx_id) "
               "VALUES(%s,%s,%s,%s,%s)")
        cs.execute(sql, (aud["audit_id"], aud["alert_id"], aud["site_id"], aud["hash_fingerprint"], aud["solana_tx_id"]))
        cn.commit()
    finally:
        cs.close(); cn.close()

def recent_alerts(site_id: str, level: Optional[str]=None, limit: int=50):
    if Config.DEMO_MODE or not Config.SNOW_ACCOUNT:
        items = [x for x in _memory["inferences"] if x["site_id"] == site_id]
        if level:
            items = [x for x in items if x["danger_level"] == level]
        return sorted(items, key=lambda x: x.get("created_at",""), reverse=True)[:limit]
    cn = _conn(); cs = cn.cursor()
    try:
        cs.execute("USE SCHEMA {}.{}".format(Config.SNOW_DB, Config.SNOW_SCHEMA))
        if level:
            q = ("SELECT alert_id, site_id, camera_id, window_start, window_end, danger_level, danger_score, "
                 "confidence, reason, policy::string, created_at FROM CORE.INFERENCES WHERE site_id=%s AND danger_level=%s "
                 "ORDER BY created_at DESC LIMIT {}".format(limit))
            cs.execute(q, (site_id, level))
        else:
            q = ("SELECT alert_id, site_id, camera_id, window_start, window_end, danger_level, danger_score, "
                 "confidence, reason, policy::string, created_at FROM CORE.INFERENCES WHERE site_id=%s "
                 "ORDER BY created_at DESC LIMIT {}".format(limit))
            cs.execute(q, (site_id,))
        rows = cs.fetchall()
        out = []
        for r in rows:
            out.append({
                "alert_id": r[0], "site_id": r[1], "camera_id": r[2],
                "window_start": r[3].isoformat() if r[3] else None,
                "window_end": r[4].isoformat() if r[4] else None,
                "danger_level": r[5], "danger_score": r[6], "confidence": r[7],
                "reason": r[8], "policy": json.loads(r[9]) if r[9] else {},
                "created_at": r[10].isoformat() if r[10] else None
            })
        return out
    finally:
        cs.close(); cn.close()

def get_alert(alert_id: str):
    if Config.DEMO_MODE or not Config.SNOW_ACCOUNT:
        inf = next((x for x in _memory["inferences"] if x["alert_id"] == alert_id), None)
        if not inf: return None
        obs = next((x for x in _memory["observations"]
                    if x["site_id"]==inf["site_id"] and x["camera_id"]==inf["camera_id"]
                    and x["window_start"]==inf["window_start"] and x["window_end"]==inf["window_end"]), None)
        return {"inference": inf, "observation": obs}
    return None
