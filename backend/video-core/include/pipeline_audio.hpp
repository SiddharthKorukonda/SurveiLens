#pragma once
#include "common.hpp"

class AudioPipeline {
public:
  explicit AudioPipeline(const core::CameraParams& p);
  ~AudioPipeline();

  void start();
  void stop();
  void update_params(const core::Thresholds& th,
                     const std::vector<std::string>& zones,
                     const std::vector<std::string>& keywords);

private:
  struct Impl;
  Impl* d_;
};
