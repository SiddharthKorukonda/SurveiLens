#pragma once

#include <condition_variable>
#include <mutex>
#include <queue>
#include "frame_types.hpp"

namespace edge {

// Simple thread-safe bounded queue for frames/results.
template <typename T>
class FrameBuffer {
public:
    explicit FrameBuffer(size_t max_items = 4) : max_items_(max_items) {}

    void push(const T& item) {
        std::unique_lock<std::mutex> lock(mu_);
        cv_full_.wait(lock, [&] { return queue_.size() < max_items_; });
        queue_.push(item);
        lock.unlock();
        cv_empty_.notify_one();
    }

    bool pop(T& out) {
        std::unique_lock<std::mutex> lock(mu_);
        cv_empty_.wait(lock, [&] { return !queue_.empty() || stopped_; });
        if (stopped_ && queue_.empty()) return false;
        out = std::move(queue_.front());
        queue_.pop();
        lock.unlock();
        cv_full_.notify_one();
        return true;
    }

    void stop() {
        {
            std::lock_guard<std::mutex> lock(mu_);
            stopped_ = true;
        }
        cv_empty_.notify_all();
        cv_full_.notify_all();
    }

private:
    size_t max_items_;
    std::queue<T> queue_;
    std::mutex mu_;
    std::condition_variable cv_empty_;
    std::condition_variable cv_full_;
    bool stopped_{false};
};

}  // namespace edge
