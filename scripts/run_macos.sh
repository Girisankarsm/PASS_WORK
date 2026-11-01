#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "=== Launching Unified Engineering Workbench ==="

# Check backend binary
if [ ! -f "build/workbench_server" ]; then
    echo "Backend binary not found. Running build..."
    bash scripts/build_macos.sh
fi

# Stop any lingering workbench_server instances
pkill -f workbench_server 2>/dev/null || true
sleep 0.5

# Start C++ backend
./build/workbench_server 8080 &
SERVER_PID=$!
echo "Backend running on PID $SERVER_PID (http://localhost:8080)"

# Cleanup trap on Ctrl+C
trap "echo 'Shutting down backend...'; kill $SERVER_PID 2>/dev/null; exit 0" SIGINT SIGTERM EXIT

# Check if frontend bundle exists; if not, build it
if [ ! -d "frontend/dist" ]; then
    echo "Frontend dist not found. Building frontend..."
    (cd frontend && npm run build)
fi

echo ""
echo "Unified Engineering Workbench is active:"
echo "  • Standalone UI: http://localhost:8080"
echo "  • C++ API:       http://localhost:8080/api"
echo ""
echo "Opening default browser to http://localhost:8080..."
if command -v open >/dev/null; then
    open "http://localhost:8080"
elif command -v xdg-open >/dev/null; then
    xdg-open "http://localhost:8080"
fi

echo "Press Ctrl+C to stop the workbench."
wait $SERVER_PID
