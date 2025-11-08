import json, os, threading
_lock = threading.Lock()
_policy_path = os.path.join(os.path.dirname(__file__), "policy_state.json")
_default = {"weapon_fast_rule_frames":5,"weapon_fast_rule_min":3,"weapon_conf_fast":0.90,"multi_signal_threshold":0.60,"cooldown_seconds":30}
def get_policy():
    with _lock:
        if not os.path.exists(_policy_path):
            with open(_policy_path,"w") as f: json.dump(_default,f)
        with open(_policy_path,"r") as f: return json.load(f)
def set_policy(newp):
    with _lock:
        p = get_policy(); p.update(newp or {})
        with open(_policy_path,"w") as f: json.dump(p,f)
        return p
