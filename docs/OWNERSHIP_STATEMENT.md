# Code Ownership & Intellectual Property Statement

**Project**: Unified Engineering Workbench  
**Assessment**: Pass Science Works R&D Internship 2026–2027  
**Candidate ID**: RA2311003012331  
**Repository**: `PASS_WORK`  
**Date**: November 2, 2026  

---

## 1. Candidate Original Work & Implementation

The following modules, algorithms, formulations, test suites, and documentation were conceived, designed, coded, and integrated specifically for this submission by the candidate:

| Component | Repository Path | Nature of Original Work |
|:---|:---|:---|
| **Thermal FEA Solver** | `src/core/thermal_solver.hpp` | Weak form derivation, element stiffness matrix $(kA/h)$, load vector $(qAh/2)$, row/col Dirichlet BC enforcement, Gaussian elimination with partial pivoting, analytical solution verification, and midpoint error calculation. |
| **Geometry Parsers & Mesh Engine** | `src/geometry/stl_parser.hpp`, `frontend/src/lib/geometryClassification.ts`, `frontend/src/lib/multiFileMesh.ts` | ASCII/Binary STL parser, surface area & volume calculation, bounding-box calculation, multi-file CSV node-face assembler, quad-to-triangle decomposition, and 1D/2D/3D structured grid classification. |
| **Multithreaded Benchmark** | `src/performance/benchmark.hpp` | Static workload partitioner, seed-42 deterministic random problem generation, median timing protocol, speedup/efficiency calculators, and serial-versus-parallel numerical agreement checking. |
| **Embedded Hardware Mocks** | `src/hardware/hw_mock.hpp` | State-machine based mock drivers for STM32 MCU, Xilinx Artix-7 FPGA, and Segger J-Link; hardware protocol simulation (SPI, JTAG, UART); simulated fault injection and recovery logic. |
| **Neural Network Engine** | `src/neural/nn_backprop.hpp` | Single-hidden-layer regression network with $\tanh$ activation; hand-derived analytical backpropagation gradients; central finite-difference gradient check harness; gradient descent optimizer. |
| **HTTP API Integration Server** | `src/main.cpp` | REST API routes, job scheduler with background async execution, static frontend self-hosting, CORS negotiation, and JSON response serialization. |
| **Standalone Windows Launcher** | `scripts/Launch.cpp`, `scripts/launch_windows.bat`, `Start-Workbench.bat`, `Stop-Workbench.bat` | Win32 process creation (`CreateProcessW`), Windows Job Object cleanup (`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`), Winsock port polling, `ShellExecuteA` browser launcher, and native error dialogs. |
| **Frontend UI & Workstation** | `frontend/src/` | Interactive scientific UI components, Three.js custom shaders and point cloud colorizers, Recharts integration, telemetry dials, and state management. |
| **Automated Verification Suites** | `tests/test_main.cpp`, `scripts/test_all.sh`, `scripts/test_geometry_classification.mjs`, `scripts/test_multi_file_mesh.mjs` | 128 C++ unit tests, 20 scientific frontend verification tests, and end-to-end integration tests. |

---

## 2. External Third-Party Libraries & Frameworks

The application reuses standard, permissively-licensed open-source libraries. None of these libraries implement the core engineering physics, numerical solvers, or assignment algorithms:

| Library / Tool | Version | License | Source / Upstream Repository | Purpose in Project |
|:---|:---:|:---:|:---|:---|
| **cpp-httplib** | 0.16.0 | MIT License | [yhirose/cpp-httplib](https://github.com/yhirose/cpp-httplib) | Embedded header-only HTTP 1.1 server and router (`include/httplib.h`). |
| **nlohmann/json** | 3.11.3 | MIT License | [nlohmann/json](https://github.com/nlohmann/json) | Modern C++ JSON serialization/deserialization. |
| **React** | 18.3.1 | MIT License | [facebook/react](https://github.com/facebook/react) | Frontend reactive component framework. |
| **Vite** | 6.4.5 | MIT License | [vitejs/vite](https://github.com/vitejs/vite) | Frontend build tool and development server. |
| **Three.js** | 0.170.0 | MIT License | [mrdoob/three.js](https://github.com/mrdoob/three.js) | WebGL 3D rendering library. |
| **@react-three/fiber** | 8.17.10 | MIT License | [pmndrs/react-three-fiber](https://github.com/pmndrs/react-three-fiber) | React reconciler for Three.js scene graphs. |
| **@react-three/drei** | 9.117.3 | MIT License | [pmndrs/drei](https://github.com/pmndrs/drei) | Camera controls and 3D UI helpers. |
| **Recharts** | 2.13.3 | MIT License | [recharts/recharts](https://github.com/recharts/recharts) | SVG chart library for numerical convergence curves. |
| **Lucide React** | 0.460.0 | ISC License | [lucide-icons/lucide](https://github.com/lucide-icons/lucide) | Vector iconography for scientific UI. |

---

## 3. Dataset Provenance and Licensing

All datasets provided in the `data/` directory are synthetic, non-proprietary test fixtures generated specifically for this project or derived from open geometric primitives:

1. **`data/stl/unit_cube.stl`**: Synthetically generated ASCII STL comprising 12 triangles (2 triangles per face) modeling a $1\text{m} \times 1\text{m} \times 1\text{m}$ unit cube. (Public Domain / MIT).
2. **`data/stl/cylinder.stl`, `irregular_bracket.stl`, `large_manifold.stl`**: Open synthetic geometric CAD models created for mesh parsing validation. (MIT).
3. **`data/csv/temperature_rod.csv`**: Synthetic 21-node collinear rod dataset generated directly from the analytical heat equation:
   $$T(x) = 100 - 80x + 500(x - x^2)$$
   with $L=1.0\text{ m}, k=10.0\text{ W/(m}\cdot\text{K)}, q=10000.0\text{ W/m}^3$. (MIT).
4. **`data/csv/cube_27_structured.csv`, `rectilinear_grid.csv`, `plate_2d_mesh.csv`, `quad_shell_*.csv`, `cylinder_*.csv`, `unstructured_cloud.csv`**: Synthetic point cloud and mesh topology test files generated for spatial classification and multi-file mesh import verification. (MIT).

*No proprietary ANSYS, SolidWorks, or confidential commercial data is contained in this repository.*

---

## 4. AI-Assisted Work and Verification

As disclosed in [AI_DISCLOSURE.md](AI_DISCLOSURE.md):
- AI foundational models (Gemini 3.8 Flash, Claude Sonnet 3.7) were used as productivity tools for initial code structure, boilerplate generation, and documentation drafting.
- All AI suggestions were rigorously reviewed, debugged, and verified through automated unit tests, compiler checks, and independent mathematical derivations.
- Specific algorithmic bugs introduced in initial AI drafts (e.g., thermal FEA Dirichlet boundary row omission, Windows SDK `ERROR` macro collision, benchmark seed contamination) were detected and resolved by the developer.

---

## 5. Unresolved Attribution & Licensing Questions

- **None Identified**: All third-party dependencies are licensed under permissive open-source licenses (MIT or ISC). All synthetic datasets are original or unencumbered. The complete project is licensed under the MIT License (see [LICENSE](../LICENSE)).
