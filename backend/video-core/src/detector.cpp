#include "detector.hpp"
#include <opencv2/imgproc.hpp>
#include <cstdlib>
#include <iostream>

static std::string guess_haar_path() {
    const char* envp = std::getenv("OPENCV_HAAR");
    if (envp && *envp) return std::string(envp);

    // Homebrew typical path:
    // /opt/homebrew/opt/opencv/share/opencv4/haarcascades/haarcascade_frontalface_default.xml
    return "/opt/homebrew/opt/opencv/share/opencv4/haarcascades/haarcascade_frontalface_default.xml";
}

bool Detector::init() {
    std::string path = guess_haar_path();
    if (!face_.load(path)) {
        std::cerr << "[detector] Failed to load Haar cascade at: " << path
                  << "\nSet OPENCV_HAAR to point to haarcascade_frontalface_default.xml\n";
        ready_ = false;
        return false;
    }
    ready_ = true;
    std::cerr << "[detector] Haar cascade loaded: " << path << "\n";
    return true;
}

std::vector<Detection> Detector::run(const cv::Mat& bgr) {
    std::vector<Detection> out;
    if (!ready_ || bgr.empty()) return out;

    cv::Mat gray;
    cv::cvtColor(bgr, gray, cv::COLOR_BGR2GRAY);
    cv::equalizeHist(gray, gray);

    std::vector<cv::Rect> faces;
    face_.detectMultiScale(gray, faces, 1.1, 3, 0, cv::Size(32, 32));
    out.reserve(faces.size());
    for (const auto& r : faces) {
        out.push_back(Detection{r, 1.0f, "face"});
    }
    return out;
}
