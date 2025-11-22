#pragma once
#include "common.hpp"
#include <opencv2/core.hpp>
#include <string>
#include <vector>

struct FrameEvent {
  std::string ts_iso;
  std::string site_id;
  std::string camera_id;
  uint64_t    frame_id{0};

  struct Obj { std::string name; float conf; };
  struct Act { std::string name; float conf; };
  struct Aud { std::string name; float conf; };
  std::vector<Obj> objects;
  std::vector<Act> actions;
  std::vector<std::string> zones;
  std::vector<Aud> audio_flags;

  float risk_local{0.0f};
  std::string level_local{"none"};
};

class PostProcessor {
public:
  explicit PostProcessor(const core::CameraParams& p);
  void update_policy(const std::vector<std::string>& zones,
                     const std::vector<std::string>& keywords);

  FrameEvent process_frame(const cv::Mat& bgr,
                           uint64_t frame_id,
                           float obj_thresh, float act_thresh,
                           float risk_med,  float risk_high);

private:
  struct Impl;
  Impl* d_;
};
