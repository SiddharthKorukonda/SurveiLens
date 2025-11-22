\
# Offline only. Do NOT run in live pipeline.
# Usage:
#   python surveilens/backend/scripts/export_to_onnx.py --pt assets/models/yolo11n.pt --out assets/models/yolo11n.onnx
import argparse

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pt", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    print("Export stub. Install ultralytics + torch to enable actual export.")

if __name__ == "__main__":
    main()
