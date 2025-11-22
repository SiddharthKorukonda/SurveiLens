#pragma once

#include <opencv2/dnn.hpp>
#include <string>
#include <unordered_set>
#include <vector>
#include <memory>

#include "frame_types.hpp"

#ifdef USE_ONNXRUNTIME
#include <onnxruntime_cxx_api.h>
#endif

namespace edge {

class InferenceEngine {
public:
    InferenceEngine(const std::string& model_path,
                    const std::string& class_names_path,
                    int img_size,
                    float conf_threshold,
                    bool overlay_enabled,
                    bool use_onnxruntime);

    bool ready() const { return ready_; }

    FrameResult run(const FrameResult& input);

private:
    DangerLevel level_for_label(const std::string& label) const;
    std::string canonical(const std::string& s) const;
    void load_class_names(const std::string& path);

    cv::dnn::Net net_;
    std::vector<std::string> class_names_;
    int input_size_;
    float conf_threshold_;
    bool ready_{false};
    bool overlay_enabled_{true};
    bool use_ort_{false};

    std::unordered_set<std::string> high_labels_;
    std::unordered_set<std::string> medium_labels_;

#ifdef USE_ONNXRUNTIME
    FrameResult run_ort(const FrameResult& input);
#endif
    FrameResult run_opencv(const FrameResult& input);

#ifdef USE_ONNXRUNTIME
    Ort::Env env_{ORT_LOGGING_LEVEL_WARNING, "edge-node"};
    std::unique_ptr<Ort::Session> session_;
    Ort::MemoryInfo mem_info_{Ort::MemoryInfo::CreateCpu(OrtDeviceAllocator, OrtMemTypeCPU)};
    std::vector<std::string> input_name_strs_;
    std::vector<const char*> input_names_;
    std::vector<std::string> output_name_strs_;
    std::vector<const char*> output_names_;
#endif
};

}  // namespace edge
