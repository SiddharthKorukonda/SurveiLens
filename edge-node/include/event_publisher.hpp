#pragma once

#include <fstream>
#include <mutex>
#include <string>
#include "frame_types.hpp"

namespace edge {

class EventPublisher {
public:
    explicit EventPublisher(const std::string& path);
    void publish(const FrameResult& result);

private:
    std::string path_;
    std::mutex mu_;
};

}  // namespace edge
