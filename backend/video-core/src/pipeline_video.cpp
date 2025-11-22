#include "pipeline_video.hpp"
#include "postprocess.hpp"
#include "events.hpp"

#include <atomic>
#include <thread>
#include <memory>
#include <opencv2/opencv.hpp>
#include <chrono>
#include <iostream>

using namespace std::chrono_literals;

struct VideoPipeline::Impl {
  core::CameraParams params;
  std::atomic<bool> running{false};
  std::thread th;
  PostProcessor post;
  EventStreamer events;

  std::atomic<float> obj_thresh{0.25f};
  std::atomic<float> act_thresh{0.25f};
  std::atomic<float> risk_med{0.60f};
  std::atomic<float> risk_high{0.80f};

  Impl(const core::CameraParams& p)
  : params(p), post(p), events(p) {}

  void loop() {
    std::string gst = "rtspsrc location=" + params.rtsp_url +
      " latency=200 ! rtph264depay ! avdec_h264 ! videoconvert ! appsink drop=true sync=false";

    cv::VideoCapture cap(gst, cv::CAP_GSTREAMER);
    if (!cap.isOpened()) {
      std::cerr << "[video] failed to open RTSP via GStreamer: " << params.rtsp_url << std::endl;
      return;
    }

    uint64_t frame_id = 0;

    while (running.load()) {
      cv::Mat frame;
      if (!cap.read(frame)) {
        std::this_thread::sleep_for(10ms);
        continue;
      }
      frame_id++;

      auto res = post.process_frame(frame, frame_id,
                                    obj_thresh.load(), act_thresh.load(),
                                    risk_med.load(), risk_high.load());
      events.push(res);
    }
  }
};

VideoPipeline::VideoPipeline(const core::CameraParams& p) : d_(new Impl(p)) {}
VideoPipeline::~VideoPipeline(){ stop(); delete d_; }

void VideoPipeline::start() {
  if (d_->running.exchange(true)) return;
  d_->th = std::thread([this]{ d_->loop(); });
}

void VideoPipeline::stop() {
  if (!d_->running.exchange(false)) return;
  if (d_->th.joinable()) d_->th.join();
}

void VideoPipeline::update_params(const core::Thresholds& th,
                                  const std::vector<std::string>& zones,
                                  const std::vector<std::string>& keywords) {
  d_->obj_thresh.store(th.obj_conf);
  d_->act_thresh.store(th.act_conf);
  d_->risk_med.store(th.risk_medium);
  d_->risk_high.store(th.risk_high);
  d_->post.update_policy(zones, keywords);
}
