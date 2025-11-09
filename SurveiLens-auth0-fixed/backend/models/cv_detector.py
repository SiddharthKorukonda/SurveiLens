import random
from typing import Dict, Any, List
class CVCadence:
    def __init__(self):
        self.weapon_conf_hist: List[float] = []
    def analyze_window(self) -> Dict[str, Any]:
        w = max(0.0, min(1.0, random.gauss(0.2, 0.15)))
        if random.random() < 0.1: w = max(w, random.uniform(0.6, 0.95))
        a = max(0.0, min(1.0, random.gauss(0.3, 0.2)))
        self.weapon_conf_hist.append(w); self.weapon_conf_hist[:] = self.weapon_conf_hist[-100:]
        return {"people": int(random.randint(0,5)), "weapon_like_conf": round(w,2), "aggression_conf": round(a,2), "objects":["bag","bottle"]}
