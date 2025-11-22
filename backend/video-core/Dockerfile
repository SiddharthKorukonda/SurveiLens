FROM ubuntu:22.04 as build
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y build-essential cmake pkg-config     libopencv-dev libgstreamer1.0-dev libgstreamer-plugins-base1.0-dev     libprotobuf-dev protobuf-compiler grpc-proto grpc-dev libgrpc++-dev
WORKDIR /app
COPY . .
RUN mkdir -p build && cd build && cmake .. && make -j

FROM gcr.io/distroless/cc-debian12
WORKDIR /app
COPY --from=build /app/build/surveilens-video-core /app/surveilens-video-core
COPY ../control-plane/proto /app/proto
COPY ../../assets /app/assets
ENV CXX_WORKER_BIND=0.0.0.0:50051
ENV RUST_CONTROL_PLANE=control-plane:50052
CMD ["/app/surveilens-video-core"]
