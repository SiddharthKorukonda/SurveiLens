#pragma once
#include <opencv2/core.hpp>
#include <opencv2/objdetect.hpp>
#include <string>
#include <vector>

struct Detection {
    cv::Rect box;
    float score;
    std::string label;
};

class Detector {
public:
    // If OPENCV_HAAR env var is set, we load that. Otherwise we try common brew path.
    bool init();
    std::vector<Detection> run(const cv::Mat& bgr);
    bool ok() const { return ready_; }

private:
    bool ready_ = false;
    cv::CascadeClassifier face_;
};
