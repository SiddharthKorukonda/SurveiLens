import time, argparse, json, os, requests
from datetime import datetime, timezone
from backend.models.cv_detector import CVCadence
from backend.models.audio_analyzer import analyze_window_audio
from backend.models.reid import assign_global_ids

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--camera-id", required=True)
    ap.add_argument("--site-id", default=os.getenv("SITE_ID","site-01"))
    ap.add_argument("--backend", default=os.getenv("BACKEND_BASE_URL","http://localhost:8000"))
    args = ap.parse_args()

    cv = CVCadence()
    while True:
        start = datetime.now(timezone.utc)
        time.sleep(10)
        end = datetime.now(timezone.utc)

        video_facts = cv.analyze_window()
        audio_facts = analyze_window_audio()
        video_facts["recent_weapon_conf"] = getattr(cv, "weapon_conf_hist", [])[-5:]
        tracklets = assign_global_ids([{"local_id":"t1","bbox":[100,100,200,200],"features":{"speed":0.2}}])

        clip_key = f"clips/{args.site_id}/{args.camera_id}/{start.strftime('%Y-%m-%d_%H%M%S')}_{end.strftime('%H%M%S')}.mp4"
        payload = {
            "site_id": args.site_id,
            "camera_id": args.camera_id,
            "window_start": start.isoformat().replace("+00:00","Z"),
            "window_end": end.isoformat().replace("+00:00","Z"),
            "video_facts": video_facts,
            "audio_facts": audio_facts,
            "tracklets": tracklets,
            "clip_key": clip_key
        }
        token = os.getenv("M2M_TOKEN","dev")
        headers = {"Authorization": f"Bearer {token}"}
        try:
            r = requests.post(f"{args.backend}/observe", json=payload, headers=headers, timeout=5)
            print("POST /observe", r.status_code, r.text)
        except Exception as e:
            print("Failed to post observe:", e)
        time.sleep(5)

if __name__ == "__main__":
    main()
