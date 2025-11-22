#include "pipeline_audio.hpp"
#include "events.hpp"
#include <atomic>
#include <thread>
#include <chrono>
#include <iostream>

using namespace std::chrono_literals;

struct AudioPipeline::Impl {
  core::CameraParams params;
  std::atomic<bool> running{false};
  std::thread th;
  EventStreamer events;

  std::atomic<float> risk_med{0.60f};
  std::atomic<float> risk_high{0.80f};

  Impl(const core::CameraParams& p)
  : params(p), events(p) {}

  void loop() {
    while (running.load()) {
      std::string ts_iso = events.now_iso_utc();
      events.push_pcm(ts_iso, std::string(), std::string(), /*pcm*/{}, 16000);
      std::this_thread::sleep_for(100ms);
    }
  }
};

AudioPipeline::AudioPipeline(const core::CameraParams& p) : d_(new Impl(p)) {}
AudioPipeline::~AudioPipeline(){ stop(); delete d_; }

void AudioPipeline::start(){
  if (d_->running.exchange(true)) return;
  d_->th = std::thread([this]{ d_->loop(); });
}

void AudioPipeline::stop(){
  if (!d_->running.exchange(false)) return;
  if (d_->th.joinable()) d_->th.join();
}

void AudioPipeline::update_params(const core::Thresholds& th,
                                  const std::vector<std::string>& zones,
                                  const std::vector<std::string>& keywords){
  d_->risk_med.store(th.risk_medium);
  d_->risk_high.store(th.risk_high);
}
