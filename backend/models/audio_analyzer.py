import random
from typing import Dict, Any
def analyze_window_audio() -> Dict[str, Any]:
    shouting = max(0.0, min(1.0, random.gauss(0.25, 0.25)))
    glass = max(0.0, min(1.0, random.gauss(0.05, 0.05)))
    kwords = []
    if random.random() < 0.05:
        kwords = ["help"]; shouting = max(shouting, 0.8)
    return {"shouting_conf": round(shouting,2), "glass_break_conf": round(glass,2), "keywords": kwords}
