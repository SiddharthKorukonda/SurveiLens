cmake_minimum_required(VERSION 3.20)
project(surveilens_video_core LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# -------------------- Deps --------------------
find_package(Threads REQUIRED)
find_package(ZLIB REQUIRED)
find_package(OpenCV REQUIRED COMPONENTS core imgproc videoio objdetect)

set(CMAKE_FIND_PACKAGE_PREFER_CONFIG ON)
find_package(Protobuf REQUIRED)
find_package(gRPC REQUIRED)

# Force Homebrew protoc and grpc plugin (avoid Anaconda)
find_program(BREW_PROTOC NAMES protoc
  PATHS /opt/homebrew/bin /usr/local/bin
  NO_DEFAULT_PATH)
if(NOT BREW_PROTOC)
  message(FATAL_ERROR "Homebrew protoc not found. Run: brew install protobuf")
endif()
set(Protobuf_PROTOC_EXECUTABLE "${BREW_PROTOC}" CACHE FILEPATH "protoc to use" FORCE)

find_program(GRPC_CPP_PLUGIN NAMES grpc_cpp_plugin
  PATHS /opt/homebrew/bin /usr/local/bin
  NO_DEFAULT_PATH)
if(NOT GRPC_CPP_PLUGIN)
  message(FATAL_ERROR "grpc_cpp_plugin not found. Run: brew install grpc")
endif()

message(STATUS "Protobuf version: ${Protobuf_VERSION}")
message(STATUS "Using protoc: ${Protobuf_PROTOC_EXECUTABLE}")
message(STATUS "grpc_cpp_plugin: ${GRPC_CPP_PLUGIN}")

# -------------------- Paths --------------------
set(PROTO_DIR ${CMAKE_CURRENT_LIST_DIR}/../control-plane/proto)
set(PROTO_FILE ${PROTO_DIR}/pipeline.proto)
if(NOT EXISTS "${PROTO_FILE}")
  message(FATAL_ERROR "pipeline.proto not found at: ${PROTO_FILE}")
endif()

set(GEN_DIR   ${CMAKE_BINARY_DIR}/generated)
file(MAKE_DIRECTORY ${GEN_DIR})

# -------------------- Codegen --------------------
add_custom_command(
  OUTPUT
    ${GEN_DIR}/pipeline.pb.cc
    ${GEN_DIR}/pipeline.pb.h
    ${GEN_DIR}/pipeline.grpc.pb.cc
    ${GEN_DIR}/pipeline.grpc.pb.h
  COMMAND ${CMAKE_COMMAND} -E make_directory ${GEN_DIR}
  COMMAND ${Protobuf_PROTOC_EXECUTABLE}
          --proto_path=${PROTO_DIR}
          --cpp_out=${GEN_DIR}
          --grpc_out=${GEN_DIR}
          --plugin=protoc-gen-grpc=${GRPC_CPP_PLUGIN}
          ${PROTO_FILE}
  DEPENDS ${PROTO_FILE}
  COMMENT "Generating C++ sources from ${PROTO_FILE}"
  VERBATIM
)

add_library(pipeline_proto STATIC
  ${GEN_DIR}/pipeline.pb.cc
  ${GEN_DIR}/pipeline.grpc.pb.cc
)
target_include_directories(pipeline_proto PUBLIC ${GEN_DIR})
target_link_libraries(pipeline_proto PUBLIC gRPC::grpc++ protobuf::libprotobuf Threads::Threads ZLIB::ZLIB)

# -------------------- service_alias.h from .proto --------------------
# Write a tiny CMake script into the build dir that parses 'service <Name> {'
file(CONFIGURE
  OUTPUT  "${CMAKE_BINARY_DIR}/extract_service_from_proto.cmake"
  CONTENT
"if(NOT DEFINED INPUT OR NOT DEFINED OUTPUT)
  message(FATAL_ERROR \"extract_service_from_proto.cmake: need -DINPUT and -DOUTPUT\")
endif()
file(READ \"\${INPUT}\" CONTENTS)
# match first 'service <Name> {'
string(REGEX MATCH \"service[ \\t\\r\\n]+([A-Za-z0-9_]+)[ \\t\\r\\n]*\\{\" MATCH \"\${CONTENTS}\")
if(NOT MATCH)
  message(FATAL_ERROR \"Could not find 'service <Name> {' in \${INPUT}\")
endif()
string(REGEX REPLACE \"service[ \\t\\r\\n]+([A-Za-z0-9_]+)[ \\t\\r\\n]*\\{\" \"\\\\1\" SVC \"\${MATCH}\")
file(WRITE \"\${OUTPUT}\" \"#pragma once\\n\")
file(APPEND \"\${OUTPUT}\" \"// auto-generated at build time from pipeline.proto\\n\")
file(APPEND \"\${OUTPUT}\" \"namespace pipeline { }\\n\")
file(APPEND \"\${OUTPUT}\" \"using ServiceBase = ::pipeline::\${SVC}::Service;\\n\")
file(APPEND \"\${OUTPUT}\" \"// detected service: \${SVC}\\n\")
"
  @ONLY
)

set(SVC_ALIAS_HDR ${GEN_DIR}/service_alias.h)
add_custom_command(
  OUTPUT ${SVC_ALIAS_HDR}
  DEPENDS ${PROTO_FILE} ${CMAKE_BINARY_DIR}/extract_service_from_proto.cmake
  COMMAND ${CMAKE_COMMAND}
          -DINPUT=${PROTO_FILE}
          -DOUTPUT=${SVC_ALIAS_HDR}
          -P ${CMAKE_BINARY_DIR}/extract_service_from_proto.cmake
  COMMENT "Extracting service name from pipeline.proto into service_alias.h"
  VERBATIM
)

# -------------------- Binary --------------------
add_executable(surveilens_video_core
  src/server_grpc.cpp
  src/detector.cpp
  ${SVC_ALIAS_HDR}
)

target_include_directories(surveilens_video_core PRIVATE
  ${CMAKE_BINARY_DIR}
  ${GEN_DIR}
  ${OpenCV_INCLUDE_DIRS}
)

target_link_libraries(surveilens_video_core PRIVATE
  pipeline_proto
  gRPC::grpc++
  protobuf::libprotobuf
  Threads::Threads
  ZLIB::ZLIB
  ${OpenCV_LIBS}
)
