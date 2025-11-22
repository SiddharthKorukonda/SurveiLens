#pragma once

#include <atomic>
#include <string>
#include <thread>
#include <opencv2/opencv.hpp>
#include "frame_buffer.hpp"
#include "frame_types.hpp"

namespace edge {

class RtspStreamer {
public:
    RtspStreamer(const std::string& source, FrameBuffer<FrameResult>& buffer, int target_fps);
    ~RtspStreamer();

    void start();
    void stop();

private:
    void run();

    std::string source_;
    FrameBuffer<FrameResult>& buffer_;
    int target_fps_{30};
    std::thread worker_;
    std::atomic<bool> running_{false};
};

}  // namespace edge
