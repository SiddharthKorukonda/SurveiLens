#include "inference_engine.hpp"

#include <algorithm>
#include <cctype>
#include <fstream>
#include <iostream>
#include <opencv2/imgproc.hpp>

namespace edge {

namespace {
cv::Mat overlay_safe(const cv::Mat& frame_in, const std::string& text, const cv::Scalar& color, double alpha = 0.35) {
    cv::Mat frame = frame_in.clone();
    try {
        cv::Mat overlay = frame.clone();
        overlay.setTo(color);
        cv::addWeighted(overlay, alpha, frame, 1.0 - alpha, 0, frame);
        const int h = frame.rows;
        cv::putText(frame, text, cv::Point(30, static_cast<int>(0.12 * h)),
                    cv::FONT_HERSHEY_SIMPLEX, 1.2, cv::Scalar(255, 255, 255), 3, cv::LINE_AA);
    } catch (...) {
        frame = frame_in.clone();
    }
    return frame;
}
}  // namespace

InferenceEngine::InferenceEngine(const std::string& model_path,
                                 const std::string& class_names_path,
                                 int img_size,
                                 float conf_threshold,
                                 bool overlay_enabled,
                                 bool use_onnxruntime)
    : input_size_(img_size),
      conf_threshold_(conf_threshold),
      overlay_enabled_(overlay_enabled),
      use_ort_(use_onnxruntime) {
    high_labels_ = {"knife", "gun", "pistol", "rifle", "revolver", "firearm"};
    medium_labels_ = {"scissors"};
    class_names_ = {"person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck",
                    "boat",   "traffic light", "fire hydrant", "stop sign", "parking meter", "bench",
                    "bird",   "cat",           "dog",         "horse",     "sheep",         "cow",
                    "elephant", "bear", "zebra", "giraffe", "backpack", "umbrella",
                    "handbag", "tie", "suitcase", "frisbee", "skis", "snowboard",
                    "sports ball", "kite", "baseball bat", "baseball glove", "skateboard",
                    "surfboard", "tennis racket", "bottle", "wine glass", "cup", "fork",
                    "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange",
                    "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair",
                    "couch", "potted plant", "bed", "dining table", "toilet", "tv", "laptop",
                    "mouse", "remote", "keyboard", "cell phone", "microwave", "oven", "toaster",
                    "sink", "refrigerator", "book", "clock", "vase", "scissors", "teddy bear",
                    "hair drier", "toothbrush"};

#ifdef USE_ONNXRUNTIME
    if (use_ort_) {
        try {
            Ort::SessionOptions opts;
            opts.SetGraphOptimizationLevel(ORT_ENABLE_ALL);
#ifdef _WIN32
            std::wstring wpath(model_path.begin(), model_path.end());
            session_ = std::make_unique<Ort::Session>(env_, wpath.c_str(), opts);
#else
            session_ = std::make_unique<Ort::Session>(env_, model_path.c_str(), opts);
#endif

            Ort::AllocatorWithDefaultOptions allocator;
            const size_t in_count = session_->GetInputCount();
            for (size_t i = 0; i < in_count; ++i) {
                auto name = session_->GetInputNameAllocated(i, allocator);
                input_name_strs_.push_back(name.get());
            }
            const size_t out_count = session_->GetOutputCount();
            for (size_t i = 0; i < out_count; ++i) {
                auto name = session_->GetOutputNameAllocated(i, allocator);
                output_name_strs_.push_back(name.get());
            }
            for (const auto& s : input_name_strs_) input_names_.push_back(s.c_str());
            for (const auto& s : output_name_strs_) output_names_.push_back(s.c_str());

            if (!class_names_path.empty()) {
                load_class_names(class_names_path);
            }
            ready_ = true;
            std::cout << "[INFO] Loaded ORT model: " << model_path << std::endl;
        } catch (const std::exception& e) {
            std::cerr << "[WARN] ONNX Runtime load failed (" << e.what() << "); falling back to OpenCV DNN." << std::endl;
            use_ort_ = false;
        }
    }
#else
    use_ort_ = false;
#endif

    if (!use_ort_) {
        try {
            net_ = cv::dnn::readNet(model_path);
            net_.setPreferableBackend(cv::dnn::DNN_BACKEND_OPENCV);
            net_.setPreferableTarget(cv::dnn::DNN_TARGET_CPU);
            if (!class_names_path.empty()) {
                load_class_names(class_names_path);
            }
            ready_ = true;
            std::cout << "[INFO] Loaded OpenCV DNN model: " << model_path << std::endl;
        } catch (const std::exception& e) {
            std::cerr << "[ERROR] Could not load model: " << e.what() << std::endl;
            ready_ = false;
        }
    }
}

std::string InferenceEngine::canonical(const std::string& s) const {
    std::string out;
    out.reserve(s.size());
    for (char c : s) out.push_back(static_cast<char>(std::tolower(static_cast<unsigned char>(c))));
    return out;
}

DangerLevel InferenceEngine::level_for_label(const std::string& label) const {
    std::string c = canonical(label);
    if (high_labels_.count(c)) return DangerLevel::HIGH;
    if (medium_labels_.count(c)) return DangerLevel::MEDIUM;
    return DangerLevel::LOW;
}

void InferenceEngine::load_class_names(const std::string& path) {
    std::ifstream f(path);
    if (!f) {
        std::cerr << "[WARN] Unable to open class names file: " << path << std::endl;
        return;
    }
    std::string line;
    while (std::getline(f, line)) {
        if (!line.empty()) class_names_.push_back(line);
    }
}

FrameResult InferenceEngine::run(const FrameResult& input) {
    if (!ready_ || input.frame.empty()) return input;
#ifdef USE_ONNXRUNTIME
    if (use_ort_ && session_) {
        return run_ort(input);
    }
#endif
    return run_opencv(input);
}

#ifdef USE_ONNXRUNTIME
FrameResult InferenceEngine::run_ort(const FrameResult& input) {
    FrameResult output = input;
    output.dets.clear();

    cv::Mat resized;
    cv::resize(input.frame, resized, cv::Size(input_size_, input_size_));
    cv::Mat rgb;
    cv::cvtColor(resized, rgb, cv::COLOR_BGR2RGB);
    rgb.convertTo(rgb, CV_32F, 1.0 / 255.0);

    std::vector<float> blob;
    blob.reserve(3 * input_size_ * input_size_);
    std::vector<int64_t> input_shape{1, 3, input_size_, input_size_};
    for (int c = 0; c < 3; ++c) {
        for (int y = 0; y < input_size_; ++y) {
            const float* row = rgb.ptr<float>(y);
            for (int x = 0; x < input_size_; ++x) {
                blob.push_back(row[x * 3 + c]);
            }
        }
    }

    Ort::Value input_tensor = Ort::Value::CreateTensor<float>(mem_info_, blob.data(), blob.size(),
                                                              input_shape.data(), input_shape.size());
    auto outputs = session_->Run(Ort::RunOptions{nullptr},
                                 input_names_.data(), &input_tensor, 1,
                                 output_names_.data(), output_names_.size());

    if (outputs.empty()) return input;
    auto& out = outputs.front();
    const float* data = out.GetTensorData<float>();
    auto shape = out.GetTensorTypeAndShapeInfo().GetShape();

    int rows = 0;
    int dims = 0;
    bool channel_first = false;
    if (shape.size() == 3) {
        rows = static_cast<int>(shape[1]);
        dims = static_cast<int>(shape[2]);
        if (shape[2] > shape[1]) {
            rows = static_cast<int>(shape[2]);
            dims = static_cast<int>(shape[1]);
            channel_first = true;
        }
    } else if (shape.size() == 2) {
        rows = static_cast<int>(shape[0]);
        dims = static_cast<int>(shape[1]);
    } else {
        return input;
    }

    const int classes = std::max(1, dims - 5);
    const int frame_w = input.frame.cols;
    const int frame_h = input.frame.rows;
    const float scale_x = static_cast<float>(frame_w) / static_cast<float>(input_size_);
    const float scale_y = static_cast<float>(frame_h) / static_cast<float>(input_size_);

    for (int i = 0; i < rows; ++i) {
        const float* ptr = channel_first ? (data + i) : (data + i * dims);
        auto item = [&](int idx) -> float {
            return channel_first ? ptr[idx * rows] : ptr[idx];
        };

        float cx = item(0);
        float cy = item(1);
        float w = item(2);
        float h = item(3);

        int best_cls = -1;
        float best_score = 0.0f;

        const float objectness = (dims >= classes + 5) ? item(4) : 1.0f;
        int class_start = (dims >= classes + 5) ? 5 : 4;
        for (int c = 0; c < classes && class_start + c < dims; ++c) {
            float cls_score = item(class_start + c);
            float conf = objectness * cls_score;
            if (conf > best_score) {
                best_score = conf;
                best_cls = c;
            }
        }

        if (best_score < conf_threshold_) continue;

        const float x0 = (cx - 0.5f * w) * scale_x;
        const float y0 = (cy - 0.5f * h) * scale_y;
        const float x1 = (cx + 0.5f * w) * scale_x;
        const float y1 = (cy + 0.5f * h) * scale_y;
        cv::Rect box(static_cast<int>(x0), static_cast<int>(y0),
                     static_cast<int>(x1 - x0), static_cast<int>(y1 - y0));

        std::string label = (best_cls >= 0 && best_cls < static_cast<int>(class_names_.size()))
                                ? class_names_[best_cls]
                                : ("cls_" + std::to_string(best_cls));

        DangerLevel level = level_for_label(label);
        output.dets.push_back(Detection{label, best_score, box, level});
    }

    output.frame = input.frame.clone();
    output.frame_level = DangerLevel::LOW;
    for (const auto& d : output.dets) {
        if (d.level == DangerLevel::HIGH) {
            output.frame_level = DangerLevel::HIGH;
            break;
        }
        if (d.level == DangerLevel::MEDIUM) {
            output.frame_level = DangerLevel::MEDIUM;
        }
    }

    if (overlay_enabled_) {
        cv::Scalar low_color(60, 180, 75);
        cv::Scalar med_color(0, 215, 255);
        cv::Scalar high_color(0, 0, 255);
        for (const auto& d : output.dets) {
            const cv::Scalar color = (d.level == DangerLevel::HIGH)
                                         ? high_color
                                         : (d.level == DangerLevel::MEDIUM ? med_color : low_color);
            cv::rectangle(output.frame, d.bbox, color, 2);
            std::string caption = d.label + " " + cv::format("%.2f", d.confidence);
            cv::putText(output.frame, caption, cv::Point(d.bbox.x, std::max(0, d.bbox.y - 6)),
                        cv::FONT_HERSHEY_SIMPLEX, 0.55, color, 2);
        }
        if (output.frame_level == DangerLevel::HIGH) {
            output.frame = overlay_safe(output.frame, "DANGEROUS OBJECT DETECTED", high_color, 0.35);
        }
    }

    return output;
}
#endif

FrameResult InferenceEngine::run_opencv(const FrameResult& input) {
    FrameResult output = input;
    output.dets.clear();

    cv::Mat frame = input.frame.clone();
    cv::Mat blob = cv::dnn::blobFromImage(frame, 1.0 / 255.0, cv::Size(input_size_, input_size_),
                                          cv::Scalar(), true, false);
    net_.setInput(blob);
    cv::Mat pred = net_.forward();

    int rows = 0;
    int dims = 0;
    bool channel_first = false;
    if (pred.dims == 3) {
        rows = pred.size[1];
        dims = pred.size[2];
        if (pred.size[2] > pred.size[1]) {
            rows = pred.size[2];
            dims = pred.size[1];
            channel_first = true;
        }
    } else if (pred.dims == 2) {
        rows = pred.size[0];
        dims = pred.size[1];
    } else {
        return input;
    }

    const float* data = reinterpret_cast<float*>(pred.data);
    const int classes = std::max(1, dims - 5);
    const int frame_w = frame.cols;
    const int frame_h = frame.rows;
    const float scale_x = static_cast<float>(frame_w) / static_cast<float>(input_size_);
    const float scale_y = static_cast<float>(frame_h) / static_cast<float>(input_size_);

    for (int i = 0; i < rows; ++i) {
        const float* ptr = channel_first ? (data + i) : (data + i * dims);
        auto item = [&](int idx) -> float {
            return channel_first ? ptr[idx * rows] : ptr[idx];
        };

        float cx = item(0);
        float cy = item(1);
        float w = item(2);
        float h = item(3);

        int best_cls = -1;
        float best_score = 0.0f;

        const float objectness = (dims >= classes + 5) ? item(4) : 1.0f;
        int class_start = (dims >= classes + 5) ? 5 : 4;
        for (int c = 0; c < classes && class_start + c < dims; ++c) {
            float cls_score = item(class_start + c);
            float conf = objectness * cls_score;
            if (conf > best_score) {
                best_score = conf;
                best_cls = c;
            }
        }

        if (best_score < conf_threshold_) continue;

        const float x0 = (cx - 0.5f * w) * scale_x;
        const float y0 = (cy - 0.5f * h) * scale_y;
        const float x1 = (cx + 0.5f * w) * scale_x;
        const float y1 = (cy + 0.5f * h) * scale_y;
        cv::Rect box(static_cast<int>(x0), static_cast<int>(y0),
                     static_cast<int>(x1 - x0), static_cast<int>(y1 - y0));

        std::string label = (best_cls >= 0 && best_cls < static_cast<int>(class_names_.size()))
                                ? class_names_[best_cls]
                                : ("cls_" + std::to_string(best_cls));

        DangerLevel level = level_for_label(label);
        output.dets.push_back(Detection{label, best_score, box, level});
    }

    output.frame_level = DangerLevel::LOW;
    for (const auto& d : output.dets) {
        if (d.level == DangerLevel::HIGH) {
            output.frame_level = DangerLevel::HIGH;
            break;
        }
        if (d.level == DangerLevel::MEDIUM) {
            output.frame_level = DangerLevel::MEDIUM;
        }
    }

    if (overlay_enabled_) {
        cv::Scalar low_color(60, 180, 75);
        cv::Scalar med_color(0, 215, 255);
        cv::Scalar high_color(0, 0, 255);
        for (const auto& d : output.dets) {
            const cv::Scalar color = (d.level == DangerLevel::HIGH)
                                         ? high_color
                                         : (d.level == DangerLevel::MEDIUM ? med_color : low_color);
            cv::rectangle(frame, d.bbox, color, 2);
            std::string caption = d.label + " " + cv::format("%.2f", d.confidence);
            cv::putText(frame, caption, cv::Point(d.bbox.x, std::max(0, d.bbox.y - 6)),
                        cv::FONT_HERSHEY_SIMPLEX, 0.55, color, 2);
        }

        if (output.frame_level == DangerLevel::HIGH) {
            frame = overlay_safe(frame, "DANGEROUS OBJECT DETECTED", high_color, 0.35);
        }
    }

    output.frame = frame;
    return output;
}

}  // namespace edge
