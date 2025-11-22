#define CPPHTTPLIB_IMPLEMENTATION
#include "server_app.hpp"

#include <chrono>
#include <filesystem>
#include <fstream>
#include <sstream>
#include <utility>

#include <opencv2/imgcodecs.hpp>
#include <opencv2/imgproc.hpp>

namespace edge {

using namespace std::chrono_literals;

ServerApp::ServerApp(const AppConfig& cfg) : cfg_(cfg) {}

ServerApp::~ServerApp() {
    stop();
}

void ServerApp::start() {
    if (http_running_) return;
    http_running_ = true;
    http_thread_ = std::thread(&ServerApp::run_http, this);
}

void ServerApp::stop() {
    {
        std::lock_guard<std::mutex> lock(pipeline_mu_);
        pipe_running_ = false;
    }
    if (worker_ && worker_->joinable()) worker_->join();
    worker_.reset();
    streamer_.reset();
    infer_.reset();
    tracker_.reset();
    publisher_.reset();
    buf_.reset();

    if (http_srv_) {
        http_srv_->stop();
    }
    if (http_thread_.joinable()) http_thread_.join();
}

void ServerApp::run_http() {
    http_srv_ = std::make_unique<httplib::Server>();
    setup_routes();
    const char* host = "0.0.0.0";
    int port = 8000;
    http_srv_->listen(host, port);
}

void ServerApp::setup_routes() {
    // REST endpoints
    http_srv_->Post("/pipeline/start", [this](const httplib::Request& req, httplib::Response& res) {
        try {
            std::string body = req.body;
            std::string source = cfg_.source;
            std::string weights = cfg_.model_path;
            float conf = cfg_.conf_threshold;
            if (!body.empty()) {
                // naive parse
                if (body.find("\"source\"") != std::string::npos) {
                    auto pos = body.find("\"source\"");
                    auto q = body.find("\"", pos + 8);
                    auto q2 = body.find("\"", q + 1);
                    if (q != std::string::npos && q2 != std::string::npos) {
                        source = body.substr(q + 1, q2 - q - 1);
                    }
                }
                if (body.find("\"yolo_weights\"") != std::string::npos) {
                    auto pos = body.find("\"yolo_weights\"");
                    auto q = body.find("\"", pos + 14);
                    auto q2 = body.find("\"", q + 1);
                    if (q != std::string::npos && q2 != std::string::npos) {
                        weights = body.substr(q + 1, q2 - q - 1);
                    }
                }
                if (body.find("\"conf\"") != std::string::npos) {
                    auto pos = body.find("\"conf\"");
                    auto q = body.find(":", pos);
                    if (q != std::string::npos) {
                        conf = std::stof(body.substr(q + 1));
                    }
                }
            }
            start_pipeline(source, weights, conf);
            auto st = status();
            std::ostringstream oss;
            oss << "{ \"running\": " << (st.running ? "true" : "false")
                << ", \"uptime_sec\": " << st.uptime_sec
                << ", \"pid\": " << st.pid
                << " }";
            res.set_content(oss.str(), "application/json");
        } catch (...) {
            res.status = 500;
        }
    });

    http_srv_->Post("/pipeline/stop", [this](const httplib::Request& req, httplib::Response& res) {
        (void)req;
        stop_pipeline();
        auto st = status();
        std::ostringstream oss;
        oss << "{ \"running\": " << (st.running ? "true" : "false")
            << ", \"uptime_sec\": " << st.uptime_sec
            << ", \"pid\": " << st.pid
            << " }";
        res.set_content(oss.str(), "application/json");
    });

    http_srv_->Get("/pipeline/status", [this](const httplib::Request&, httplib::Response& res) {
        auto st = status();
        std::ostringstream oss;
        oss << "{ \"running\": " << (st.running ? "true" : "false")
            << ", \"uptime_sec\": " << st.uptime_sec
            << ", \"pid\": " << st.pid
            << ", \"args\": {"
            << "\"VIDEO_SOURCE\":\"" << st.args.source << "\","
            << "\"IMG_SIZE\":" << st.args.img_size << ","
            << "\"FPS\":" << st.args.target_fps << ","
            << "\"YOLO_WEIGHTS\":\"" << st.args.model_path << "\","
            << "\"YOLO_CONF\":" << st.args.conf_threshold
            << "}"
            << " }";
        res.set_content(oss.str(), "application/json");
    });

    http_srv_->Get("/alerts", [](const httplib::Request&, httplib::Response& res) {
        std::ifstream f("alerts.jsonl");
        if (!f) {
            res.set_content("[]", "application/json");
            return;
        }
        std::vector<std::string> lines;
        std::string line;
        while (std::getline(f, line)) {
            if (!line.empty()) lines.push_back(line);
        }
        std::ostringstream oss;
        oss << "[";
        for (size_t i = 0; i < lines.size(); ++i) {
            oss << lines[i];
            if (i + 1 < lines.size()) oss << ",";
        }
        oss << "]";
        res.set_content(oss.str(), "application/json");
    });

    serve_static(*http_srv_);
}

void ServerApp::serve_static(httplib::Server& srv) {
    srv.set_mount_point("/", "./public");
    srv.set_file_extension_and_mimetype_mapping("js", "application/javascript");
    srv.set_file_extension_and_mimetype_mapping("css", "text/css");
    srv.set_default_headers({{"Cache-Control", "no-store"}});
}

void ServerApp::start_pipeline(const std::string& source, const std::string& weights, float conf) {
    std::lock_guard<std::mutex> lock(pipeline_mu_);
    if (pipe_running_) return;

    buf_ = std::make_unique<FrameBuffer<FrameResult>>(4);
    streamer_ = std::make_unique<RtspStreamer>(source, *buf_, cfg_.target_fps);
    infer_ = std::make_unique<InferenceEngine>(weights, cfg_.class_names_path, cfg_.img_size, conf, cfg_.overlay_enabled, cfg_.use_ort);
    tracker_ = std::make_unique<Tracker>();
    publisher_ = std::make_unique<EventPublisher>(cfg_.alerts_jsonl);

    pipe_running_ = true;
    pipe_started_ = static_cast<double>(cv::getTickCount()) / cv::getTickFrequency();

    streamer_->start();
    worker_ = std::make_unique<std::thread>([this]() {
        while (pipe_running_) {
            FrameResult item;
            if (!buf_->pop(item)) break;
            auto inf = infer_->run(item);
            auto tracked = tracker_->update(inf);
            publisher_->publish(tracked);
#ifdef USE_LIBDATACHANNEL
            if (tracked.frame_level == DangerLevel::HIGH || tracked.frame_level == DangerLevel::MEDIUM || cfg_.overlay_enabled) {
                broadcast_frame(tracked.frame);
            }
#endif
        }
    });
}

void ServerApp::stop_pipeline() {
    std::lock_guard<std::mutex> lock(pipeline_mu_);
    pipe_running_ = false;
    if (buf_) buf_->stop();
    if (streamer_) streamer_->stop();
    if (worker_ && worker_->joinable()) worker_->join();
    worker_.reset();
    streamer_.reset();
    infer_.reset();
    tracker_.reset();
    publisher_.reset();
    buf_.reset();
}

PipelineStatus ServerApp::status() const {
    PipelineStatus st;
    st.running = pipe_running_;
    if (pipe_running_) {
        double now = static_cast<double>(cv::getTickCount()) / cv::getTickFrequency();
        st.uptime_sec = now - pipe_started_;
    }
    st.pid = static_cast<int>(::GetCurrentProcessId());
    st.args = cfg_;
    return st;
}

#ifdef USE_LIBDATACHANNEL
std::shared_ptr<rtc::PeerConnection> ServerApp::create_publisher(const std::string& room) {
    rtc::Configuration cfg;
    cfg.iceServers.emplace_back("stun:stun.l.google.com:19302");
    auto pc = std::make_shared<rtc::PeerConnection>(cfg);
    auto video = std::make_shared<rtc::Track>(rtc::Description::Video("video", rtc::Description::Direction::SendOnly));
    pc->addTrack(video);

    Room r;
    r.pc = pc;
    r.track = video;

    {
        std::lock_guard<std::mutex> lock(rooms_mu_);
        rooms_[room] = r;
    }

    pc->onStateChange([this, room](rtc::PeerConnection::State state) {
        if (state == rtc::PeerConnection::State::Closed || state == rtc::PeerConnection::State::Failed || state == rtc::PeerConnection::State::Disconnected) {
            std::lock_guard<std::mutex> lock(rooms_mu_);
            rooms_.erase(room);
        }
    });

    return pc;
}

void ServerApp::broadcast_frame(const cv::Mat& frame) {
    std::lock_guard<std::mutex> lock(rooms_mu_);
    for (auto& kv : rooms_) {
        auto& track = kv.second.track;
        if (!track) continue;
        cv::Mat rgb;
        cv::cvtColor(frame, rgb, cv::COLOR_BGR2RGB);
        rtc::binary data(rgb.total() * rgb.elemSize());
        std::memcpy(data.data(), rgb.data, data.size());
        track->send(rtc::Frame(rgb.cols, rgb.rows, data));
    }
}
#endif

}  // namespace edge
