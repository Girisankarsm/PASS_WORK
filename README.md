# Unified Engineering Workbench
**Pass Science Works R&D Internship 2026–2027**

A professional engineering simulation platform with a C++17 backend and React/TypeScript frontend.

- **GitHub Repository**: [https://github.com/Girisankarsm/PASS_WORK](https://github.com/Girisankarsm/PASS_WORK)
- **Automated Verification**: Run `./scripts/test_all.sh` (128/128 tests passing + full API verification)
- **Windows Package**: `PassScience_Workbench.zip` (standalone offline launch)

## Features

| Module | Description |
|--------|-------------|
| **Geometry Viewer** | ASCII STL parsing, temperature CSV visualization, interactive 3D (Three.js) |
| **Thermal FEA** | 1D steady-state FEM solver, analytical verification, mesh convergence study |
| **Performance Lab** | Serial vs parallel thermal benchmarks, speedup, efficiency, 5 reps |
| **Hardware Integration** | MCU, FPGA, JTAG mock adapters with telemetry [SIMULATED] |
| **Neural Network Lab** | Handcoded backprop, gradient check, loss tracking |
| **Test Suite** | 128 automated C++ tests — 128/128 passing |

## Prerequisites

- macOS with Xcode Command Line Tools (or Linux with GCC/Clang)
- CMake ≥ 3.20
- Node.js ≥ 18
- Git (for FetchContent dependencies)

## Build & Run

### Backend (C++)

```bash
# Configure (downloads cpp-httplib and nlohmann/json automatically)
cmake -B build -DCMAKE_BUILD_TYPE=RelWithDebInfo

# Build server and tests
cmake --build build --parallel 10

# Run test suite (128 tests)
./build/workbench_tests

# Run backend server on port 8080
./build/workbench_server
```

### Frontend (React)

```bash
cd frontend
npm install
npm run dev   # → http://localhost:5173
```

Open http://localhost:5173 in your browser. The backend must be running for live data.

## Project Structure

```
unified-engineering-workbench/
├── src/
│   ├── main.cpp                  # HTTP server (cpp-httplib)
│   ├── core/thermal_solver.hpp   # 1D FEM thermal solver
│   ├── geometry/stl_parser.hpp   # ASCII STL + temperature CSV parsers
│   ├── performance/benchmark.hpp # Serial/parallel benchmarking
│   ├── hardware/hw_mock.hpp      # MCU, FPGA, JTAG mock adapters
│   └── neural/nn_backprop.hpp    # Neural network backpropagation
├── frontend/src/
│   ├── App.tsx                   # Root with routing and backend status
│   ├── lib/api.ts               # Typed API client
│   ├── types/api.ts             # TypeScript interfaces
│   └── pages/                   # Dashboard, Geometry, Thermal, etc.
├── tests/test_main.cpp          # C++ test suite (128 tests)
├── data/
│   ├── stl/unit_cube.stl        # Synthetic 12-triangle unit cube
│   └── csv/temperature_rod.csv  # Synthetic 21-node thermal solution
├── CMakeLists.txt
└── README.md
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Backend health check |
| GET | `/api/system-info` | CPU, OS, compiler info |
| POST | `/api/geometry/parse-stl` | Parse ASCII STL content |
| POST | `/api/geometry/parse-csv` | Parse temperature CSV |
| POST | `/api/thermal/solve` | Run FEM thermal solver |
| POST | `/api/thermal/convergence` | Run convergence study |
| POST | `/api/performance/benchmark` | Launch async benchmark job |
| GET | `/api/jobs/:id` | Poll async job status |
| GET | `/api/hardware/devices` | List mock devices |
| POST | `/api/hardware/connect` | Connect device (with optional simulated failure) |
| POST | `/api/hardware/disconnect` | Disconnect device |
| GET | `/api/hardware/telemetry/:device` | Get device telemetry |
| POST | `/api/neural/train` | Train neural network |

## Sample Data

- `data/stl/unit_cube.stl` — 12-triangle unit cube (1m×1m×1m), ASCII STL, synthetic
- `data/csv/temperature_rod.csv` — 21 nodes on a 1D rod, temperatures matching analytical FEA solution

**Provenance**: All data is synthetically generated. Not real ANSYS exports.

## Test Outcomes

All 128 tests pass on macOS 27, Apple Clang 21.0.0, 10 logical CPUs.

Run: `./build/workbench_tests`

**Debugging insight**: Dirichlet BC at the last FEM node initially only zeroed the column of K, not the row. 
This caused T(L)≈20.73°C instead of prescribed 20.0°C. Fixed by also zeroing `K[n][j]` for all j≠n.

## Known Limitations

- FEM uses dense Gaussian elimination — not scalable beyond ~10000 DOFs
- Binary STL not supported (ASCII only)
- Parallel uses static partitioning, not work-stealing
- Hardware devices are entirely simulated
- Windows executable requires MSVC build on Windows CI
- Handwritten backpropagation appendix must be provided separately as physical scan

## Technology Stack

- **Backend**: C++17, CMake, cpp-httplib v0.16.0, nlohmann/json v3.11.3
- **Frontend**: React 18, Vite 6, TypeScript 5, Three.js 0.170, Recharts 2.13, Lucide
- **Build**: CMake FetchContent (no system-install of http/json libs required)
- **Tests**: CTest + custom framework, 128 assertions

## License

Source code: MIT License. Dependencies carry their respective MIT/Apache licenses (see Documentation page).
