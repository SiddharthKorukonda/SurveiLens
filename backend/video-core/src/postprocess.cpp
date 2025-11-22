#include "postprocess.hpp"
#include <chrono>
#include <iomanip>
#include <sstream>

namespace {
std::string now_iso_utc() {
  using namespace std::chrono;
  auto now = system_clock::now();
  std::time_t t = system_clock::to_time_t(now);
  std::tm tm = *gmtime(&t);
  char buf[64];
  std::strftime(buf, sizeof(buf), "%FT%TZ", &tm);
  return std::string(buf);
}
} // namespace

struct PostProcessor::Impl {
  core::CameraParams params;
  std::vector<std::string> zones;
  std::vector<std::string> keywords;

  Impl(const core::CameraParams& p) : params(p) {}

  static float fuse_risk(const std::vector<FrameEvent::Obj>& objs,
                         const std::vector<FrameEvent::Act>& acts,
                         const std::vector<std::string>& zones,
                         const std::vector<FrameEvent::Aud>& aflags) {
    float r = 0.0f;
    for (auto& o : objs) r = std::max(r, o.conf * 0.7f);
    for (auto& a : acts) r = std::max(r, a.conf * 0.8f);
    for (auto& f : aflags) if (f.name=="raised_voice") r = std::max(r, 0.75f * f.conf);
    if (!zones.empty()) r = std::max(r, 0.5f);
    return std::min(r, 1.0f);
  }
};

PostProcessor::PostProcessor(const core::CameraParams& p) : d_(new Impl(p)) {}
void PostProcessor::update_policy(const std::vector<std::string>& zones,
                                  const std::vector<std::string>& keywords) {
  d_->zones = zones;
  d_->keywords = keywords;
}

FrameEvent PostProcessor::process_frame(const cv::Mat& bgr,
                                        uint64_t frame_id,
                                        float obj_thresh, float act_thresh,
                                        float risk_med, float risk_high) {
  FrameEvent ev;
  ev.ts_iso = now_iso_utc();
  ev.site_id = d_->params.site_id;
  ev.camera_id = d_->params.camera_id;
  ev.frame_id = frame_id;

  ev.zones = d_->zones; // placeholder

  ev.risk_local = Impl::fuse_risk(ev.objects, ev.actions, ev.zones, ev.audio_flags);
  if (ev.risk_local >= risk_high)        ev.level_local = "high";
  else if (ev.risk_local >= risk_med)    ev.level_local = "medium";
  else if (ev.risk_local >= 0.05f)       ev.level_local = "low";
  else                                   ev.level_local = "none";

  return ev;
}
