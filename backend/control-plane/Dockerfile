FROM rust:1.81 as build
WORKDIR /app
COPY . .
RUN apt-get update && apt-get install -y protobuf-compiler &&     cargo build --release
FROM gcr.io/distroless/cc-debian12
WORKDIR /app
COPY --from=build /app/target/release/surveilens-control-plane /app/ctl
COPY proto /app/proto
COPY ../../assets /app/assets
ENV RUST_HTTP_BIND=0.0.0.0:8080
ENV RUST_GRPC_BIND=0.0.0.0:50052
CMD ["/app/ctl"]
