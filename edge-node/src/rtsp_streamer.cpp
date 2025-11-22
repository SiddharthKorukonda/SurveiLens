#include "rtsp_streamer.hpp"

#include <chrono>
#include <iostream>

namespace edge {

RtspStreamer::RtspStreamer(const std::string& source, FrameBuffer<FrameResult>& buffer, int target_fps)
    : source_(source), buffer_(buffer), target_fps_(target_fps) {}

RtspStreamer::~RtspStreamer() {
    stop();
}

void RtspStreamer::start() {
    if (running_) return;
    running_ = true;
    worker_ = std::thread(&RtspStreamer::run, this);
}

void RtspStreamer::stop() {
    if (!running_) return;
    running_ = false;
    buffer_.stop();
    if (worker_.joinable()) worker_.join();
}

void RtspStreamer::run() {
    cv::VideoCapture cap;

    // Allow numeric index or URL
    try {
        int idx = std::stoi(source_);
        cap.open(idx);
    } catch (...) {
        cap.open(source_);
    }

    if (!cap.isOpened()) {
        std::cerr << "[ERROR] Unable to open video source: " << source_ << std::endl;
        running_ = false;
        buffer_.stop();
        return;
    }

    if (target_fps_ > 0) {
        cap.set(cv::CAP_PROP_FPS, target_fps_);
    }

    const double sleep_ms = target_fps_ > 0 ? 1000.0 / target_fps_ : 0.0;

    while (running_) {
        cv::Mat frame;
        if (!cap.read(frame) || frame.empty()) {
            std::cerr << "[WARN] Capture read failed, retrying..." << std::endl;
            std::this_thread::sleep_for(std::chrono::milliseconds(100));
            continue;
        }

        FrameResult res;
        res.frame = frame;
        res.timestamp_sec = static_cast<double>(cv::getTickCount()) / cv::getTickFrequency();
        buffer_.push(res);

        if (sleep_ms > 0.0) {
            std::this_thread::sleep_for(std::chrono::milliseconds(static_cast<int>(sleep_ms)));
        }
    }

    cap.release();
    buffer_.stop();
}

}  // namespace edge
