#pragma once
#include "common.hpp"
#include "postprocess.hpp"
#include <string>
#include <vector>

class EventStreamer {
public:
  explicit EventStreamer(const core::CameraParams& p);
  ~EventStreamer();

  void push(const FrameEvent& ev);
  void push_pcm(const std::string& ts_iso,
                const std::string& site_id,
                const std::string& camera_id,
                const std::string& pcm16,
                uint32_t sample_rate);

  static std::string now_iso_utc();

private:
  struct Impl; Impl* d_;
};
