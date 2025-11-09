import os, requests
payload = {
  "site_id":"site-01",
  "camera_id":"cam-a",
  "window_start":"2025-11-08T12:05:10Z",
  "window_end":"2025-11-08T12:05:22Z",
  "video_facts":{"people":3,"weapon_like_conf":0.88,"aggression_conf":0.76,"objects":["bottle","bag"]},
  "audio_facts":{"shouting_conf":0.81,"glass_break_conf":0.03,"keywords":["help"]},
  "tracklets":[{"local_id":"t17","bbox":[120,90,220,340],"features":{"speed":0.3}}],
  "clip_key":"clips/site-01/cam-a/2025-11-08_120510_120522.mp4"
}
url = os.getenv("BACKEND_BASE_URL","http://localhost:8000")+"/observe"
headers = {"Authorization": "Bearer dev"}
print("POST", url)
print(requests.post(url, json=payload, headers=headers).text)
