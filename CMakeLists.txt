cmake_minimum_required(VERSION 3.20)
project(UnifiedEngineeringWorkbench VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Build type
if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE RelWithDebInfo)
endif()

# Optimization flags
if(MSVC)
  add_compile_options(/O2 /W3)
else()
  add_compile_options(-O2 -Wall -Wextra -Wpedantic)
endif()

# ============================================================
# Dependencies via FetchContent
# ============================================================
include(FetchContent)

# cpp-httplib v0.16.0
FetchContent_Declare(httplib
  GIT_REPOSITORY https://github.com/yhirose/cpp-httplib.git
  GIT_TAG        v0.16.0
)
FetchContent_MakeAvailable(httplib)

# nlohmann/json v3.11.3
FetchContent_Declare(nlohmann_json
  GIT_REPOSITORY https://github.com/nlohmann/json.git
  GIT_TAG        v3.11.3
)
FetchContent_MakeAvailable(nlohmann_json)

# ============================================================
# Include paths
# ============================================================
include_directories(
  ${CMAKE_SOURCE_DIR}/include
  ${CMAKE_SOURCE_DIR}/src
  ${httplib_SOURCE_DIR}
  ${nlohmann_json_SOURCE_DIR}/include
)

# ============================================================
# Backend executable
# ============================================================
add_executable(workbench_server src/main.cpp)
target_include_directories(workbench_server PRIVATE
  ${httplib_SOURCE_DIR}
  ${nlohmann_json_SOURCE_DIR}/include
  ${CMAKE_SOURCE_DIR}/src
)
target_link_libraries(workbench_server PRIVATE nlohmann_json::nlohmann_json)
if(UNIX AND NOT APPLE)
  target_link_libraries(workbench_server PRIVATE pthread)
endif()

# ============================================================
# Tests
# ============================================================
enable_testing()

add_executable(workbench_tests tests/test_main.cpp)
target_include_directories(workbench_tests PRIVATE
  ${CMAKE_SOURCE_DIR}/src
  ${nlohmann_json_SOURCE_DIR}/include
)

add_test(NAME WorkbenchTests COMMAND workbench_tests)
