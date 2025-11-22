#include "config.hpp"
#include "server_app.hpp"

#include <iostream>
#include <thread>

int main(int argc, char** argv) {
    edge::AppConfig cfg = edge::parse_args(argc, argv);
    std::cout << "[INFO] Starting C++ server (HTTP + WebRTC + inference)\n";
    edge::ServerApp app(cfg);
    app.start();
    std::cout << "[INFO] Listening on http://0.0.0.0:8000\n";
    std::cout << "[INFO] Press Ctrl+C to exit\n";
    std::this_thread::sleep_for(std::chrono::hours(24));
    return 0;
}
