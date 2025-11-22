#pragma once
#include "common.hpp"

class VideoPipeline {
public:
  explicit VideoPipeline(const core::CameraParams& p);
  ~VideoPipeline();

  void start();
  void stop();
  void update_params(const core::Thresholds& th,
                     const std::vector<std::string>& zones,
                     const std::vector<std::string>& keywords);

private:
  struct Impl;
  Impl* d_;
};
