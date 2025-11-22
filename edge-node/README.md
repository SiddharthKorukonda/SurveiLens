# Edge Node (C++)

Minimal C++ port of the Python `server.py`/`danger_yolo_live.py` pipeline.

## Build

```bash
cd edge-node
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
```

Dependencies:
- OpenCV built with DNN (for preprocessing/overlay; also used as fallback)
- ONNX Runtime (CPU) bundled at `third_party/onnxruntime/onnxruntime-win-x64-1.19.2` by default
- CMake >= 3.16

## Run

```bash
./build/edge_node --source 0 --model yolo11n.onnx --img 640 --conf 0.25 --alerts alerts.jsonl --show-window
```

Flags:
- `--source` camera index or RTSP/URL (or env `VIDEO_SOURCE`)
- `--model` ONNX path (or env `YOLO_WEIGHTS`)
- `--class-names` optional labels file (one label per line)
- `--img` inference size (env `IMG_SIZE`)
- `--conf` confidence threshold (env `YOLO_CONF`)
- `--alerts` alerts JSONL output path
- `--no-overlay` disable drawing/overlays
- `--use-ort` / `--no-ort` enable/disable ONNX Runtime (default on)
- `--show-window` enable debug window
- `--fps` target capture FPS

Behavior:
- Captures from the source on a dedicated thread.
- Runs ONNX inference via ONNX Runtime (CPU) by default; falls back to OpenCV DNN if ORT is missing or `--no-ort`. Overlays bounding boxes and applies the same HIGH/MEDIUM danger labeling (knife/gun/etc. -> HIGH, scissors -> MEDIUM).
- When a HIGH-level object is present in a frame, writes a JSONL alert (`alerts_jsonl`) similar to the Python app.
- Optional local preview window; quit with `q` or `Esc`.

Not included in this cut:
- WebRTC signaling/transport and FastAPI endpoints (the core low-latency capture/inference/alert path is implemented; transport can be added on top via libdatachannel/libwebrtc + a small REST server if needed).
