#include "events.hpp"
#include "pipeline.grpc.pb.h"

#include <grpcpp/grpcpp.h>
#include <chrono>
#include <ctime>
#include <iostream>

using surveilens::Pipeline;
using surveilens::Event;
using surveilens::Obj;
using surveilens::Act;
using surveilens::Aud;
using surveilens::AudioFrame;
using surveilens::Ack;

namespace {
std::string env_or(const char* k, const char* def) {
  const char* v = std::getenv(k); return v ? std::string(v) : std::string(def);
}
std::string now_iso() {
  using namespace std::chrono;
  auto now = system_clock::now();
  std::time_t t = system_clock::to_time_t(now);
  std::tm tm = *gmtime(&t);
  char buf[64];
  std::strftime(buf, sizeof(buf), "%FT%TZ", &tm);
  return std::string(buf);
}
}

struct EventStreamer::Impl {
  std::string site;
  std::string cam;
  std::unique_ptr<Pipeline::Stub> stub_events;
  std::unique_ptr<grpc::ClientWriter<Event>> writer_events;
  std::unique_ptr<grpc::ClientWriter<AudioFrame>> writer_audio;
  std::unique_ptr<grpc::ClientContext> ctx_events;
  std::unique_ptr<grpc::ClientContext> ctx_audio;
  Ack ack;

  Impl(const core::CameraParams& p) : site(p.site_id), cam(p.camera_id) {
    const std::string rust_addr = env_or("RUST_CONTROL_PLANE", "localhost:50052");
    auto chan = grpc::CreateChannel(rust_addr, grpc::InsecureChannelCredentials());
    stub_events = Pipeline::NewStub(chan);

    ctx_events = std::make_unique<grpc::ClientContext>();
    writer_events = stub_events->StreamEvents(ctx_events.get(), &ack);

    ctx_audio = std::make_unique<grpc::ClientContext>();
    writer_audio = stub_events->StreamAudio(ctx_audio.get(), &ack);
  }

  ~Impl() {
    if (writer_events) writer_events->WritesDone();
    if (writer_audio)  writer_audio->WritesDone();
  }
};

EventStreamer::EventStreamer(const core::CameraParams& p) : d_(new Impl(p)) {}
EventStreamer::~EventStreamer(){ delete d_; }

void EventStreamer::push(const FrameEvent& fev) {
  Event ev;
  ev.set_ts_iso(fev.ts_iso);
  ev.set_site_id(fev.site_id);
  ev.set_camera_id(fev.camera_id);
  ev.set_risk_local(fev.risk_local);
  ev.set_level_local(fev.level_local);
  ev.set_frame_id(fev.frame_id);
  for (auto& o : fev.objects) { auto* x = ev.add_objects(); x->set_name(o.name); x->set_conf(o.conf); }
  for (auto& a : fev.actions) { auto* x = ev.add_actions(); x->set_name(a.name); x->set_conf(a.conf); }
  for (auto& z : fev.zones)   { ev.add_zones(z); }
  for (auto& f : fev.audio_flags) { auto* x = ev.add_audio_flags(); x->set_name(f.name); x->set_conf(f.conf); }
  d_->writer_events->Write(ev);
}

void EventStreamer::push_pcm(const std::string& ts_iso,
                             const std::string& site_id,
                             const std::string& camera_id,
                             const std::string& pcm16,
                             uint32_t sample_rate) {
  AudioFrame af;
  af.set_ts_iso(ts_iso.empty() ? now_iso() : ts_iso);
  af.set_site_id(site_id.empty() ? d_->site : site_id);
  af.set_camera_id(camera_id.empty() ? d_->cam : camera_id);
  af.set_pcm16(pcm16);
  af.set_sample_rate(sample_rate);
  d_->writer_audio->Write(af);
}

std::string EventStreamer::now_iso_utc(){ return now_iso(); }
