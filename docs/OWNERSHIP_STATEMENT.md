# Code Ownership & Dependency Statement
**Pass Science Works R&D Internship 2026–2027**

## 1. Original Work & Authorship
The following modules were designed, formulated, implemented, and verified specifically for this project:
- **1D Thermal FEA Solver** (`src/core/thermal_solver.hpp`): Element stiffness assembly, load vector calculation, Dirichlet boundary condition enforcement, linear Gaussian solver, analytical verification, and midpoint error evaluation.
- **ASCII STL & Temperature CSV Parsers** (`src/geometry/stl_parser.hpp`): Robust 3D geometric parsing, bounds calculation, normal validation, and temperature column mapping.
- **Multithreaded Benchmark Engine** (`src/performance/benchmark.hpp`): Parallel worker pool, deterministic workload generator, timing protocol, and numerical agreement verifier.
- **Embedded Hardware Simulation Drivers** (`src/hardware/hw_mock.hpp`): STM32F4 MCU, Xilinx FPGA, and Segger J-Link state machines, fault injection, and telemetry generators.
- **Neural Network Backpropagation** (`src/neural/nn_backprop.hpp`): Hand-derived analytical gradients, finite-difference gradient check, and gradient descent loop.
- **Frontend Architecture & UI Components** (`frontend/src/`): Modular dashboard, 3D visualizer, scientific charts, hardware telemetry gauges, and documentation viewer.
- **Automated Test Suite** (`tests/test_main.cpp`): 128 automated unit and integration tests.
- **Packaging & Launch Automation** (`scripts/`): Build scripts, Launch.cpp, packaging automation.

---

## 2. Third-Party Libraries & Dependencies

| Dependency | Version | License | Role / Purpose |
|:---|:---:|:---:|:---|
| **cpp-httplib** | 0.16.0 | MIT License | Lightweight, header-only HTTP server and REST router (`include/httplib.h`). |
| **nlohmann/json** | 3.11.3 | MIT License | JSON serialization and deserialization in C++ (`_deps/nlohmann_json-src/`). |
| **React** | 18.3.1 | MIT License | Frontend declarative component rendering framework. |
| **Vite** | 6.4.5 | MIT License | Frontend development server and bundling engine. |
| **Three.js** | 0.170.0 | MIT License | WebGL 3D rendering engine for geometry and point-cloud visualization. |
| **@react-three/fiber** | 8.17.10 | MIT License | React reconciler for Three.js scene graphs. |
| **@react-three/drei** | 9.117.3 | MIT License | Helper utilities for Three.js cameras and orbit controls. |
| **Recharts** | 2.13.3 | MIT License | Scientific chart library for FEA curves, convergence, and performance benchmarks. |
| **Lucide React** | 0.460.0 | ISC License | Clean, consistent scientific and engineering iconography. |

---

## 3. License Notice
The original source code developed for this application is released under the **MIT License**. All bundled third-party libraries retain their respective original copyrights and open-source licenses as noted above.
