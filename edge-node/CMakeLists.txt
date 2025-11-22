# Simple CMake setup for the edge-node C++ pipeline
cmake_minimum_required(VERSION 3.16)
project(edge_node LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

option(USE_ONNXRUNTIME "Enable ONNX Runtime for inference" ON)
option(USE_LIBDATACHANNEL "Enable WebRTC streaming via libdatachannel" OFF)

find_package(OpenCV REQUIRED)

add_executable(edge_node
    src/config.cpp
    src/frame_buffer.cpp
    src/rtsp_streamer.cpp
    src/inference_engine.cpp
    src/tracker.cpp
    src/event_publisher.cpp
    src/server_app.cpp
    src/server_main.cpp
)

target_include_directories(edge_node
    PRIVATE
        ${OpenCV_INCLUDE_DIRS}
        ${CMAKE_CURRENT_SOURCE_DIR}/include
        ${CMAKE_CURRENT_SOURCE_DIR}/third_party
)

if(USE_ONNXRUNTIME)
    set(DEFAULT_ORT_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/third_party/onnxruntime/onnxruntime-win-x64-1.19.2")
    set(ONNXRUNTIME_ROOT "${DEFAULT_ORT_ROOT}" CACHE PATH "Path to ONNX Runtime install (root containing include/lib)")
    if(EXISTS "${ONNXRUNTIME_ROOT}")
        message(STATUS "Using ONNX Runtime from ${ONNXRUNTIME_ROOT}")
        target_include_directories(edge_node PRIVATE ${ONNXRUNTIME_ROOT}/include)
        target_link_directories(edge_node PRIVATE ${ONNXRUNTIME_ROOT}/lib)
        target_link_libraries(edge_node PRIVATE onnxruntime onnxruntime_providers_shared)
        target_compile_definitions(edge_node PRIVATE USE_ONNXRUNTIME)
        if(WIN32)
            add_custom_command(TARGET edge_node POST_BUILD
                COMMAND ${CMAKE_COMMAND} -E copy_if_different
                ${ONNXRUNTIME_ROOT}/lib/onnxruntime.dll
                ${ONNXRUNTIME_ROOT}/lib/onnxruntime_providers_shared.dll
                $<TARGET_FILE_DIR:edge_node>)
        endif()
    else()
        message(WARNING "ONNXRUNTIME_ROOT not found; falling back to OpenCV DNN.")
    endif()
endif()

target_link_libraries(edge_node
    PRIVATE
        ${OpenCV_LIBS}
)

if(USE_LIBDATACHANNEL)
    find_package(Threads REQUIRED)
    find_package(LibDataChannel CONFIG QUIET)
    if(LibDataChannel_FOUND)
        target_link_libraries(edge_node PRIVATE LibDataChannel::LibDataChannel Threads::Threads)
        target_compile_definitions(edge_node PRIVATE USE_LIBDATACHANNEL)
    else()
        message(WARNING "libdatachannel (LibDataChannel::LibDataChannel) not found; WebRTC streaming will be disabled.")
    endif()
endif()

# Treat warnings as errors when building locally; users can disable with -DWERROR=OFF
option(WERROR "Enable -Werror" ON)
if(WERROR)
    if(MSVC)
        target_compile_options(edge_node PRIVATE /W4 /WX)
    else()
        target_compile_options(edge_node PRIVATE -Wall -Wextra -Werror)
    endif()
endif()
