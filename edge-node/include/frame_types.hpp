#pragma once

#include <opencv2/core.hpp>
#include <string>
#include <vector>

namespace edge {

enum class DangerLevel { LOW, MEDIUM, HIGH };

inline std::string danger_level_to_string(DangerLevel level) {
    switch (level) {
        case DangerLevel::HIGH: return "HIGH";
        case DangerLevel::MEDIUM: return "MEDIUM";
        default: return "LOW";
    }
}

struct Detection {
    std::string label;
    float confidence{0.0f};
    cv::Rect bbox;
    DangerLevel level{DangerLevel::LOW};
};

struct FrameResult {
    cv::Mat frame;                 // BGR image
    std::vector<Detection> dets;   // detections for this frame
    DangerLevel frame_level{DangerLevel::LOW};
    double timestamp_sec{0.0};     // monotonic clock seconds
};

}  // namespace edge
