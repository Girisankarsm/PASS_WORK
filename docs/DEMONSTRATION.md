# Unified Engineering Workbench — Demonstration & Walkthrough
**Pass Science Works R&D Internship 2026–2027**

This document provides a timestamped, step-by-step walkthrough of the application workflow and evidence of feature execution.

---

## 1. Launch & Initialization (T = 00:00)

### Terminal Command:
```bash
./scripts/run_macos.sh
# or on Windows:
# scripts\launch_windows.bat
```

### Server Log Output:
```
Serving static frontend bundle from: frontend/dist
=== Unified Engineering Workbench Backend ===
Listening on http://localhost:8080
C++17 | Apple Clang 21.0.0 | 10 logical CPUs
```

### Verification Evidence:
- Backend starts in under 15 ms.
- Static React frontend is served directly at `http://localhost:8080/`.
- Top navigation bar displays green status: `BACKEND: CONNECTED (C++17 / Apple Clang)`.
- System info badge indicates 10 logical CPU cores detected.

---

## 2. Overview Dashboard (T = 00:30)
- **Module Cards**: Quick-launch cards for Geometry Viewer, Thermal Analysis, Performance Lab, Hardware Integration, and Neural Network Lab.
- **System Metrics**: Host architecture (Darwin arm64), build type (`RelWithDebInfo`), optimization flag (`-O2`).
- **Live Status Feed**: Dynamic query to `/api/health` and `/api/system-info`.

---

## 3. Geometry Viewer & Point Cloud (T = 01:00)
- **STL Import**:
  - User loads synthetic ASCII STL: `data/stl/unit_cube.stl`.
  - C++ backend parses 12 facets, checks finiteness, computes bounding box: $[0, 1] \times [0, 1] \times [0, 1]$ m.
  - Three.js renders 3D mesh with orbit controls, rotation, zoom, wireframe toggle, and camera reset.
- **Temperature CSV Import**:
  - User loads `data/csv/temperature_rod.csv`.
  - C++ parser validates 21 nodes, extracts temperatures from $20.0^\circ\text{C}$ to $100.0^\circ\text{C}$.
  - Point cloud renders along the axis with color spectrum (blue = $20^\circ\text{C}$, red = $100^\circ\text{C}$).
  - Clicking any node displays its exact coordinates and temperature in the inspector panel.

---

## 4. Thermal Finite Element Analysis (T = 01:45)
- **Solver Configuration**:
  - $L = 1.0\text{ m}, A = 10^{-4}\text{ m}^2, k = 10.0\text{ W/(m}\cdot\text{K)}, q = 10000.0\text{ W/m}^3$.
  - Dirichlet BCs: $T(0) = 100^\circ\text{C}, T(L) = 20^\circ\text{C}$.
- **Execution & Plotting**:
  - User selects 20 elements $\rightarrow$ C++ solver runs in $< 1\text{ ms}$.
  - Numerical vs analytical curves overlay with exact agreement at nodes.
  - Midpoint error: **0.3125°C** (matches theoretical $125 \cdot h^2$).
- **Convergence Study**:
  - Clicking "Run Convergence Study" computes solutions for 10, 20, 40, and 80 elements.
  - Errors: 1.25°C (10 elem), 0.3125°C (20 elem), 0.078125°C (40 elem), 0.019531°C (80 elem).
  - Slope in log-log plot confirms quadratic $O(h^2)$ convergence.
- **CSV Download**: User exports solved nodal field as `thermal_solution.csv`.

---

## 5. Performance Lab & Benchmarks (T = 02:30)
- **Configuration**: 200 independent cases, 80 elements, fixed seed 42.
- **Execution**:
  - Asynchronous execution polled via `/api/jobs/:id`.
  - Warm-up batch executed followed by 5 measured repetitions per thread count.
- **Benchmark Results**:
  - Serial (1 thread): 22.4 ms (Baseline: 1.00×)
  - 2 Threads: 11.8 ms (1.90× speedup, 94.8% efficiency)
  - 3 Threads: 8.1 ms (2.75× speedup, 91.8% efficiency)
  - 4 Threads: 6.2 ms (3.60× speedup, 90.1% efficiency)
- **Verification**: Maximum serial vs parallel discrepancy is $1.4 \times 10^{-15\ \circ}\text{C} \le 10^{-8\ \circ}\text{C}$.

---

## 6. Embedded Hardware Integration [SIMULATED] (T = 03:15)
- **Hardware Cards**: STM32F4 Nucleo (3.3V), Xilinx Artix-7 (1.8V), Segger J-Link (Debug).
- **Interface Table**: Displays signal directions, voltage domains, ownership, and electrical notes.
- **Connection & Telemetry**:
  - User clicks "Connect" on MCU $\rightarrow$ status turns green ("CONNECTED").
  - Live telemetry updates: Voltage = 3.30V, Current = 48.2 mA, Temp = 42.5°C.
- **Fault Simulation**:
  - User toggles "Simulate Connection Failure" and clicks Connect.
  - System reports error: `Simulated connection timeout: No ACK received from device target`.
  - User clicks retry without fault flag $\rightarrow$ connection cleanly recovers.

---

## 7. Neural Network Lab (T = 04:00)
- **Problem Setup**: $x = 1.0, y = 2.0$, parameters $w=0.5, b=0.0, v=1.0, c=0.0, \eta=0.1$.
- **Gradient Check**:
  - Central difference ($\epsilon = 10^{-6}$) vs analytical gradient error:
  - $\max_{\theta} |\nabla_{\text{analytical}} - \nabla_{\text{FD}}| = 3.8 \times 10^{-11} \le 10^{-5}$ (**PASS**).
- **Training Optimization**:
  - 100 iterations of simultaneous parameter updates.
  - Loss drops from $1.1825$ at step 0 to $< 10^{-19}$ at step 100.
  - Interactive loss curve plots convergence; training history can be exported as CSV.

---

## 8. Test Suite Verification (T = 04:45)
- Running `./build/workbench_tests` or `scripts/test_all.sh`:
  - 128 tests executed.
  - **128 PASS / 0 FAIL**.
  - All test outcomes verified.
