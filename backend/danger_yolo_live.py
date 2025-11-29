"""
Minimal end-to-end bank CV logic in one file.

Features:
- YOLOv10 detection (people, cars, etc.)
- Simple tracker with per-track timing
- ATM fraud-ish logic (loitering, multiple people)
- After-hours parking logic (cars in lot after hours)
- Treats video files as "fake live" by sleeping according to FPS
- Feature collection mode (for training on artificial events)
- Optional ML danger model (trained from collected features)
- NEW: Automatic ATM ROI detection from the first frame (no manual clicking)
"""

import argparse
import time
from datetime import datetime, time as dtime
from dataclasses import dataclass, field
from typing import List, Tuple, Dict, Optional, Any
import csv
import os

import cv2
import numpy as np
from ultralytics import YOLO

try:
    import joblib
except ImportError:
    joblib = None


# ------------------------- CONFIG SECTION -------------------------

# Bank hours (24h clock). Adjust as needed.
BANK_OPEN = dtime(9, 0, 0)  # 09:00
BANK_CLOSE = dtime(17, 0, 0)  # 17:00

# ROIs are pixel rectangles: (x1, y1, x2, y2)
# ATM_ROI will now be set automatically from the first frame.
ATM_ROI: Tuple[float, float, float, float] = (200, 100, 450, 400)  # default, overwritten
PARKING_ROI = (50, 200, 1200, 700)  # region for parking lot

# Class names for YOLOv10 COCO model (partial, only what we care about here)
COCO_CLASSES = {
    0: "person",
    1: "bicycle",
    2: "car",
    3: "motorbike",
    5: "bus",
    7: "truck",
    # add more if needed
}

# Order of features used for ML model (keep in sync with training script)
FEATURE_KEYS = [
    "after_hours",
    "late_night",
    "num_people",
    "num_cars",
    "num_people_near_atm",
    "num_cars_in_parking",
    "max_loiter_time_atm",
    "max_parked_time_after_hours",
    "cam_is_atm",
    "cam_is_parking",
]


# ------------------------- DATA STRUCTURES ------------------------

@dataclass
class TrackState:
    track_id: int
    class_name: str
    bbox: Tuple[float, float, float, float]
    conf: float
    first_seen: float
    last_seen: float
    # History of (timestamp, center_x, center_y)
    history: List[Tuple[float, float, float]] = field(default_factory=list)
    time_in_atm_roi: float = 0.0
    time_in_parking_roi: float = 0.0


@dataclass
class SceneState:
    timestamp: float
    camera_type: str
    tracks: List[TrackState]


# ------------------------- SIMPLE TRACKER -------------------------

def iou(boxA, boxB) -> float:
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])

    interW = max(0, xB - xA)
    interH = max(0, yB - yA)
    interArea = interW * interH
    if interArea == 0:
        return 0.0

    boxAArea = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
    boxBArea = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1])
    return interArea / float(boxAArea + boxBArea - interArea)


class SimpleTracker:
    """
    Very naive IoU-based tracker just to get persistent IDs.
    Good enough for hackathon / prototype.
    """

    def __init__(self, iou_thresh=0.3, max_age=2.0):
        self.iou_thresh = iou_thresh
        self.max_age = max_age
        self.next_id = 1
        self.tracks: Dict[int, TrackState] = {}

    def update_roi_times(self, track: TrackState, ts: float, camera_type: str):
        if not track.history:
            return

        # Use last history point to approximate time in ROI since last_seen
        last_ts, cx, cy = track.history[-1]

        dt = ts - track.last_seen
        if dt < 0:
            dt = 0

        if camera_type == "ATM":
            if point_in_rect(cx, cy, ATM_ROI):
                track.time_in_atm_roi += dt
        elif camera_type == "PARKING":
            if point_in_rect(cx, cy, PARKING_ROI):
                track.time_in_parking_roi += dt

    def update(self, detections, timestamp: float, camera_type: str) -> List[TrackState]:
        """
        detections: list of {bbox, conf, class_name}
        returns: list of TrackState
        """
        # Age out old tracks
        to_delete = []
        for tid, tr in self.tracks.items():
            if timestamp - tr.last_seen > self.max_age:
                to_delete.append(tid)
        for tid in to_delete:
            del self.tracks[tid]

        unmatched_dets = []

        for det in detections:
            best_iou = 0
            best_id = None
            for tid, tr in self.tracks.items():
                if tr.class_name != det["class_name"]:
                    continue
                cur_iou = iou(tr.bbox, det["bbox"])
                if cur_iou > best_iou:
                    best_iou = cur_iou
                    best_id = tid

            if best_id is not None and best_iou >= self.iou_thresh:
                tr = self.tracks[best_id]
                self.update_roi_times(tr, timestamp, camera_type)

                tr.bbox = det["bbox"]
                tr.conf = det["conf"]
                tr.last_seen = timestamp
                cx, cy = bbox_center(det["bbox"])
                tr.history.append((timestamp, cx, cy))
            else:
                unmatched_dets.append(det)

        # Create new tracks for unmatched detections
        for det in unmatched_dets:
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


# ------------------------- GEOMETRY HELPERS -----------------------

def bbox_center(bbox):
    x1, y1, x2, y2 = bbox
    return (x1 + x2) / 2.0, (y1 + y2) / 2.0


def point_in_rect(x, y, rect):
    x1, y1, x2, y2 = rect
    return x1 <= x <= x2 and y1 <= y <= y2


# ------------------------- ATM ROI AUTO-DETECTION -----------------

def auto_detect_atm_roi(frame) -> Tuple[float, float, float, float]:
    """
    Heuristic ATM detector from a single frame using contours.

    Idea:
    - Find large-ish rectangular contour on the LEFT half of the frame
    - Not touching both left+right edges
    - Roughly vertical rectangle
    - Then expand downward/sideways to include user standing zone.
    """
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
        if area < 0.01 * w * h:
            continue
        if area > 0.5 * w * h:
            continue

        cx = x + cw / 2.0
        # favor left half
        if cx > 0.6 * w:
            continue

        # avoid contours glued to borders
        if x < 5 or y < 5 or x + cw > w - 5 or y + ch > h - 5:
            continue

        aspect = cw / float(ch)
        # roughly vertical rectangle
        if aspect < 0.4 or aspect > 1.4:
            continue

        if area > best_area:
            best_area = area
            best_bbox = (x, y, x + cw, y + ch)

    if best_bbox is None:
        # Super simple fallback: left-middle region.
        x1 = int(0.05 * w)
        y1 = int(0.1 * h)
        x2 = int(0.45 * w)
        y2 = int(0.9 * h)
        best_bbox = (x1, y1, x2, y2)

    # Expand ATM ROI to include where people stand
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


# ------------------------- FEATURE / LOGIC ------------------------

def is_after_hours(now: Optional[datetime] = None) -> bool:
    if now is None:
        now = datetime.now()
    t = now.time()
    return not (BANK_OPEN <= t <= BANK_CLOSE)


def is_late_night(now: Optional[datetime] = None) -> bool:
    if now is None:
        now = datetime.now()
    # define "late night" as 23:00–04:00
    t = now.time()
    return (t >= dtime(23, 0, 0)) or (t <= dtime(4, 0, 0))


def extract_features(scene: SceneState):
    """
    Computes high-level features from scene + tracks for danger scoring.
    """
    now_dt = datetime.fromtimestamp(scene.timestamp)
    after_hours = is_after_hours(now_dt)
    late_night = is_late_night(now_dt)

    num_people = 0
    num_cars = 0
    num_people_near_atm = 0
    num_cars_in_parking = 0
    max_loiter_time_atm = 0.0
    max_parked_time_after_hours = 0.0

    for tr in scene.tracks:
        cx, cy = bbox_center(tr.bbox)

        if tr.class_name == "person":
            num_people += 1
            if point_in_rect(cx, cy, ATM_ROI):
                num_people_near_atm += 1
            if tr.time_in_atm_roi > max_loiter_time_atm:
                max_loiter_time_atm = tr.time_in_atm_roi

        if tr.class_name in ("car", "truck", "bus", "motorbike"):
            num_cars += 1
            if point_in_rect(cx, cy, PARKING_ROI):
                num_cars_in_parking += 1
            if after_hours and tr.time_in_parking_roi > max_parked_time_after_hours:
                max_parked_time_after_hours = tr.time_in_parking_roi

    feats = {
        "after_hours": after_hours,
        "late_night": late_night,
        "num_people": num_people,
        "num_cars": num_cars,
        "num_people_near_atm": num_people_near_atm,
        "num_cars_in_parking": num_cars_in_parking,
        "max_loiter_time_atm": max_loiter_time_atm,
        "max_parked_time_after_hours": max_parked_time_after_hours,
        "camera_type": scene.camera_type,
        "cam_is_atm": 1 if scene.camera_type == "ATM" else 0,
        "cam_is_parking": 1 if scene.camera_type == "PARKING" else 0,
    }
    return feats


def features_to_vector(features: dict) -> List[float]:
    vec: List[float] = []
    for key in FEATURE_KEYS:
        val = features[key]
        if isinstance(val, bool):
            val = 1.0 if val else 0.0
        vec.append(float(val))
    return vec


def compute_danger_score(features: dict):
    """
    Rule-based danger score 0–100, with reasons and flags.
    Bank-specific ATM & parking behavior lives here.
    """
    score = 0
    reasons = []

    cam_type = features["camera_type"]
    num_people = features["num_people"]
    num_near_atm = features["num_people_near_atm"]
    after_hours = features["after_hours"]
    late_night = features["late_night"]

    # ---------- ATM FRAUD-ISH LOGIC ----------
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

    # ---------- AFTER-HOURS PARKING LOGIC ----------
    if cam_type == "PARKING":
        if after_hours and features["num_cars_in_parking"] > 0:
            score += 40
            reasons.append("Vehicle present in parking lot after hours")

        if features["max_parked_time_after_hours"] > 600:
            score += 25
            reasons.append("Vehicle parked >10 minutes after hours")

    # ---------- GENERIC CROWDING / CONTEXT ----------
    if num_people >= 5 and late_night:
        score += 10
        reasons.append("Crowd detected during late night")

    score = max(0, min(score, 100))

    atm_flag = (cam_type == "ATM") and (score >= 60)
    parking_flag = (cam_type == "PARKING") and (score >= 60)

    labels = []
    if atm_flag:
        labels.append("ATM_FRAUD_SUSPECTED")
    if parking_flag:
        labels.append("UNAUTHORIZED_PARKING_AFTER_HOURS")

    return {
        "danger_score": score,
        "reasons": reasons,
        "labels": labels,
    }


# ------------------------- YOLO WRAPPER ---------------------------

class Yolo10Detector:
    def __init__(self, weights="yolov10s.pt", device="cuda"):
        self.model = YOLO(weights)
        self.device = device

    def detect(self, frame):
        """
        Returns list of {bbox, conf, class_name}
        """
        results = self.model.predict(frame, device=self.device, verbose=False)[0]
        detections = []
        for box in results.boxes:
            cls_id = int(box.cls)
            conf = float(box.conf)
            if cls_id not in COCO_CLASSES:
                continue
            class_name = COCO_CLASSES[cls_id]
            if class_name not in ("person", "car", "truck", "bus", "motorbike"):
                continue

            x1, y1, x2, y2 = box.xyxy[0].tolist()
            detections.append(
                {
                    "bbox": (x1, y1, x2, y2),
                    "conf": conf,
                    "class_name": class_name,
                }
            )
        return detections


# ------------------------- MAIN LOOP ------------------------------

def main():
    global ATM_ROI

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source",
        default="0",
        help="0 for webcam, path to video file, or RTSP stream, etc.",
    )
    parser.add_argument(
        "--camera-type",
        choices=["ATM", "PARKING"],
        default="ATM",
        help="Camera behavior profile",
    )
    parser.add_argument(
        "--weights", default="yolov10s.pt", help="YOLOv10 weights"
    )
    parser.add_argument(
        "--device", default="cpu", help="cuda or cpu"
    )
    parser.add_argument(
        "--realtime",
        type=int,
        default=1,
        help="If 1 and source is a file, sleep per-frame to mimic live.",
    )

    # training / ML args
    parser.add_argument(
        "--mode",
        choices=["run", "collect"],
        default="run",
        help="run = live scoring, collect = dump features for training",
    )
    parser.add_argument(
        "--label",
        type=int,
        default=None,
        help="Label for collect mode (0=normal,1=suspicious)",
    )
    parser.add_argument(
        "--feature-csv",
        default="features.csv",
        help="Where to store/read collected features",
    )
    parser.add_argument(
        "--ml-model",
        default=None,
        help="Path to trained ML model (joblib) for learned danger score",
    )

    args = parser.parse_args()

    # Open video source
    if args.source == "0":
        cap = cv2.VideoCapture(0)
    else:
        cap = cv2.VideoCapture(args.source)

    if not cap.isOpened():
        print("Failed to open source:", args.source)
        return

    # ATM ROI auto-detection from the first frame
    if args.camera_type == "ATM":
        ret0, frame0 = cap.read()
        if not ret0:
            print("Failed to read first frame for ATM ROI detection.")
            return
        ATM_ROI = auto_detect_atm_roi(frame0)
        print("[INFO] Auto-detected ATM_ROI:", ATM_ROI)

        # For file sources, rewind to start so we don't skip frames
        if args.source != "0":
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)

    # FPS for fake-live playback
    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0:
        fps = 30.0
    frame_delay = 1.0 / fps

    detector = Yolo10Detector(weights=args.weights, device=args.device)
    tracker = SimpleTracker()

    # Load ML danger model if provided
    ml_model: Any = None
    if args.ml_model is not None:
        if joblib is None:
            print("[WARN] joblib not installed; cannot load ML model.")
        elif os.path.exists(args.ml_model):
            ml_model = joblib.load(args.ml_model)
            print(f"[INFO] Loaded ML danger model from {args.ml_model}")
        else:
            print(f"[WARN] ML model path {args.ml_model} not found; running without ML.")

    # For collect mode: open CSV
    csv_writer = None
    csv_file = None
    if args.mode == "collect":
        if args.label is None:
            raise SystemExit("In collect mode you must specify --label 0 or 1")
        file_exists = os.path.exists(args.feature_csv)
        csv_file = open(args.feature_csv, "a", newline="")
        csv_writer = csv.writer(csv_file)
        if not file_exists:
            csv_writer.writerow(["label"] + FEATURE_KEYS)

    print(
        f"[INFO] Starting loop, mode={args.mode}, "
        f"camera_type={args.camera_type}, after_hours={is_after_hours()}"
    )

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        ts = time.time()

        # Detection
        detections = detector.detect(frame)

        # Tracking
        tracks = tracker.update(detections, ts, args.camera_type)

        # Build scene state
        scene = SceneState(
            timestamp=ts,
            camera_type=args.camera_type,
            tracks=tracks,
        )

        # Features
        features = extract_features(scene)

        if args.mode == "collect":
            vec = features_to_vector(features)
            csv_writer.writerow([args.label] + vec)

            info_line = f"COLLECT label={args.label}"
            cv2.putText(
                frame,
                info_line,
                (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX,
                1.0,
                (0, 255, 255),
                2,
            )

        else:
            result = compute_danger_score(features)
            danger_score = result["danger_score"]
            labels = result["labels"]

            # Optional ML fusion
            if ml_model is not None:
                vec = [features_to_vector(features)]
                prob = float(ml_model.predict_proba(vec)[0][1])  # P(suspicious)
                ml_score = int(100 * prob)
                danger_score = int((danger_score + ml_score) / 2)
                if prob > 0.6 and "ML_SUSPICIOUS" not in labels:
                    labels.append("ML_SUSPICIOUS")

            # --- Visualization / logging ---
            for tr in tracks:
                x1, y1, x2, y2 = map(int, tr.bbox)
                color = (0, 255, 0)
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                txt = f"{tr.class_name}#{tr.track_id}"
                cv2.putText(
                    frame,
                    txt,
                    (x1, max(0, y1 - 5)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.5,
                    color,
                    1,
                )

            # Draw ROIs (kept commented as in your original)
            """
            if args.camera_type == "ATM":
                x1, y1, x2, y2 = map(int, ATM_ROI)
                cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 255, 0), 2)
            elif args.camera_type == "PARKING":
                x1, y1, x2, y2 = PARKING_ROI
                cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 255, 0), 2)
            """

            # Overlay danger score
            info_line = f"DANGER: {danger_score:.0f}"
            if labels:
                info_line += " | " + ",".join(labels)
            cv2.putText(
                frame,
                info_line,
                (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX,
                1.0,
                (0, 0, 255) if danger_score >= 60 else (0, 255, 255),
                2,
            )

            if labels:
                print(
                    f"[ALERT] t={datetime.fromtimestamp(ts)} "
                    f"score={danger_score} labels={labels}"
                )

        cv2.imshow("Bank CV Monitor", frame)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

        if args.realtime and args.source != "0":
            time.sleep(frame_delay)

    cap.release()
    cv2.destroyAllWindows()

    if csv_file is not None:
        csv_file.close()


if __name__ == "__main__":
    main()
