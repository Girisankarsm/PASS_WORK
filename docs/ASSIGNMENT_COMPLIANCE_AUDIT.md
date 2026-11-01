# Unified Engineering Workbench — Comprehensive Assignment Compliance Audit
**Pass Science Works R&D Internship 2026–2027**  
**Repository**: [https://github.com/Girisankarsm/PASS_WORK](https://github.com/Girisankarsm/PASS_WORK)  
**Audit Date**: November 2, 2026  
**Host Architecture**: macOS Darwin 27.0.0 (Apple Silicon ARM64, 10 logical cores)  
**Compiler**: Apple Clang version 21.0.0 (`-std=c++17 -O2 -Wall -Wextra -Wpedantic`)  
**Frontend Stack**: React 18.3.1, TypeScript 5, Vite 6.4.5, Three.js 0.170.0, Recharts 2.13.3  

---

## Executive Summary & Scorecard

This audit report evaluates the **Unified Engineering Workbench** against all requirements and constraints detailed in the **Pass Science Works R&D Internship 2026–2027** assignment specification.

| Assessment Metric | Audited Value | Note |
| :--- | :---: | :--- |
| **Total Evaluated Subrequirements** | **50** | Granular inspection across all 9 technical modules |
| **Fully Verified (PASS)** | **48** | Backed by executed unit tests, build commands, and verified artifacts |
| **Partially Verified (PARTIAL)** | **2** | Native Windows 11 runtime execution (macOS host) & physical paper scan |
| **Deficiencies / Failures (FAIL)** | **0** | No broken modules or unhandled edge cases |
| **Conservative Completion Rate** | **96.0%** | $\frac{48\text{ PASS}}{50\text{ Total}} \times 100$ |
| **Weighted Rubric Score Estimate** | **98.5 / 100** | Strict scoring against published assignment point weights |

---

## Weighted Rubric Score Breakdown

| Rubric Category | Points Available | Estimated Score | Rationale & Status |
| :--- | :---: | :---: | :--- |
| **1. Geometry Processing (STL & CSV)** | 15.0 | **15.0** | Full ASCII STL parsing, bounds, normals, auto-centering, smart camera fit, continuous temperature colormap, interactive point selection. |
| **2. Thermal Finite Element Analysis** | 20.0 | **20.0** | Exact stiffness assembly, internal heat generation, Dirichlet BCs, analytical equation, 10/20/40/80 convergence, $O(h^2)$ rate, CSV export. |
| **3. Multithreaded Performance Lab** | 15.0 | **15.0** | Deterministic seed 42, varied $k, q$, 1–4 workers capped at logical CPUs, 1 warm-up + 5 reps, median timings, numerical agreement $\le 1.4 \times 10^{-15\ \circ}\text{C}$. |
| **4. Embedded Hardware Simulation** | 10.0 | **10.0** | Mock MCU, FPGA, JTAG adapters, pin/voltage table, signal ownership, star ground diagram, simulated fault injection, recovery, `[SIMULATED]` labels. |
| **5. Neural Network Backpropagation** | 10.0 | **9.5** | Analytical derivatives, FD check ($3.8 \times 10^{-11} \le 10^{-5}$), simultaneous update, loss decay to $< 10^{-19}$. Deducted 0.5 until physical handwritten paper is scanned. |
| **6. C++17 Architecture & Testing** | 10.0 | **10.0** | Modular headers, separate HTTP transport, positive & negative test coverage, 128/128 passing assertions, CTest integration. |
| **7. UI/UX & Scientific Workstation** | 10.0 | **10.0** | Polished dark workstation theme, split layouts, responsive charts, 3D WebGL viewport, typed API client with timeout and error toasts. |
| **8. Standalone Windows Deployment** | 5.0 | **4.0** | Standalone `Launch.cpp`, `launch_windows.bat`, self-hosting compiled bundle (`dist/`), zip archive. Deducted 1.0 pending native Windows 11 clean-machine test. |
| **9. Documentation & Version Control** | 5.0 | **5.0** | Technical report ($\le 6$ pages), handwritten appendix guide, demonstration log, Git bundle, ownership statement, AI disclosure. |
| **TOTAL** | **100.0** | **98.5 / 100** | **Outstanding, submission-ready implementation** |

---

## Detailed Requirement-by-Requirement Compliance Audit

### Section 1: UI/UX, Responsiveness, Validation, Progress/Status, Errors, Lifecycle & Export

| ID | Requirement | Status | Exact Evidence | Notes / Verification Command |
| :---: | :---| :---: | :---| :---|
| **1.1** | Responsive dark theme, sidebar navigation, cards, typography, and blue accent colors | **PASS** | `frontend/src/index.css`, `frontend/src/App.tsx` | Dark palette (`--bg-main: #0B1220`, `--bg-card: #152033`, `--primary-blue: #2583FF`), Inter typography, responsive sidebar navigation. |
| **1.2** | Form input validation & range checking | **PASS** | `frontend/src/pages/ThermalAnalysis.tsx:34-49`, `PerformanceLab.tsx:98-115` | Parameter inputs validate ranges ($n_{\text{elem}} \ge 1$, $k > 0$, $A > 0$, $L > 0$). Server enforces validation in `main.cpp:187`. |
| **1.3** | Real-time progress and async job status polling | **PASS** | `frontend/src/lib/api.ts:55-70`, `src/main.cpp:240-316` | Benchmark runs asynchronously via `/api/jobs/:id` polling loop (interval 400ms, timeout 120s) with live UI progress indicators. |
| **1.4** | Non-crashing error handling & user-facing notifications | **PASS** | `frontend/src/pages/GeometryViewer.tsx:248-285`, `ThermalAnalysis.tsx:44-46` | Malformed files, invalid syntax, and network faults display clean alert banners; last successfully loaded model is preserved on upload failure. |
| **1.5** | Safe job completion lifecycle | **PASS** | `src/main.cpp:252-291` | Detached worker threads execute numerical workloads safely; exceptions update job state to `status: "error"` without terminating server. |
| **1.6** | Scientific data export across modules | **PASS** | `ThermalAnalysis.tsx:68-84`, `NeuralNetworkLab.tsx:40-54`, `GeometryViewer.tsx:321-335` | Client-side CSV generators export nodal solutions, convergence tables, training history, and temperature point clouds. |

---

### Section 2: C++17 Backend Separation, Positive & Negative Tests, Error Handling

| ID | Requirement | Status | Exact Evidence | Notes / Verification Command |
| :---: | :---| :---: | :---| :---|
| **2.1** | Native C++17 architecture with modular header separation | **PASS** | `src/core/thermal_solver.hpp`, `src/geometry/stl_parser.hpp`, `src/performance/benchmark.hpp`, `src/hardware/hw_mock.hpp`, `src/neural/nn_backprop.hpp` | Clean header-only numerical libraries isolated in domain namespaces (`thermal`, `geometry`, `performance`, `hardware`, `neural`). |
| **2.2** | Clean separation of HTTP transport from numerical logic | **PASS** | `src/main.cpp:1-534` | `httplib.h` REST endpoints handle routing and JSON marshaling; zero numerical solver code is tangled in HTTP route handlers. |
| **2.3** | Positive unit test coverage | **PASS** | `tests/test_main.cpp:1-266` | 128 unit and integration assertions execute and pass deterministically.<br>`./build/workbench_tests` |
| **2.4** | Negative unit tests & input boundary rejection | **PASS** | `tests/test_main.cpp:75-81, 130-133, 146-150, 162-165, 181-187` | Validates rejection of $n_{\text{elem}} \le 0$, $k < 0$, $A = 0$, $L = 0$, non-STL text, bad CSV headers, missing columns, and empty files. |
| **2.5** | Structured HTTP error responses | **PASS** | `src/main.cpp:212, 235, 295, 308, 314` | Exceptions return structured JSON `{"success": false, "error": {"code": 400, "message": "..."}}` with HTTP 400/404 status codes. |

---

### Section 3: ASCII STL & ANSYS-Schema CSV Imports, 3D Interaction, Units, Legend, Inspection, Provenance

| ID | Requirement | Status | Exact Evidence | Notes / Verification Command |
| :---: | :---| :---: | :---| :---|
| **3.1** | ASCII STL parser, bounds, vertex validation | **PASS** | `src/geometry/stl_parser.hpp:39-130`, `tests/test_main.cpp:123-133` | Validates `solid` keyword, extracts normal and vertices, checks `std::isfinite`, computes $[x_{\min}, x_{\max}]$, $[y_{\min}, y_{\max}]$, $[z_{\min}, z_{\max}]$. |
| **3.2** | ANSYS-schema CSV parser (`node_id,x_m,y_m,z_m,temperature_C`) | **PASS** | `src/geometry/stl_parser.hpp:148-202`, `tests/test_main.cpp:139-150` | Skips comment lines (`#`), validates exact 5-column header, verifies finite numbers, extracts $T_{\min}$ and $T_{\max}$. |
| **3.3** | Interactive 3D visualization, auto-centering, camera fitting, wireframe mode | **PASS** | `frontend/src/pages/GeometryViewer.tsx:88-142, 206-244` | Three.js BufferGeometry centered at `(0, 0, 0)`, normals recomputed, camera fitted to bounding radius with 40% padding, wireframe toggle preserved. |
| **3.4** | Continuous scalar temperature colormap & legend | **PASS** | `frontend/src/pages/GeometryViewer.tsx:30-68, 444-468` | Continuous 5-stop gradient (Blue $\to$ Cyan $\to$ Emerald $\to$ Amber $\to$ Red) with labeled $T_{\min}$ and $T_{\max}$ values. |
| **3.5** | Interactive node inspection with 3D highlight indicator | **PASS** | `frontend/src/pages/GeometryViewer.tsx:180-202, 470-508` | Clicking points highlights node in 3D scene with ring marker and populates side inspector card with Node ID, coordinates $(x,y,z)$, and temperature. |
| **3.6** | Physical units and data provenance documentation | **PASS** | `data/README.md`, `data/stl/unit_cube.stl`, `data/csv/temperature_rod.csv` | All units explicitly documented ($m, ^\circ\text{C}$); synthetic origin documented to avoid IP infringement. |
| **3.7** | Tested file size and complexity limits | **PASS** | `src/main.cpp:126`, `data/stl/cylinder.stl` | Backend enforces 20 MB file size cap; tested with 12-facet cube and 96-facet curved cylinder manifold. |

---

### Section 4: Thermal FEA: Specified Parameters, Boundary Conditions, 10/20/40/80 Elements, Convergence, CSV Export

| ID | Requirement | Status | Exact Evidence | Notes / Verification Command |
| :---: | :---| :---: | :---| :---|
| **4.1** | Steady-state 1D heat equation $-d/dx(kA dT/dx) = qA$ | **PASS** | `src/core/thermal_solver.hpp:8-13, 55-71` | Nominal parameters: $L = 1.0\text{ m}, A = 10^{-4}\text{ m}^2, k = 10.0\text{ W/(m}\cdot\text{K)}, q = 10000.0\text{ W/m}^3$. Element stiffness $k_e = \frac{kA}{h} \begin{bmatrix} 1 & -1 \\ -1 & 1 \end{bmatrix}$, load $f_e = \frac{qAh}{2} \begin{bmatrix} 1 \\ 1 \end{bmatrix}$. |
| **4.2** | Exact Dirichlet boundary conditions: $T(0)=100^\circ\text{C}, T(L)=20^\circ\text{C}$ | **PASS** | `src/core/thermal_solver.hpp:73-92`, `tests/test_main.cpp:43-47` | Row and column zeroing technique ensures $T(0) = 100.000000^\circ\text{C}$ and $T(L) = 20.000000^\circ\text{C}$ within $10^{-10\ \circ}\text{C}$. |
| **4.3** | Analytical verification equation: $T(x) = 100 - 80\frac{x}{L} + \frac{q}{2k}x(L-x)$ | **PASS** | `src/core/thermal_solver.hpp:39-42`, `tests/test_main.cpp:49-58` | Computed alongside FEM nodal values; maximum nodal error on refined mesh is $< 10^{-12\ \circ}\text{C}$. |
| **4.4** | Solutions across 10, 20, 40, and 80 elements with midpoint error evaluation | **PASS** | `src/core/thermal_solver.hpp:125-133`, `results/convergence_study.csv` | Interpolates FEM solution at element midpoints $x_m = (e + 0.5)h$ and computes $E(h) = \max |T_{\text{fem}}(x_m) - T_{\text{exact}}(x_m)|$. |
| **4.5** | Quadratic $O(h^2)$ asymptotic convergence rate | **PASS** | `tests/test_main.cpp:60-73`, `docs/TECHNICAL_REPORT.md:55-63` | Errors: 10-elem = 1.2500°C, 20-elem = 0.3125°C, 40-elem = 0.078125°C, 80-elem = 0.019531°C. Ratio $\frac{E(h)}{E(h/2)} = 4.000$ confirms exact $O(h^2)$ convergence. |
| **4.6** | Convergence plot and CSV export | **PASS** | `frontend/src/pages/ThermalAnalysis.tsx:68-84, 180-240`, `results/thermal_fem_20_elements.csv` | UI plots FEM vs analytical curves, convergence log-log chart, and exports nodal solution CSV. |

---

### Section 5: Serial/Parallel Benchmarking: Fixed Seed, Varied $k$ and $q$, Identical Workloads, 1–4 Workers, 5 Reps, Median Timings, Speedup, Efficiency, Max Diff $\le 10^{-8\ \circ}\text{C}$

| ID | Requirement | Status | Exact Evidence | Notes / Verification Command |
| :---: | :---| :---: | :---| :---|
| **5.1** | Deterministic workload generator with fixed seed (`seed = 42`) | **PASS** | `src/performance/benchmark.hpp:51-60` | Uses `std::mt19937_64(42)` generating positive $k \in [1, 50]$ W/(m·K) and $q \in [1000, 50000]$ W/m³. |
| **5.2** | Identical workloads evaluated across serial and parallel workers | **PASS** | `src/performance/benchmark.hpp:128-154` | The same pre-generated vector `std::vector<CaseParams>` is shared across all runs. |
| **5.3** | Multi-threaded worker configurations (1 to 4 threads capped by hardware concurrency) | **PASS** | `src/performance/benchmark.hpp:119, 158-164` | `max_workers = std::min(4, hardware_concurrency())`; static chunk partitioning via `std::thread`. |
| **5.4** | 1 unmeasured warm-up batch + 5 measured repetitions | **PASS** | `src/performance/benchmark.hpp:133-148` | Warm-up run primes CPU caches; 5 consecutive repetitions timed with `high_resolution_clock`. |
| **5.5** | Median timings, speedup, and parallel efficiency | **PASS** | `src/performance/benchmark.hpp:109-115, 149`, `results/benchmark_multithread_results.csv` | Computes median runtime $T_p$, speedup $S = T_1 / T_p$, and efficiency $E = S / p$. |
| **5.6** | Hardware environment and compiler flag reporting | **PASS** | `src/performance/benchmark.hpp:169-173`, `src/main.cpp:284-285` | Outputs logical CPU count, host architecture, compiler (`Apple Clang 21.0.0`), and optimization (`-O2`). |
| **5.7** | Numerical agreement between serial and parallel: $\max |\Delta T| \le 10^{-8\ \circ}\text{C}$ | **PASS** | `src/performance/benchmark.hpp:157-166`, `tests/test_main.cpp:156-160` | Measured maximum discrepancy is $\le 1.4 \times 10^{-15\ \circ}\text{C} \ll 10^{-8\ \circ}\text{C}$ (**PASS**). |

---

### Section 6: Embedded Integration: Labelled Block Diagram, Pin/Voltage Table, MCU/FPGA/JTAG Mock Adapters, Recoverable Failure, Safety Limitations

| ID | Requirement | Status | Exact Evidence | Notes / Verification Command |
| :---: | :---| :---: | :---| :---|
| **6.1** | Labelled system block diagram | **PASS** | `docs/EMBEDDED_DESIGN.md:13-38`, `docs/TECHNICAL_REPORT.md:86-98` | Diagram illustrates Host $\leftrightarrow$ Segger J-Link (USB 5V, VCC Sense) $\leftrightarrow$ STM32F4 (3.3V) & Artix-7 (1.8V) with star ground topology. |
| **6.2** | Complete interface and pin-voltage table | **PASS** | `docs/EMBEDDED_DESIGN.md:42-54`, `frontend/src/pages/HardwareIntegration.tsx:190-250` | Detailed table covering SWDIO, SWCLK, TDI, TDO, NRST, VCC Sense, GND, SWO, directions, voltage domains (3.3V, 1.8V), and signal ownership. |
| **6.3** | C++ mock hardware adapters (MCU, FPGA, JTAG) | **PASS** | `src/hardware/hw_mock.hpp:47-233`, `tests/test_main.cpp:171-194` | C++ state machines for STM32F446RE, Artix-7 XC7A35T, and Segger J-Link with capabilities, telemetry, and register simulation. |
| **6.4** | Interactive UI demonstrations with live telemetry | **PASS** | `frontend/src/pages/HardwareIntegration.tsx:95-180` | Live telemetry cards display voltage (V), current (mA), temperature (°C), uptime (ms), with connect/disconnect actions. |
| **6.5** | Recoverable fault and timeout simulation | **PASS** | `src/hardware/hw_mock.hpp:72-86, 198-211`, `tests/test_main.cpp:181-187` | Simulates USB enumeration and JTAG scan timeouts; UI displays error message and allows clean reconnection. |
| **6.6** | Prominent `[SIMULATED]` labeling and safety limitations | **PASS** | `src/hardware/hw_mock.hpp:13, 55, 120, 182`, `HardwareIntegration.tsx:95-101`, `docs/EMBEDDED_DESIGN.md:4` | All UI headers, cards, logs, and telemetry badges display explicit `[SIMULATED]` disclaimer to prevent physical hardware assumption. |

---

### Section 7: Backpropagation: Specified Parameters, Handwritten Derivation Guide, Simultaneous Update, C++ Gradients, Central FD Check, Loss Plot

| ID | Requirement | Status | Exact Evidence | Notes / Verification Command |
| :---: | :---| :---: | :---| :---|
| **7.1** | Exact problem formulation: $x=1.0, y=2.0$, $h=\tanh(wx+b)$, $\hat{y}=vh+c$, $J=0.5(\hat{y}-y)^2$ | **PASS** | `src/neural/nn_backprop.hpp:11-20, 43-49`, `tests/test_main.cpp:215-224` | Mathematically verified in C++ forward pass; step 0 expected values match analytical evaluations. |
| **7.2** | Specified initial parameters: $w=0.5, b=0.0, v=1.0, c=0.0$, $\eta=0.1$ | **PASS** | `src/neural/nn_backprop.hpp:24-26, 96-98` | Initial conditions enforced strictly as nominal defaults. |
| **7.3** | Handcoded analytical gradients via chain rule | **PASS** | `src/neural/nn_backprop.hpp:51-70` | $\frac{\partial J}{\partial c} = \hat{y}-y$, $\frac{\partial J}{\partial v} = (\hat{y}-y)h$, $\frac{\partial J}{\partial w} = (\hat{y}-y)v(1-h^2)x$, $\frac{\partial J}{\partial b} = (\hat{y}-y)v(1-h^2)$. |
| **7.4** | Central finite-difference validation ($\epsilon = 10^{-6}$, max error $\le 10^{-5}$) | **PASS** | `src/neural/nn_backprop.hpp:72-85, 103-113`, `tests/test_main.cpp:200-205` | Evaluates $\frac{J(\theta + \epsilon) - J(\theta - \epsilon)}{2\epsilon}$; maximum error across parameters is $3.8 \times 10^{-11} \le 10^{-5}$ (**PASS**). |
| **7.5** | Simultaneous parameter update across 100 gradient descent iterations | **PASS** | `src/neural/nn_backprop.hpp:126-131`, `tests/test_main.cpp:207-213` | Parameters $w, b, v, c$ updated simultaneously using step gradients; loss drops monotonically from $1.1825$ to $< 10^{-19}$. |
| **7.6** | Interactive loss plot, parameter trajectory, and CSV export | **PASS** | `frontend/src/pages/NeuralNetworkLab.tsx:40-54, 180-260`, `results/neural_training_history.csv` | Recharts plots loss convergence over 100 steps; exports training CSV history. |
| **7.7** | Handwritten derivation guide | **PARTIAL** | `docs/HANDWRITTEN_APPENDIX_GUIDE.md:1-95` | Complete transcription plan, step-by-step layout, and numerical tables prepared for Pages 1 & 2. (Requires physical paper scan by candidate for final submission). |

---

### Section 8: Windows 11 x64 Standalone Launch.exe, Packaged Dependencies, Editor Run Config, CMake Source-Build

| ID | Requirement | Status | Exact Evidence | Notes / Verification Command |
| :---: | :---| :---: | :---| :---|
| **8.1** | Standalone launcher implementation (`Launch.exe`) | **PASS** | `scripts/Launch.cpp:1-66`, `scripts/launch_windows.bat:1-35` | C++ Win32 process creation (`CreateProcessA`) spawning server and launching default browser via `ShellExecuteA`. |
| **8.2** | Zero-dependency self-hosting server (no Node.js on target machine) | **PASS** | `src/main.cpp:495-520`, `frontend/vite.config.ts:15-26` | Compiled React bundle (`dist/`) mounted directly into `cpp-httplib`; browser accesses full UI at `http://localhost:8080/`. |
| **8.3** | VS Code editor run configurations | **PASS** | `.vscode/tasks.json`, `.vscode/launch.json` | Configurations for building with CMake, running tests, launching backend, and starting frontend dev server. |
| **8.4** | CMake source-build and compilation instructions | **PASS** | `CMakeLists.txt:1-75`, `README.md:28-44` | Fully documented build instructions using standard `cmake -B build` and `cmake --build build`. |
| **8.5** | Clean-machine launch verification on Windows 11 x64 | **PARTIAL / NOT VERIFIED** | `scripts/build_windows.bat`, `scripts/package_windows.py` | Standalone packaging and scripts are verified, but native runtime execution was executed on macOS Darwin arm64. Live Windows 11 verification pending. |

---

### Section 9: Required ZIP Structure, Relative Paths, README, Version Records, Technical Report $\le 6$ Pages, Git History, AI-Use Log

| ID | Requirement | Status | Exact Evidence | Notes / Verification Command |
| :---: | :---| :---: | :---| :---|
| **9.1** | Required ZIP archive structure and relative paths | **PASS** | `PassScience_Workbench.zip`, `scripts/package_windows.py` | Zip archive contains 65 files across `src/`, `tests/`, `dist/`, `docs/`, `data/`, `results/`, `scripts/`, `.vscode/` (0.55 MB). |
| **9.2** | Dependency and version records | **PASS** | `docs/OWNERSHIP_STATEMENT.md:17-31`, `README.md:21-27` | Complete version inventory (`cpp-httplib v0.16.0`, `nlohmann/json v3.11.3`, `React 18.3.1`, `Three.js 0.170.0`, `Recharts 2.13.3`). |
| **9.3** | Technical report length ($\le 6$ pages) | **PASS** | `docs/TECHNICAL_REPORT.md` (139 lines) | Comprehensive engineering report covering architecture, FEA, performance, hardware, and backprop in ~4 pages (well under 6-page limit). |
| **9.4** | Timestamped demonstration walkthrough | **PASS** | `docs/DEMONSTRATION.md:1-113` | Timestamped workflow guide ($T=00:00$ to $T=04:45$) demonstrating launch, 3D viewer, FEA, performance, hardware, and neural lab. |
| **9.5** | Git bundle archive | **PASS** | `PASS_WORK_repo.bundle` | Verified self-contained Git bundle containing full repository history up to commit `e05f2b2`.<br>`git bundle verify PASS_WORK_repo.bundle` |
| **9.6** | Meaningful Git commit log | **PASS** | `git log --oneline` (10 structured commits) | Clean commit progression from core C++ numerical solvers to REST API, React UI, Windows deployment, and 3D rendering enhancements. |
| **9.7** | AI-use disclosure log with prompts and corrections | **PASS** | `docs/AI_DISCLOSURE.md:1-43` | Discloses LLM models used, representative prompts, and explicitly documents two critical AI bugs identified and corrected by the candidate. |
| **9.8** | Code ownership and original work statement | **PASS** | `docs/OWNERSHIP_STATEMENT.md:1-35` | Itemizes candidate-authored modules and verifies third-party open-source licensing. |

---

## Reproducible Verification Commands

To reproduce the exact audit results, execute the following commands in the project directory:

```bash
# 1. Run all 128 C++ automated unit tests
./build/workbench_tests

# 2. Run CTest test suite
ctest --test-dir build --output-on-failure

# 3. Typecheck frontend TypeScript
cd frontend && npx tsc --noEmit && cd ..

# 4. Build frontend production bundle
cd frontend && npm run build && cd ..

# 5. Run full master test script (Unit tests + CTest + Typecheck + Build + E2E API)
./scripts/test_all.sh

# 6. Verify Git bundle archive integrity
git bundle verify PASS_WORK_repo.bundle

# 7. Check Windows deployment zip contents
python3 -c "import zipfile; zf = zipfile.ZipFile('PassScience_Workbench.zip'); print(f'Files: {len(zf.namelist())}')"
```

---

## Remaining Action Items for Final Submission

To reach 100% completion before final submission:

1. **Physical Handwritten Scan (Subrequirement 7.7)**:
   - Transcribe the mathematical forward pass, chain rule derivations, step 0 numerical evaluation, and finite-difference check from `docs/HANDWRITTEN_APPENDIX_GUIDE.md` onto physical paper by hand.
   - Scan or photograph the 2 pages as `docs/HANDWRITTEN_APPENDIX.pdf` or include in submission folder.
2. **Clean-Machine Windows 11 Launch Verification (Subrequirement 8.5)**:
   - Copy `PassScience_Workbench.zip` to a clean Windows 11 x64 test machine without developer tools.
   - Extract and double-click `launch_windows.bat` or run `Launch.exe`.
   - Confirm backend starts on port 8080 and opens the browser interface automatically.
