# Build and Run Guide

**Project**: Unified Engineering Workbench  
**Candidate ID**: RA2311003012331  
**Assessment**: Pass Science Works R&D Internship 2026–2027  
**Date**: November 2, 2026  

---

## 1. Quick Launch (Zero-Config Reviewer Workflow)

### Windows x64
No compilation, Node.js, Python, or compiler required.

1. Extract the submission ZIP into any directory (paths with spaces are supported).
2. Double-click **`Launch.exe`** (or execute `Start-Workbench.bat`).
3. The launcher automatically:
   - Verifies port 8080 availability.
   - Spawns the self-hosted C++17 simulation backend (`workbench_server.exe`) in the background.
   - Polls `/api/health` until ready.
   - Automatically opens your default web browser to:
     ```
     http://localhost:8080
     ```
4. **Shutdown**: Close the launcher window or run `Stop-Workbench.bat`.

---

## 2. macOS & Linux Build and Run

### Prerequisites
- Clang (Apple Clang 16+) or GCC 11+
- CMake 3.20+
- (Optional for rebuilding frontend): Node.js 18+

### Step-by-Step Commands

1. **Build C++ Backend & Tests**:
   ```bash
   ./scripts/build_macos.sh
   ```
   *(Or manual CMake build)*:
   ```bash
   cmake -B build -DCMAKE_BUILD_TYPE=Release
   cmake --build build --parallel
   ```

2. **Execute Full Test Suite**:
   ```bash
   ./scripts/test_all.sh
   ```
   Runs 128 C++ unit assertions, CTest, geometry classification tests, and end-to-end API integration tests.

3. **Launch the Workbench**:
   ```bash
   ./scripts/run_macos.sh
   ```
   Starts `workbench_server` on port 8080 and opens `http://localhost:8080` in your default browser.

---

## 3. Rebuilding the Frontend (Optional)

The pre-built production bundle is already provided in `dist/`. If you wish to rebuild the frontend from source:

```bash
cd frontend
npm ci
npx tsc --noEmit
npm run build
cd ..
```
The compiled assets will update in `frontend/dist/` and will be self-hosted by the C++ backend.

---

## 4. Troubleshooting & FAQ

* **Port 8080 Already in Use**:
  Specify a custom port:
  ```bash
  # Windows
  Launch.exe 8090
  # macOS / Linux
  ./build/workbench_server 8090
  ```
  Open `http://localhost:8090` in your browser.

* **Child Process Cleanup on Windows**:
  `Launch.exe` uses Win32 Job Objects (`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`). When `Launch.exe` is closed, the Windows kernel automatically terminates `workbench_server.exe`.
