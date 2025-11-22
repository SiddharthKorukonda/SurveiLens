#pragma once

#include <string>

namespace edge {

struct AppConfig {
    std::string source{"0"};          // camera index as string or URL/RTSP
    std::string model_path{"models/atm_person_detector.onnx"};
    std::string class_names_path{};   // optional path to names file
    std::string alerts_jsonl{"alerts.jsonl"};
    int img_size{640};
    float conf_threshold{0.25f};
    bool overlay_enabled{true};
    bool use_ort{true};               // use ONNX Runtime when available
    bool show_window{false};          // optional OpenCV window for local debug
    int target_fps{30};
};

AppConfig parse_args(int argc, char** argv);

}  // namespace edge
