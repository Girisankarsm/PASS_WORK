# Dependencies and Versions

**Project**: Unified Engineering Workbench  
**Candidate ID**: RA2311003012331  
**Assessment**: Pass Science Works R&D Internship 2026–2027  
**Date**: November 2, 2026  

---

## 1. System Requirements

| Environment | Supported Operating Systems | Architecture | Compilers / Toolchains |
|:---|:---|:---:|:---|
| **Development Host** | macOS Sonoma / Sequoia (Darwin 27+) | ARM64 (Apple Silicon) | Apple Clang 16+ / 21+ (`-std=c++17 -O2`) |
| **Windows Deployment** | Windows 10 / 11 (21H2+) | x86-64 | MSVC 2022 (v143) or MinGW-w64 GCC 14+ |
| **Linux Deployment** | Ubuntu 22.04 LTS / Debian 12 / Fedora 39 | x86-64 / ARM64 | GCC 11+ or Clang 14+ (`-std=c++17 -O2`) |

---

## 2. C++17 Backend Dependencies

All C++ dependencies are header-only and statically compiled; no dynamic shared objects or system packages are required at runtime:

| Dependency | Exact Version | Type | Origin | License |
|:---|:---:|:---:|:---|:---:|
| **C++ Standard** | `C++17` | Standard | ISO/IEC 14882:2017 | N/A |
| **cpp-httplib** | `0.16.0` | Header-only | Single header in `include/httplib.h` | MIT |
| **nlohmann/json** | `3.11.3` | Header-only | Single header via CMake FetchContent | MIT |
| **WinSock2** (Windows only) | System SDK | OS Library | Windows 10/11 built-in (`ws2_32.lib`) | Microsoft EULA |
| **pthreads** (Linux only) | System POSIX | OS Library | `pthread` system runtime | LGPL |

---

## 3. Frontend Stack Dependencies

The production frontend is pre-built into `dist/` (static HTML/CSS/JS), meaning Node.js and npm are **not** required for running the application.

For rebuilding from source, the exact versions from `frontend/package-lock.json` are:

| Package | Locked Version | Role | License |
|:---|:---:|:---|:---:|
| **node** | `>= 18.0.0` (Tested on Node 20.x) | JavaScript Runtime | MIT |
| **react** | `18.3.1` | UI Library | MIT |
| **react-dom** | `18.3.1` | React DOM renderer | MIT |
| **typescript** | `5.5.3` | Static Type Checker | Apache-2.0 |
| **vite** | `6.4.5` | Bundler & Dev Server | MIT |
| **@vitejs/plugin-react** | `4.3.1` | Vite React Plugin | MIT |
| **three** | `0.170.0` | 3D Graphics Engine | MIT |
| **@types/three** | `0.170.0` | Three.js Type Definitions | MIT |
| **@react-three/fiber** | `8.17.10` | React Three.js Reconciler | MIT |
| **@react-three/drei** | `9.117.3` | Three.js Visual Helpers | MIT |
| **recharts** | `2.13.3` | Scientific Charts | MIT |
| **lucide-react** | `0.460.0` | UI Icons | ISC |

---

## 4. Build Tooling & Automation

| Tool | Version / Standard | Purpose |
|:---|:---:|:---|
| **CMake** | `>= 3.20` | Native C++ build generator |
| **Python** | `>= 3.9` | Packaging and plotting scripts (`generate_plots.py`, `package_submission.py`) |
| **ReportLab** | `5.1.0` | Walkthrough PDF documentation generator |
| **Matplotlib** | `3.7+` | Scientific plot generation for verification results |
