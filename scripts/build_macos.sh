#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "=== Building Unified Engineering Workbench (macOS / Linux) ==="

echo "1. Configuring CMake (RelWithDebInfo)..."
cmake -B build -DCMAKE_BUILD_TYPE=RelWithDebInfo

echo "2. Building C++ server and test suite..."
cmake --build build --parallel $(sysctl -n hw.logicalcpu 2>/dev/null || nproc 2>/dev/null || echo 4)

echo "3. Building Frontend (Vite + TypeScript)..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo "   Installing npm dependencies..."
    npm install
fi
npm run build
cd "$DIR"

echo "4. Running C++ Test Suite..."
./build/workbench_tests

echo "=== Build Complete! All 128 tests passed. ==="
echo "Run './scripts/run_macos.sh' to launch the workbench."
