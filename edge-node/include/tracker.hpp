#pragma once

#include "frame_types.hpp"

namespace edge {

// Placeholder tracker; extend with SORT/DeepSORT as needed.
class Tracker {
public:
    FrameResult update(const FrameResult& in) { return in; }
};

}  // namespace edge
