from dataclasses import dataclass
from typing import Dict, Any
from ..policy import get_policy

@dataclass
class MultiSignalResult:
    level: str
    reason: str

def apply_rules(transcript: Dict[str, Any], recent_weapon_conf):
    p = get_policy()
    vf = transcript.get("video_facts", {}); af = transcript.get("audio_facts", {})
    weapon = float(vf.get("weapon_like_conf", 0.0)); aggr = float(vf.get("aggression_conf", 0.0)); shout = float(af.get("shouting_conf", 0.0))
    frames = p.get("weapon_fast_rule_frames",5); need = p.get("weapon_fast_rule_min",3); conf_fast = p.get("weapon_conf_fast",0.90)
    if sum(1 for c in recent_weapon_conf[-frames:] if c >= conf_fast) >= need:
        return MultiSignalResult(level="HIGH", reason="fast-rule weapon high across recent frames")
    th = p.get("multi_signal_threshold",0.60)
    over = sum(1 for x in [weapon, aggr, shout] if x >= th)
    if over >= 2:
        return MultiSignalResult(level="HIGH", reason="multi-signal high")
    return MultiSignalResult(level="LLM", reason="route to NeuralSeek")
