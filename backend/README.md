# SurveiLens Backend (C++ hot path + Rust control plane)

## Prereqs (macOS or Ubuntu)
- Protobuf, gRPC, OpenCV, GStreamer dev headers
- Rust stable, Cargo
- CMake >= 3.16
- Optional: ONNX Runtime CPU, RNNoise, WebRTC VAD

### macOS (Homebrew)
```sh
brew install protobuf grpc opencv gstreamer pkg-config cmake rust
```

### Ubuntu 22.04
```sh
sudo apt-get update && sudo apt-get install -y   build-essential cmake pkg-config   libopencv-dev libgstreamer1.0-dev libgstreamer-plugins-base1.0-dev   libprotobuf-dev protobuf-compiler grpc-proto grpc-dev libgrpc++-dev   rustc cargo
```

## Build Rust control-plane
```sh
cd surveilens/backend/control-plane
cargo build --release
```

## Build C++ video-core
```sh
cd ../video-core
mkdir -p build && cd build
cmake ..
make -j
```

## Run locally (separate terminals)

### 1) Rust gRPC + HTTP
```sh
cd surveilens/backend/control-plane
RUST_GRPC_BIND=0.0.0.0:50052 RUST_HTTP_BIND=0.0.0.0:8080 CXX_WORKER_ADDR=http://127.0.0.1:50051 cargo run --release
```

### 2) C++ worker
```sh
cd surveilens/backend/video-core/build
RUST_CONTROL_PLANE=127.0.0.1:50052 CXX_WORKER_BIND=0.0.0.0:50051 ./surveilens-video-core
```

### 3) Start a camera (replace RTSP if needed)
```sh
curl -X POST "http://localhost:8080/api/cameras/siteA/cam1/start"
```

### 4) Inspect health and JSON cadence
```sh
curl "http://localhost:8080/health"
sleep 15
curl "http://localhost:8080/api/jsonlogs/siteA/cam1/latest" | jq
```

## Docker compose (optional)
```sh
cd surveilens
docker compose up --build
```

## Models
Place your ONNX models under `surveilens/backend/assets/models/` as needed, for example `yolo11n.onnx`.
