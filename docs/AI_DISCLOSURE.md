# AI-Use Disclosure & Verification Statement

**Project**: Unified Engineering Workbench  
**Assessment**: Pass Science Works R&D Internship 2026–2027  
**Candidate ID**: RA2311003012331  
**Repository**: `PASS_WORK`  
**Date of Audit**: November 2, 2026  

---

## 1. AI Tools and Model Names

Based on recorded conversation transcripts, workspace logs, and repository git commit history, the following AI tools and foundational model architectures were utilized during development:

| Tool / Environment | Model Name(s) | Primary Tasks & Domain |
|:---|:---|:---|
| **Google Antigravity Agentic IDE** | Multi-model agent orchestration harness | Multi-file codebase navigation, terminal test execution, build script execution, diff application. |
| **Google Gemini** | Gemini 3.8 Flash / Gemini 2.5 Flash | C++17 scaffolding, React/TypeScript UI component implementation, CSS token design, initial API routing. |
| **Anthropic Claude** | Claude Sonnet 3.7 / Claude Opus 4.6 | Mathematical gradient derivation cross-checking, FEA formulation review, edge-case unit test design, packaging scripts. |

---

## 2. Tasks for Which AI Assistance Was Used

AI assistance was selectively utilized for the following structured tasks:

1. **C++17 Boilerplate & Structure**: Initial interface drafting for `src/main.cpp` using `httplib.h` and `nlohmann/json.hpp`.
2. **Frontend UI Scaffolding**: React 18 component scaffolding (`GeometryViewer.tsx`, `ThermalAnalysis.tsx`, `PerformanceLab.tsx`, `NeuralNetworkLab.tsx`, `HardwareIntegration.tsx`) and Three.js canvas integration.
3. **Drafting Verification Scripts**: Generation of Python test runners (`scripts/test_geometry_classification.mjs`, `scripts/test_multi_file_mesh.mjs`, `scripts/generate_plots.py`).
4. **Documentation Structure**: Formatting compliance matrices, markdown templates, and report outlines.

All algorithmic logic, mathematical models, boundary condition implementations, and build systems were independently inspected, verified, and debugged by the developer.

---

## 3. Representative Prompts, AI Outputs, and Developer Decisions

### Prompt Record 1: 1D Thermal FEA Boundary Condition Assembly
* **Prompt Issued**:
  > *"Implement 1D steady-state heat conduction finite element method in C++17. Use 2-node linear elements with length h. Assemble element stiffness matrix (kA/h)*[[1,-1],[-1,1]] and element load vector (qAh/2)*[1,1] into a global system. Apply Dirichlet boundary conditions T(0)=T0 and T(L)=TL. Solve with Gaussian elimination."*
* **AI Output Provided**:
  The model returned a stiffness assembly loop and applied Dirichlet boundary conditions by adjusting the load vector for columns corresponding to fixed nodes ($F[j] \leftarrow F[j] - K[j][n] \cdot T_L$), but omitted zeroing the off-diagonal entries in row $n$ ($K[n][n-1]$ remained non-zero).
* **Defect Identified**:
  During Gaussian elimination, the non-zero entry $K[n][n-1] = -k A / h$ coupled the boundary equation with the adjacent interior node, producing an erroneous right boundary temperature of $T(L) \approx 20.73^\circ\text{C}$ instead of the prescribed Dirichlet boundary condition $20.0^\circ\text{C}$.
* **Developer Decision & Modification**:
  The developer identified the failing test `[BC: T(L)=20°C]` in `tests/test_main.cpp`. The developer corrected the implementation by zeroing the entire row $n$ ($K[n][j] = 0, \forall j \neq n$), setting $K[n][n] = 1.0$, and assigning $F[n] = T_L$. This restored boundary precision to machine epsilon ($< 10^{-10\ \circ}\text{C}$).

---

### Prompt Record 2: Windows Subsystem Header Macro Collision
* **Prompt Issued**:
  > *"Implement native Windows x64 launcher wrapper Launch.cpp and update main.cpp to support Windows networking with winsock2.h."*
* **AI Output Provided**:
  The model generated `#include <windows.h>` and `#include <winsock2.h>` in `src/main.cpp` and `scripts/Launch.cpp` without header sanitization.
* **Defect Identified**:
  Standard Windows SDK headers define `#define ERROR 0` via `wingdi.h`. This macro collided with the scoped enum in `src/hardware/hw_mock.hpp`:
  ```cpp
  enum class DeviceStatus { DISCONNECTED, CONNECTING, CONNECTED, ERROR };
  ```
  The compiler expanded `DeviceStatus::ERROR` to `DeviceStatus::0`, causing severe syntax errors during MinGW compilation (`error: expected identifier before numeric constant`).
* **Developer Decision & Modification**:
  The developer immediately sanitized the macro namespace by adding `#ifdef ERROR \n #undef ERROR \n #endif` in both `src/hardware/hw_mock.hpp` and `src/main.cpp`. The build succeeded with 0 warnings.

---

### Prompt Record 3: Missing Header in Standalone Launcher
* **Prompt Issued**:
  > *"Write scripts/Launch.cpp to locate workbench_server.exe in multiple candidate folders and execute it using CreateProcessA."*
* **AI Output Provided**:
  The model defined a vector of candidate search paths:
  `std::vector<std::filesystem::path> candidates = { ... };`
  without including the `<vector>` header.
* **Defect Identified**:
  Under GCC 16.2 / MinGW-w64, the compilation failed with:
  `error: 'vector' is not a member of 'std'`.
* **Developer Decision & Modification**:
  Developer added `#include <vector>` to `scripts/Launch.cpp` and verified compilation with `x86_64-w64-mingw32-g++`.

---

### Prompt Record 4: Multithreaded Benchmark Workload Determinism
* **Prompt Issued**:
  > *"Write a C++17 function that runs a batch of 1D FEA thermal problems in parallel using std::thread. Use a fixed seed=42 for reproducibility. Generate n_cases problems with random k and q. Divide them across p threads using static partitioning. Run 1 warm-up batch, then 5 measured repetitions. Report median time, speedup, and efficiency."*
* **AI Output Provided**:
  The model placed the random parameter generation loop inside each worker thread's entry function.
* **Defect Identified**:
  Because each worker thread advanced the random number engine independently, the problem sets generated during the serial baseline and the 4-thread parallel run differed. The serial-versus-parallel numerical agreement check produced large discrepancies because completely different physical problems were being compared.
* **Developer Decision & Modification**:
  The developer refactored the design to generate all test cases deterministically in a single pre-run phase (`generate_cases(n_cases, seed)`). The pre-generated vector was passed as a read-only constant reference (`const std::vector<CaseParams>&`) to worker threads. Numerical agreement between serial and parallel solvers immediately converged to machine round-off: $\Delta T \le 1.4 \times 10^{-15\ \circ}\text{C}$.

---

## 4. Challenge Test: Analytical Gradient Verification

To evaluate AI accuracy on non-trivial mathematical derivations, a deliberate challenge test was conducted on the neural network backpropagation equations:

* **Challenge Prompt**:
  > *"Derive the analytical gradient $\frac{\partial J}{\partial w}$ for the single-neuron regression network: $J = \frac{1}{2}(\hat{y} - y)^2$, $\hat{y} = v h + c$, $h = \tanh(w x + b)$ using the chain rule, and calculate its numerical value for $x=0.5, w=1.0, b=0.0, v=1.0, c=0.0, y=1.0$."*
* **Model Output**:
  The model derived the correct symbolic expression:
  $$\frac{\partial J}{\partial w} = (\hat{y} - y) \cdot v \cdot (1 - h^2) \cdot x$$
  However, in its manual numerical scratch evaluation, the model calculated $h = \tanh(0.5) \approx 0.462117$, but incorrectly evaluated $1 - h^2$ as $0.7842$ instead of $0.7864$, producing an arithmetic discrepancy in the final decimal.
* **Independent Verification**:
  The developer implemented a central finite-difference gradient check in `src/neural/nn_backprop.hpp` with step size $\epsilon = 10^{-6}$:
  $$\left| \frac{\partial J}{\partial w}_{\text{analytical}} - \frac{J(w+\epsilon) - J(w-\epsilon)}{2\epsilon} \right|$$
  Automated unit testing in `tests/test_main.cpp` proved the C++ implementation agreed with finite differences to within $3.8 \times 10^{-11}$, validating the implemented code and exposing the AI's arithmetic scratchpad error.

---

## 5. Independent Verification Evidence Summary

Every feature, solver, parser, and pipeline in the repository was subjected to independent compilation and automated testing:

| Verification Target | Command / Tool | Actual Outcome | Status |
|:---|:---|:---|:---:|
| C++ Backend Unit Tests | `./build/workbench_tests` | 128 / 128 tests passed (0 failures) | **PASS** |
| CTest Harness | `ctest --test-dir build` | 1 / 1 test target passed (0.33s) | **PASS** |
| Geometric Grid Classification | `node scripts/test_geometry_classification.mjs` | 8 / 8 tests passed | **PASS** |
| Multi-File Mesh & Face Assembler | `node scripts/test_multi_file_mesh.mjs` | 12 / 12 tests passed | **PASS** |
| TypeScript Compiler Checks | `npx tsc --noEmit` (in `frontend/`) | Exited with code 0 (zero errors) | **PASS** |
| Vite Frontend Production Bundle | `npm run build` (in `frontend/`) | 2790 modules transformed, 15 bundles emitted | **PASS** |
| End-to-End API Integration | `./scripts/test_all.sh` | Health, STL, Thermal, Neural, HW endpoints HTTP 200 | **PASS** |
| Windows PE32+ Compilation | `x86_64-w64-mingw32-g++` | `Launch.exe` (1.1 MB) and `workbench_server.exe` (1.6 MB) | **PASS** |

---

## 6. Limitations and Unresolved Uncertainties

1. **Windows 11 Physical Clean-Machine Runtime Execution**:
   - `STATUS`: `NOT DOCUMENTED — DEVELOPER CONFIRMATION REQUIRED`
   - *Rationale*: While `Launch.exe` and `workbench_server.exe` were successfully cross-compiled into native PE32+ x86-64 executables, statically linked, and verified via `objdump` on macOS, physical double-click execution on a bare-metal Windows 11 machine without developer tools remains unverified on the local host. (Automated verification on Windows is configured in `.github/workflows/windows-build-release.yml`).
2. **Physical Embedded Hardware Testing**:
   - `STATUS`: `NOT DOCUMENTED — AS DESIGNED (SIMULATED)`
   - *Rationale*: No physical STM32 MCU, Xilinx FPGA, or J-Link hardware debugger was connected. All device drivers in `src/hardware/hw_mock.hpp` are explicitly labeled and documented as `[SIMULATED]`.
