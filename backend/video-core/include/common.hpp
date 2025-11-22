#pragma once
#include <string>
#include <vector>
#include <atomic>
#include <mutex>
#include <unordered_map>
#include <chrono>

namespace core {

struct Thresholds {
  float obj_conf{0.25f};
  float act_conf{0.25f};
  float risk_medium{0.60f};
  float risk_high{0.80f};
};

struct CameraParams {
  std::string site_id;
  std::string camera_id;
  std::string rtsp_url;
  Thresholds thresholds;
  std::vector<std::string> zones;
  std::vector<std::string> keywords;
};

enum class Level { None, Low, Medium, High };

inline const char* level_to_str(Level l) {
  switch (l) {
    case Level::None: return "none";
    case Level::Low: return "low";
    case Level::Medium: return "medium";
    case Level::High: return "high";
  }
  return "none";
}

struct Metrics {
  std::atomic<uint64_t> frames{0};
  std::atomic<uint64_t> drops{0};
  std::atomic<double>   fps{0.0};
  std::atomic<double>   latency_ms{0.0};
};

} // namespace core
