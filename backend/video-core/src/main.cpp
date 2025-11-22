#include <iostream>
#include "server_grpc.hpp"

int main(int argc, char** argv) {
  std::string bind = "0.0.0.0:50051";
  if (const char* p = std::getenv("CXX_WORKER_BIND")) bind = p;
  std::cout << "[video-core] starting control gRPC at " << bind << std::endl;
  return run_control_server(bind);
}
