#include "event_publisher.hpp"

#include <chrono>
#include <filesystem>
#include <iomanip>
#include <iostream>
#include <sstream>

namespace edge {

EventPublisher::EventPublisher(const std::string& path) : path_(path) {}

void EventPublisher::publish(const FrameResult& result) {
    if (result.frame_level != DangerLevel::HIGH) return;
    // Write a JSONL line similar to the Python pipeline
    std::ostringstream oss;
    oss << "{";
    oss << "\"type\":\"high_danger_alert\",";
    oss << "\"timestamp\":" << std::fixed << std::setprecision(3) << result.timestamp_sec << ",";
    oss << "\"labels\":[";
    bool first = true;
    for (const auto& d : result.dets) {
        if (d.level != DangerLevel::HIGH) continue;
        if (!first) oss << ",";
        first = false;
        oss << '\"' << d.label << '\"';
    }
    oss << "]";
    oss << "}\n";

    std::lock_guard<std::mutex> lock(mu_);
    try {
        auto parent = std::filesystem::path(path_).parent_path();
        if (!parent.empty()) {
            std::filesystem::create_directories(parent);
        }
    } catch (...) {
        // best effort
    }
    std::ofstream f(path_, std::ios::app);
    if (!f) {
        std::cerr << "[WARN] Unable to open alerts file: " << path_ << std::endl;
        return;
    }
    f << oss.str();
}

}  // namespace edge
