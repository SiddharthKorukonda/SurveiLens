#define _CRT_SECURE_NO_WARNINGS
#include "config.hpp"

#include <cstdlib>
#include <cstring>
#include <iostream>

namespace edge {

static bool arg_eq(const char* a, const char* b) {
    return std::strcmp(a, b) == 0;
}

AppConfig parse_args(int argc, char** argv) {
    AppConfig cfg;

    // Env overrides mirror the old Python defaults
    if (const char* env_src = std::getenv("VIDEO_SOURCE")) cfg.source = env_src;
    if (const char* env_img = std::getenv("IMG_SIZE")) cfg.img_size = std::atoi(env_img);
    if (const char* env_conf = std::getenv("YOLO_CONF")) cfg.conf_threshold = static_cast<float>(std::atof(env_conf));
    if (const char* env_weights = std::getenv("YOLO_WEIGHTS")) cfg.model_path = env_weights;
    if (const char* env_alerts = std::getenv("ALERTS_JSONL")) cfg.alerts_jsonl = env_alerts;
    if (const char* env_fps = std::getenv("FPS")) cfg.target_fps = std::atoi(env_fps);

    for (int i = 1; i < argc; ++i) {
        const char* arg = argv[i];
        auto next = [&](int offset = 1) -> const char* {
            if (i + offset < argc) return argv[i + offset];
            return nullptr;
        };

        if (arg_eq(arg, "--source") && next()) {
            cfg.source = next();
            i++;
        } else if (arg_eq(arg, "--model") && next()) {
            cfg.model_path = next();
            i++;
        } else if (arg_eq(arg, "--class-names") && next()) {
            cfg.class_names_path = next();
            i++;
        } else if (arg_eq(arg, "--img") && next()) {
            cfg.img_size = std::atoi(next());
            i++;
        } else if (arg_eq(arg, "--conf") && next()) {
            cfg.conf_threshold = static_cast<float>(std::atof(next()));
            i++;
        } else if (arg_eq(arg, "--alerts") && next()) {
            cfg.alerts_jsonl = next();
            i++;
        } else if (arg_eq(arg, "--no-overlay")) {
            cfg.overlay_enabled = false;
        } else if (arg_eq(arg, "--no-ort")) {
            cfg.use_ort = false;
        } else if (arg_eq(arg, "--use-ort")) {
            cfg.use_ort = true;
        } else if (arg_eq(arg, "--show-window")) {
            cfg.show_window = true;
        } else if (arg_eq(arg, "--fps") && next()) {
            cfg.target_fps = std::atoi(next());
            i++;
        } else if (arg_eq(arg, "--help")) {
            std::cout << "Usage: edge_node [--source <src>] [--model <onnx>] [--class-names <file>]\n"
                      << "                [--img <size>] [--conf <thresh>] [--alerts <path>]\n"
                      << "                [--no-overlay] [--use-ort|--no-ort] [--show-window] [--fps <int>]\n";
            std::exit(0);
        }
    }

    return cfg;
}

}  // namespace edge
