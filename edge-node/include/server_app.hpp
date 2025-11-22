#pragma once

#include <atomic>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <unordered_map>
#include <vector>

#include <opencv2/core.hpp>

#include "config.hpp"
#include "frame_buffer.hpp"
#include "frame_types.hpp"
#include "inference_engine.hpp"
#include "rtsp_streamer.hpp"
#include "tracker.hpp"
#include "event_publisher.hpp"

#include "httplib.h"

#ifdef USE_LIBDATACHANNEL
#include <rtc/rtc.hpp>
#endif

namespace edge {

struct PipelineStatus {
    bool running{false};
    double uptime_sec{0.0};
    int pid{0};
    AppConfig args{};
};

class ServerApp {
public:
    explicit ServerApp(const AppConfig& cfg);
    ~ServerApp();

    void start();
    void stop();
    void join();

private:
    void run_http();
    void start_pipeline(const std::string& source, const std::string& weights, float conf);
    void stop_pipeline();
    PipelineStatus status() const;

    void setup_routes();
    void serve_static(httplib::Server& srv);

#ifdef USE_LIBDATACHANNEL
    struct Room {
        std::shared_ptr<rtc::PeerConnection> pc;
        std::shared_ptr<rtc::Track> track;
    };
    std::mutex rooms_mu_;
    std::unordered_map<std::string, Room> rooms_;
    void broadcast_frame(const cv::Mat& frame);
    std::shared_ptr<rtc::PeerConnection> create_publisher(const std::string& room);
#endif

    AppConfig cfg_;
    std::atomic<bool> http_running_{false};
    std::thread http_thread_;
    std::unique_ptr<httplib::Server> http_srv_;

    std::mutex pipeline_mu_;
    bool pipe_running_{false};
    double pipe_started_{0.0};
    std::unique_ptr<RtspStreamer> streamer_;
    std::unique_ptr<InferenceEngine> infer_;
    std::unique_ptr<Tracker> tracker_;
    std::unique_ptr<EventPublisher> publisher_;
    std::unique_ptr<std::thread> worker_;
    std::unique_ptr<FrameBuffer<FrameResult>> buf_;
};

}  // namespace edge
