from pydantic import BaseModel
from typing import List, Dict, Any, Optional
class Tracklet(BaseModel):
    local_id: str
    bbox: List[int]
    features: Dict[str, Any]
    global_id: Optional[str] = None
class Transcript(BaseModel):
    site_id: str
    camera_id: str
    window_start: str
    window_end: str
    video_facts: Dict[str, Any]
    audio_facts: Dict[str, Any]
    tracklets: List[Tracklet] = []
    clip_key: str
