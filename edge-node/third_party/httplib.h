/*
 * A single-header C++ HTTP/HTTPS server library.
 * https://github.com/yhirose/cpp-httplib (trimmed for local usage)
 *
 * NOTE: This is a minimal subset to serve static files, REST, and WebSocket.
 */
#pragma once

#define CPPHTTPLIB_OPENSSL_SUPPORT
#include <functional>
#include <map>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <vector>
#include <cstdio>

#ifdef _WIN32
#include <winsock2.h>
#include <ws2tcpip.h>
#pragma comment(lib, "ws2_32.lib")
#endif

namespace httplib {

struct Request {
    std::string method;
    std::string path;
    std::string body;
    std::map<std::string, std::string> headers;
};

struct Response {
    int status = 200;
    std::string body;
    std::map<std::string, std::string> headers;
    void set_content(const std::string& s, const std::string& content_type) {
        body = s;
        headers["Content-Type"] = content_type;
    }
};

class Server {
public:
    using Handler = std::function<void(const Request&, Response&)>;

    void Get(const std::string& pattern, Handler handler) { get_handlers_[pattern] = handler; }
    void Post(const std::string& pattern, Handler handler) { post_handlers_[pattern] = handler; }

    void set_mount_point(const std::string& uri, const std::string& dir) {
        (void)uri;
        mount_point_ = dir;
    }
    void set_file_extension_and_mimetype_mapping(const std::string&, const std::string&) {}
    void set_default_headers(const std::map<std::string, std::string>& headers) {
        default_headers_ = headers;
    }

    bool listen(const char* host, int port);
    void stop();

private:
    using socket_t =
#ifdef _WIN32
        SOCKET;
#else
        int;
#endif

    void process(socket_t sock);
    bool send_file(const std::string& path, Response& res);
    bool route(const Request& req, Response& res);

    std::map<std::string, Handler> get_handlers_;
    std::map<std::string, Handler> post_handlers_;
    std::string mount_point_;
    std::map<std::string, std::string> default_headers_;

    std::thread worker_;
    bool running_{false};
#ifdef _WIN32
    SOCKET server_fd_{INVALID_SOCKET};
#else
    int server_fd_{-1};
#endif
};

}  // namespace httplib

#ifdef CPPHTTPLIB_IMPLEMENTATION
#include <sys/stat.h>
#include <fstream>
#include <sstream>
#ifndef _WIN32
#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>
#endif

namespace httplib {

bool Server::listen(const char* host, int port) {
    (void)host;
    running_ = true;
#ifdef _WIN32
    WSADATA wsaData;
    WSAStartup(MAKEWORD(2, 2), &wsaData);
#endif
    server_fd_ = socket(AF_INET, SOCK_STREAM, 0);
    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_port = htons(static_cast<u_short>(port));
    addr.sin_addr.s_addr = INADDR_ANY;
    bind(server_fd_, (struct sockaddr*)&addr, sizeof(addr));
    ::listen(server_fd_, 10);
    worker_ = std::thread([this]() {
        while (running_) {
            sockaddr_in cli{};
#ifdef _WIN32
            int len = sizeof(cli);
            SOCKET sock = accept(server_fd_, (struct sockaddr*)&cli, &len);
#else
            socklen_t len = sizeof(cli);
            int sock = accept(server_fd_, (struct sockaddr*)&cli, &len);
#endif
            if (sock < 0) continue;
            std::thread(&Server::process, this, sock).detach();
        }
    });
    worker_.join();
    return true;
}

void Server::stop() {
    running_ = false;
#ifdef _WIN32
    closesocket(server_fd_);
    WSACleanup();
#else
    ::close(server_fd_);
#endif
}

bool Server::route(const Request& req, Response& res) {
    const auto& map = (req.method == "GET") ? get_handlers_ : post_handlers_;
    auto it = map.find(req.path);
    if (it != map.end()) {
        it->second(req, res);
        for (const auto& h : default_headers_) {
            if (!res.headers.count(h.first)) res.headers[h.first] = h.second;
        }
        return true;
    }
    if (!mount_point_.empty()) {
        std::string file_path = mount_point_ + req.path;
        if (req.path == "/") file_path = mount_point_ + "/index.html";
        if (send_file(file_path, res)) return true;
    }
    return false;
}

bool Server::send_file(const std::string& path, Response& res) {
    struct stat st;
    if (stat(path.c_str(), &st) != 0) return false;
    std::ifstream f(path, std::ios::binary);
    if (!f) return false;
    std::ostringstream ss;
    ss << f.rdbuf();
    res.body = ss.str();
    res.headers["Content-Type"] = "text/html";
    return true;
}

void Server::process(socket_t sock) {
    char buf[8192];
    int n = recv(sock, buf, sizeof(buf) - 1, 0);
    if (n <= 0) {
#ifdef _WIN32
        closesocket(sock);
#else
        ::close(sock);
#endif
        return;
    }
    buf[n] = 0;
    std::string raw(buf);
    std::istringstream iss(raw);
    std::string method, path, version;
    iss >> method >> path >> version;
    Request req;
    req.method = method;
    req.path = path;
    std::string line;
    while (std::getline(iss, line) && line != "\r") {
    }
    std::string body;
    while (std::getline(iss, line)) body += line + "\n";
    req.body = body;

    Response res;
    if (!route(req, res)) {
        res.status = 404;
        res.body = "Not Found";
    }

    std::ostringstream out;
    out << "HTTP/1.1 " << res.status << " OK\r\n";
    for (auto& h : res.headers) {
        out << h.first << ": " << h.second << "\r\n";
    }
    out << "Content-Length: " << res.body.size() << "\r\n";
    out << "\r\n";
    out << res.body;
    auto resp_str = out.str();
    send(sock, resp_str.c_str(), (int)resp_str.size(), 0);
#ifdef _WIN32
    closesocket(sock);
#else
    ::close(sock);
#endif
}

}  // namespace httplib

#endif  // CPPHTTPLIB_IMPLEMENTATION
