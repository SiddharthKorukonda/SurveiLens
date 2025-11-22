#include "health.hpp"
#include <atomic>
#include <thread>
#include <netinet/in.h>
#include <unistd.h>
#include <string.h>
#include <iostream>

struct MetricsServer::Impl {
  std::atomic<bool> running{false};
  std::thread th;

  void loop(std::string bind, int port) {
    int server_fd = ::socket(AF_INET, SOCK_STREAM, 0);
    if (server_fd < 0) return;
    int opt = 1; setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));
    sockaddr_in addr{}; addr.sin_family = AF_INET; addr.sin_addr.s_addr = INADDR_ANY; addr.sin_port = htons(port);
    if (::bind(server_fd, (sockaddr*)&addr, sizeof(addr)) < 0) { ::close(server_fd); return; }
    ::listen(server_fd, 8);
    while (running.load()) {
      int cfd = ::accept(server_fd, nullptr, nullptr);
      if (cfd < 0) continue;
      const char* body =
        "# TYPE surveilens_up gauge\n"
        "surveilens_up 1\n";
      std::string resp = "HTTP/1.1 200 OK\r\nContent-Type: text/plain; version=0.0.4\r\nContent-Length: "
        + std::to_string(strlen(body)) + "\r\n\r\n" + body;
      ::send(cfd, resp.data(), resp.size(), 0);
      ::close(cfd);
    }
    ::close(server_fd);
  }
};

MetricsServer::MetricsServer():d_(new Impl){}
MetricsServer::~MetricsServer(){ stop(); delete d_; }
void MetricsServer::start(const std::string& bind, int port){
  if (d_->running.exchange(true)) return;
  d_->th = std::thread([this, bind, port]{ d_->loop(bind, port); });
}
void MetricsServer::stop(){
  if (!d_->running.exchange(false)) return;
  if (d_->th.joinable()) d_->th.join();
}
