#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "=== Running Unified Engineering Workbench Full Test Verification ==="

echo "1. C++ Automated Tests (128 assertions)..."
./build/workbench_tests

echo "2. CTest Suite..."
cd build && ctest --output-on-failure && cd ..

echo "3. Scientific Geometry & Temperature Dataset Test Suite..."
node scripts/test_geometry_classification.mjs

echo "4. Multi-File Mesh Import & Validation Test Suite..."
node scripts/test_multi_file_mesh.mjs

echo "5. Frontend TypeScript Typecheck..."
cd frontend && npx tsc --noEmit && cd ..

echo "6. Frontend Production Build Check..."
cd frontend && npm run build && cd ..

echo "7. End-to-End API Integration Verification..."
./build/workbench_server 8080 &
SERVER_PID=$!
sleep 1.5

python3 - << 'EOF'
import urllib.request, json, time

BASE = "http://localhost:8080/api"

def get(path):
    with urllib.request.urlopen(f"{BASE}{path}") as resp:
        return json.loads(resp.read().decode())

def post(path, data):
    req = urllib.request.Request(f"{BASE}{path}", data=json.dumps(data).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

assert get("/health")["success"] == True
assert get("/system-info")["success"] == True

with open("data/stl/unit_cube.stl") as f:
    res = post("/geometry/parse-stl", {"content": f.read()})
    assert res["success"] and res["triangle_count"] == 12

with open("data/csv/temperature_rod.csv") as f:
    res = post("/geometry/parse-csv", {"content": f.read()})
    assert res["success"] and res["node_count"] == 21

res = post("/thermal/solve", {"n_elements": 20, "L": 1.0, "A": 1e-4, "k": 10.0, "q": 10000.0, "T0": 100.0, "TL": 20.0})
assert res["success"] and res["max_midpoint_error"] < 0.32

res = post("/thermal/convergence", {"elements_list": [10, 20, 40, 80]})
assert res["success"] and len(res["convergence"]) == 4

res = post("/neural/train", {"n_steps": 100, "lr": 0.1, "x": 1.0, "y": 2.0, "w": 0.5, "b": 0.0, "v": 1.0, "c": 0.0})
assert res["success"] and res["grad_check_passed"] == True and res["history"][-1]["loss"] < 1e-10

print("All end-to-end integration tests PASSED!")
EOF

kill $SERVER_PID 2>/dev/null || true

echo "=== All Tests and Verifications Completed Successfully ==="
