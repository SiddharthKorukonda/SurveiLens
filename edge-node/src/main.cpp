#include <chrono>
#include <iostream>
#include <thread>

#include <opencv2/opencv.hpp>

#include "config.hpp"
#include "event_publisher.hpp"
#include "frame_buffer.hpp"
#include "inference_engine.hpp"
#include "rtsp_streamer.hpp"
#include "tracker.hpp"

using namespace std::chrono_literals;

int main(int argc, char** argv) {
    edge::AppConfig cfg = edge::parse_args(argc, argv);

    std::cout << "[INFO] Starting edge-node C++ pipeline\n";
    std::cout << "       source: " << cfg.source << "\n";
    std::cout << "       model : " << cfg.model_path << "\n";
    std::cout << "       alerts: " << cfg.alerts_jsonl << "\n";
    std::cout << "       ORT   : " << (cfg.use_ort ? "enabled" : "disabled (OpenCV DNN fallback)") << "\n";

    edge::FrameBuffer<edge::FrameResult> capture_buf(4);
    edge::RtspStreamer streamer(cfg.source, capture_buf, cfg.target_fps);
    streamer.start();

    edge::InferenceEngine infer(cfg.model_path, cfg.class_names_path, cfg.img_size, cfg.conf_threshold, cfg.overlay_enabled, cfg.use_ort);
    edge::Tracker tracker;
    edge::EventPublisher publisher(cfg.alerts_jsonl);

    bool running = true;
    double fps = 0.0;
    int frames = 0;
    auto t0 = std::chrono::steady_clock::now();

    while (running) {
        edge::FrameResult item;
        if (!capture_buf.pop(item)) break;  // capture stopped

        edge::FrameResult inferred = infer.run(item);
        edge::FrameResult tracked = tracker.update(inferred);
        publisher.publish(tracked);

        frames++;
        auto now = std::chrono::steady_clock::now();
        double elapsed = std::chrono::duration<double>(now - t0).count();
        if (elapsed >= 1.0) {
            fps = frames / elapsed;
            frames = 0;
            t0 = now;
        }

        if (cfg.show_window) {
            cv::Mat view = tracked.frame.empty() ? item.frame : tracked.frame;
            if (!view.empty()) {
                std::string status = cv::format("FPS: %.1f | Danger: %s",
                                                fps, edge::danger_level_to_string(tracked.frame_level).c_str());
                cv::putText(view, status, cv::Point(12, view.rows - 12),
                            cv::FONT_HERSHEY_SIMPLEX, 0.7, cv::Scalar(255, 255, 255), 2);
                cv::imshow("Edge Node Stream", view);
                int key = cv::waitKey(1);
                if (key == 'q' || key == 27) {
                    running = false;
                }
            }
        }
    }

    streamer.stop();
    capture_buf.stop();
    std::this_thread::sleep_for(50ms);
    cv::destroyAllWindows();
    std::cout << "[INFO] Stopped edge-node pipeline\n";
    return 0;
}
