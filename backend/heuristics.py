from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, time as dtime
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np

# Classes we care about for behavioral heuristics
TRACKABLE_CLASSES = {"person", "car", "truck", "bus", "motorbike"}

# Default ROIs used when automatic detection fails
DEFAULT_ATM_ROI = (200, 100, 450, 400)
PARKING_ROI = (50, 200, 1200, 700)

BANK_OPEN = dtime(9, 0, 0)
BANK_CLOSE = dtime(17, 0, 0)


@dataclass
class TrackState:
    track_id: int
    class_name: str
    bbox: Tuple[float, float, float, float]
    conf: float
    first_seen: float
    last_seen: float
    history: List[Tuple[float, float, float]] = field(default_factory=list)
    time_in_atm_roi: float = 0.0
    time_in_parking_roi: float = 0.0


class SimpleTracker:
    """Lightweight IoU tracker for heuristic scoring."""

    def __init__(self, iou_thresh: float = 0.3, max_age: float = 2.0):
        self.iou_thresh = iou_thresh
        self.max_age = max_age
        self.next_id = 1
        self.tracks: Dict[int, TrackState] = {}

    def update_roi_times(
        self,
        track: TrackState,
        ts: float,
        camera_type: str,
        atm_roi: Tuple[int, int, int, int],
        parking_roi: Tuple[int, int, int, int],
    ):
        if not track.history:
            return

        _, cx, cy = track.history[-1]
        dt = ts - track.last_seen
        if dt < 0:
            dt = 0

        if camera_type == "ATM" and point_in_rect(cx, cy, atm_roi):
            track.time_in_atm_roi += dt
        elif camera_type == "PARKING" and point_in_rect(cx, cy, parking_roi):
            track.time_in_parking_roi += dt

    def update(
        self,
        detections: List[Dict],
        timestamp: float,
        camera_type: str,
        atm_roi: Tuple[int, int, int, int],
        parking_roi: Tuple[int, int, int, int],
    ) -> List[TrackState]:
        # Drop stale tracks
        expired = [
            tid for tid, tr in self.tracks.items() if timestamp - tr.last_seen > self.max_age
        ]
        for tid in expired:
            del self.tracks[tid]

        unmatched = []
        for det in detections:
            best_iou = 0.0
            best_id = None
            for tid, tr in self.tracks.items():
                if tr.class_name != det["class_name"]:
                    continue
                cur_iou = bbox_iou(tr.bbox, det["bbox"])
                if cur_iou > best_iou:
                    best_iou = cur_iou
                    best_id = tid

            if best_id is not None and best_iou >= self.iou_thresh:
                tr = self.tracks[best_id]
                self.update_roi_times(tr, timestamp, camera_type, atm_roi, parking_roi)
                tr.bbox = det["bbox"]
                tr.conf = det["conf"]
                tr.last_seen = timestamp
                cx, cy = bbox_center(det["bbox"])
                tr.history.append((timestamp, cx, cy))
            else:
                unmatched.append(det)

        for det in unmatched:
            cx, cy = bbox_center(det["bbox"])
            tr = TrackState(
                track_id=self.next_id,
                class_name=det["class_name"],
                bbox=det["bbox"],
                conf=det["conf"],
                first_seen=timestamp,
                last_seen=timestamp,
                history=[(timestamp, cx, cy)],
            )
            self.tracks[self.next_id] = tr
            self.next_id += 1

        return list(self.tracks.values())


def bbox_center(bbox: Tuple[float, float, float, float]) -> Tuple[float, float]:
    x1, y1, x2, y2 = bbox
    return (x1 + x2) / 2.0, (y1 + y2) / 2.0


def bbox_iou(box_a: Tuple[float, float, float, float], box_b: Tuple[float, float, float, float]) -> float:
    xA = max(box_a[0], box_b[0])
    yA = max(box_a[1], box_b[1])
    xB = min(box_a[2], box_b[2])
    yB = min(box_a[3], box_b[3])

    inter_w = max(0, xB - xA)
    inter_h = max(0, yB - yA)
    inter_area = inter_w * inter_h
    if inter_area == 0:
        return 0.0

    box_a_area = (box_a[2] - box_a[0]) * (box_a[3] - box_a[1])
    box_b_area = (box_b[2] - box_b[0]) * (box_b[3] - box_b[1])
    return inter_area / float(box_a_area + box_b_area - inter_area)


def point_in_rect(x: float, y: float, rect: Tuple[int, int, int, int]) -> bool:
    x1, y1, x2, y2 = rect
    return x1 <= x <= x2 and y1 <= y <= y2


def auto_detect_atm_roi(frame: np.ndarray) -> Tuple[int, int, int, int]:
    h, w = frame.shape[:2]
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(gray, 50, 150)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    best_bbox = None
    best_area = 0
    for cnt in contours:
        x, y, cw, ch = cv2.boundingRect(cnt)
        area = cw * ch
        if area < 0.01 * w * h or area > 0.5 * w * h:
            continue
        cx = x + cw / 2.0
        if cx > 0.6 * w:
            continue
        if x < 5 or y < 5 or x + cw > w - 5 or y + ch > h - 5:
            continue
        aspect = cw / float(ch)
        if aspect < 0.4 or aspect > 1.4:
            continue
        if area > best_area:
            best_area = area
            best_bbox = (x, y, x + cw, y + ch)

    if best_bbox is None:
        x1 = int(0.05 * w)
        y1 = int(0.1 * h)
        x2 = int(0.45 * w)
        y2 = int(0.9 * h)
        best_bbox = (x1, y1, x2, y2)

    x1, y1, x2, y2 = best_bbox
    bw = x2 - x1
    bh = y2 - y1
    pad_x = 0.25 * bw
    pad_top = 0.1 * bh
    pad_bottom = 0.8 * bh

    x1 = max(0, int(x1 - pad_x))
    x2 = min(w - 1, int(x2 + pad_x))
    y1 = max(0, int(y1 - pad_top))
    y2 = min(h - 1, int(y2 + pad_bottom))

    return (x1, y1, x2, y2)


def is_after_hours(now: Optional[datetime] = None) -> bool:
    if now is None:
        now = datetime.now()
    t = now.time()
    return not (BANK_OPEN <= t <= BANK_CLOSE)


def is_late_night(now: Optional[datetime] = None) -> bool:
    if now is None:
        now = datetime.now()
    t = now.time()
    return (t >= dtime(23, 0, 0)) or (t <= dtime(4, 0, 0))


def extract_features(
    tracks: List[TrackState],
    camera_type: str,
    atm_roi: Tuple[int, int, int, int],
    parking_roi: Tuple[int, int, int, int],
    timestamp: float,
) -> Dict:
    dt = datetime.fromtimestamp(timestamp)
    after_hours = is_after_hours(dt)
    late_night = is_late_night(dt)

    num_people = 0
    num_cars = 0
    num_people_near_atm = 0
    num_cars_in_parking = 0
    max_loiter_time_atm = 0.0
    max_parked_time_after_hours = 0.0

    for tr in tracks:
        cx, cy = bbox_center(tr.bbox)
        if tr.class_name == "person":
            num_people += 1
            if point_in_rect(cx, cy, atm_roi):
                num_people_near_atm += 1
            if tr.time_in_atm_roi > max_loiter_time_atm:
                max_loiter_time_atm = tr.time_in_atm_roi
        if tr.class_name in {"car", "truck", "bus", "motorbike"}:
            num_cars += 1
            if point_in_rect(cx, cy, parking_roi):
                num_cars_in_parking += 1
            if after_hours and tr.time_in_parking_roi > max_parked_time_after_hours:
                max_parked_time_after_hours = tr.time_in_parking_roi

    return {
        "camera_type": camera_type,
        "after_hours": after_hours,
        "late_night": late_night,
        "num_people": num_people,
        "num_cars": num_cars,
        "num_people_near_atm": num_people_near_atm,
        "num_cars_in_parking": num_cars_in_parking,
        "max_loiter_time_atm": max_loiter_time_atm,
        "max_parked_time_after_hours": max_parked_time_after_hours,
    }


def compute_danger_score(features: Dict) -> Dict:
    score = 0
    reasons: List[str] = []

    cam_type = features["camera_type"]
    num_people = features["num_people"]
    num_near_atm = features["num_people_near_atm"]
    after_hours = features["after_hours"]
    late_night = features["late_night"]

    if cam_type == "ATM":
        if num_people >= 2:
            score += 25
            reasons.append("Multiple people in ATM camera view")
        if num_near_atm >= 1:
            score += 20
            reasons.append("Person in ATM interaction zone")
        if num_near_atm >= 2:
            score += 25
            reasons.append("Multiple people in ATM interaction zone")
        if features["max_loiter_time_atm"] > 5:
            score += 20
            reasons.append("Person loitering near ATM >5s")
        if late_night or after_hours:
            score += 10
            reasons.append("ATM activity during late night / after hours")

    if cam_type == "PARKING":
        if after_hours and features["num_cars_in_parking"] > 0:
            score += 40
            reasons.append("Vehicle present in parking lot after hours")
        if features["max_parked_time_after_hours"] > 600:
            score += 25
            reasons.append("Vehicle parked >10 minutes after hours")

    if num_people >= 5 and late_night:
        score += 10
        reasons.append("Crowd detected during late night")

    score = max(0, min(score, 100))
    labels = []
    if cam_type == "ATM" and score >= 60:
        labels.append("ATM_FRAUD_SUSPECTED")
    if cam_type == "PARKING" and score >= 60:
        labels.append("UNAUTHORIZED_PARKING_AFTER_HOURS")

    return {
        "danger_score": score,
        "reasons": reasons,
        "labels": labels,
    }


class HeuristicEngine:
    """Reusable behavioral heuristics for ATM/PARKING cameras."""

    def __init__(self, camera_type: str = "GENERIC"):
        self.camera_type = (camera_type or "GENERIC").upper()
        self.tracker = SimpleTracker()
        self.atm_roi: Optional[Tuple[int, int, int, int]] = None
        self.parking_roi = PARKING_ROI

    def process_frame(
        self,
        frame: np.ndarray,
        detections: List[Dict],
        timestamp: float,
    ) -> Optional[Dict]:
        if self.camera_type not in {"ATM", "PARKING"}:
            return None

        if self.camera_type == "ATM" and self.atm_roi is None:
            try:
                self.atm_roi = auto_detect_atm_roi(frame)
            except Exception:
                self.atm_roi = DEFAULT_ATM_ROI

        atm_roi = self.atm_roi or DEFAULT_ATM_ROI
        parking_roi = self.parking_roi

        tracked_detections = [
            det
            for det in detections
            if det.get("class_name") in TRACKABLE_CLASSES
        ]

        tracks = self.tracker.update(
            tracked_detections,
            timestamp,
            self.camera_type,
            atm_roi,
            parking_roi,
        )

        if not tracks:
            return None

        features = extract_features(tracks, self.camera_type, atm_roi, parking_roi, timestamp)

        # Fallback if auto ATM ROI missed the interaction zone:
        # if we see people but none inside the ROI, re-derive ROI from people positions.
        if (
            self.camera_type == "ATM"
            and features["num_people"] > 0
            and features["num_people_near_atm"] == 0
        ):
            dynamic_roi = _fallback_roi_from_people(tracks, frame.shape)
            if dynamic_roi is not None:
                self.atm_roi = dynamic_roi
                atm_roi = dynamic_roi
                features = extract_features(
                    tracks, self.camera_type, atm_roi, parking_roi, timestamp
                )

        stats = compute_danger_score(features)
        score = stats["danger_score"]
        labels = stats["labels"]

        if labels:
            level = "HIGH"
        elif score >= 40:
            level = "MEDIUM"
        else:
            level = "LOW"

        overlay = None
        if labels:
            overlay = f"{labels[0]} ({score:.0f})"
        elif level == "MEDIUM":
            overlay = f"Suspicious activity ({score:.0f})"

        return {
            "danger_level": level,
            "labels": labels,
            "score": score,
            "reasons": stats["reasons"],
            "overlay_text": overlay,
        }


def _fallback_roi_from_people(
    tracks: List[TrackState],
    frame_shape: Tuple[int, int, int],
) -> Optional[Tuple[int, int, int, int]]:
    people = [tr for tr in tracks if tr.class_name == "person"]
    if not people:
        return None
    h, w = frame_shape[:2]
    min_x = min(int(tr.bbox[0]) for tr in people)
    min_y = min(int(tr.bbox[1]) for tr in people)
    max_x = max(int(tr.bbox[2]) for tr in people)
    max_y = max(int(tr.bbox[3]) for tr in people)
    pad_x = int(0.1 * w)
    pad_y = int(0.15 * h)
    x1 = max(0, min_x - pad_x)
    y1 = max(0, min_y - pad_y)
    x2 = min(w - 1, max_x + pad_x)
    y2 = min(h - 1, max_y + pad_y)
    return (x1, y1, x2, y2)

