#pragma once
#include <thread>
#include <atomic>
#include <string>

class MetricsServer {
public:
  MetricsServer();
  ~MetricsServer();
  void start(const std::string& bind="0.0.0.0", int port=9100);
  void stop();

private:
  struct Impl; Impl* d_;
};
