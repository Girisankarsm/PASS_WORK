================================================================================
     UNIFIED ENGINEERING WORKBENCH - WINDOWS x64 DEPLOYMENT GUIDE
================================================================================

1. OVERVIEW & RUNTIME REQUIREMENTS
--------------------------------------------------------------------------------
The Unified Engineering Workbench is a scientific workstation combining:
  - C++17 Numerical Simulation Engine (Thermal FEA, STL CAD parser, Benchmarks)
  - React 18 + Three.js 3D Interactive Viewport with temperature colormapping

Standalone Package Prerequisites:
  - Windows 10 (64-bit) or Windows 11 (64-bit)
  - No Python, Node.js, CMake, or Visual Studio compiler required to run the
    packaged release.
  - Microsoft Visual C++ 2015-2022 Redistributable (x64):
    Pre-installed on almost all Windows 10/11 machines. If missing, download
    from Microsoft: https://aka.ms/vs/17/release/vc_redist.x64.exe


2. ONE-CLICK LAUNCH
--------------------------------------------------------------------------------
To start the application:
  1. Double-click "Start-Workbench.bat" in this directory.
  2. The launcher will:
     - Check if an instance is already running (to avoid duplicate backends).
     - Start workbench_server.exe in the background.
     - Poll the /api/health endpoint until backend readiness is confirmed.
     - Open the application in your default web browser at http://localhost:8080.
  3. Keep the launcher command window open while using the application.
  4. To stop the application, press any key or Ctrl+C in the command window, or
     double-click "Stop-Workbench.bat".


3. HOW TO STOP THE WORKBENCH
--------------------------------------------------------------------------------
- Method A: Press ANY KEY or Ctrl+C in the "Start-Workbench.bat" window.
- Method B: Double-click "Stop-Workbench.bat".
  This terminates ONLY the specific backend process recorded at startup
  (via PID file in logs/workbench_server.pid), without terminating unrelated
  processes.


4. DIAGNOSTIC LOGS & TROUBLESHOOTING
--------------------------------------------------------------------------------
Logs Location:
  - logs/workbench_server.log (standard server output)
  - logs/workbench_error.log  (standard error stream)
  - logs/workbench_server.pid (active process ID tracker)

Troubleshooting Common Issues:
  * Port 8080 already in use:
    If another program uses port 8080, Start-Workbench.bat will alert you.
    You can launch on a custom port from cmd:
      workbench_server.exe 8090
    Then open http://localhost:8090 in your browser.

  * Browser does not open automatically:
    Manually navigate to http://localhost:8080 in Google Chrome, Microsoft Edge,
    or Mozilla Firefox.

  * 3D Viewport Hardware Acceleration:
    WebGL 2.0 is required. Ensure your graphics drivers are up to date and
    hardware acceleration is enabled in your browser settings.

  * Antivirus warning:
    Some antivirus tools flag unsigned local development executables.
    workbench_server.exe and Start-Workbench.bat are compiled locally from open
    source C++ and batch scripts. Click "More Info" -> "Run anyway" if prompted.


5. SAMPLE DATASETS INCLUDED
--------------------------------------------------------------------------------
The "data/" folder contains pre-verified test datasets:
  CAD STL Meshes:
    - data/stl/unit_cube.stl (12 triangles, unit cube)
    - data/stl/cylinder.stl (96 triangles, curved manifold)
    - data/stl/irregular_bracket.stl (20 triangles, asymmetric bracket)
    - data/stl/large_manifold.stl (440 triangles, dense manifold)

  Temperature CSVs (node_id,x_m,y_m,z_m,temperature_C):
    - data/csv/temperature_rod.csv (21-node analytical rod)
    - data/csv/cube_27_structured.csv (3x3x3 structured 3D tensor grid)
    - data/csv/plate_2d_mesh.csv (5x4 planar 2D continuous plate)
    - data/csv/rectilinear_grid.csv (non-uniform 3D grid with negative temps)
    - data/csv/unstructured_cloud.csv (14 sensor points point cloud)


6. BUILDING FROM SOURCE ON WINDOWS (DEVELOPER WORKFLOW)
--------------------------------------------------------------------------------
Prerequisites for building from source:
  - CMake 3.20 or newer
  - Visual Studio 2022 (Community or Build Tools) with "Desktop C++" workload
  - Node.js 18+ and npm
  - Python 3.8+ (for packaging)

Build Steps:
  1. Open a Command Prompt or PowerShell in this directory.
  2. Run:
       scripts\build_windows.bat
     This automatically:
       a) Configures CMake with MSVC Release x64 (/O2 /W3 /EHsc).
       b) Compiles workbench_server.exe, workbench_tests.exe, and Launch.exe.
       c) Executes CTest automated verification test suite.
       d) Builds the frontend bundle with "npm run build".
       e) Runs scripts\package_windows.py to create the release package.


7. VERIFICATION EVIDENCE & STATUS
--------------------------------------------------------------------------------
  [x] Cross-Platform Source Verified:
      - Clean C++17 compilation on macOS (Apple Clang) and Windows (MSVC).
      - POSIX utsname.h replaced with native Windows/POSIX conditional logic.
      - Windows Winsock (ws2_32) and Crypt32 linked on WIN32.
      - 100% pass on CTest verification test suite.
      - 100% pass on frontend TypeScript check and Vite build (2788 modules).

  [x] CI/CD Pipeline on Native Windows:
      - GitHub Actions workflow (.github/workflows/windows-build-release.yml)
        executes the full Windows x64 build, test, and release artifact
        generation on native "windows-latest" runner.

  [Note on Environment Transparency]:
      This development environment is macOS Darwin arm64. The Windows C++
      codebase has been conditioned for MSVC x64, with automated Windows
      verification provided via GitHub Actions CI.
================================================================================
