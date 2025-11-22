#include <cstdlib>
#include <iostream>
#include <memory>
#include <string>

#include <grpcpp/grpcpp.h>

// Important: include the generated gRPC header BEFORE the alias,
// so the service class is fully known when we derive from it.
#include "generated/pipeline.grpc.pb.h"
#include "generated/service_alias.h"

// We don't include any OpenCV headers here; detector code is kept in detector.cpp.

using grpc::Server;
using grpc::ServerBuilder;
using grpc::ServerContext;
using grpc::Status;

// Minimal service: we don't override anything yet.
// The generated base provides default UNIMPLEMENTED handlers,
// which is fine until we hook real logic to Start/Stop/etc.
class VideoWorkerService final : public ServiceBase {};

static std::string env_or(const char* key, const char* defval) {
    const char* v = std::getenv(key);
    return v ? std::string(v) : std::string(defval);
}

int main() {
    const std::string bind = env_or("VIDEO_CORE_GRPC_BIND", "127.0.0.1:50051");

    VideoWorkerService service;
    ServerBuilder builder;
    builder.AddListeningPort(bind, grpc::InsecureServerCredentials());
    builder.RegisterService(&service);

    std::unique_ptr<Server> server = builder.BuildAndStart();
    if (!server) {
        std::cerr << "[video-core] FATAL: failed to start gRPC server on " << bind << std::endl;
        return 2;
    }
    std::cout << "[video-core] gRPC server listening on " << bind << std::endl;
    server->Wait();
    return 0;
}
