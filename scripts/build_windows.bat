@echo off
setlocal EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
set "ROOT_DIR=%SCRIPT_DIR%..\"
cd /d "%ROOT_DIR%"

echo ========================================================
echo   Building Unified Engineering Workbench on Windows x64
echo   Root: %ROOT_DIR%
echo ========================================================

REM 1. Check CMake
where cmake >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] CMake is not found in PATH!
    echo Please install CMake from https://cmake.org/download/ and add to PATH.
    pause
    exit /b 1
)

REM 2. Configure CMake with Visual Studio 2022 or default
echo [1/5] Configuring CMake (Release x64)...
cmake -B build -G "Visual Studio 17 2022" -A x64 -DCMAKE_BUILD_TYPE=Release
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] Fallback to default CMake generator...
    cmake -B build -DCMAKE_BUILD_TYPE=Release
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] CMake configuration failed.
        pause
        exit /b 1
    )
)

REM 3. Build C++ Targets
echo [2/5] Building C++ Backend, Tests, and Launcher...
cmake --build build --config Release --parallel
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] C++ build failed!
    pause
    exit /b %ERRORLEVEL%
)

REM 4. Run C++ Test Suite
echo [3/5] Executing C++ Automated Verification Test Suite...
ctest --test-dir build -C Release --output-on-failure
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Some CTest tests failed. Inspect output above.
) else (
    echo [OK] All C++ backend verification tests passed!
)

REM 5. Build Frontend Production Bundle
echo [4/5] Building Frontend Production Bundle...
where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    cd frontend
    if not exist "node_modules" (
        echo Installing frontend dependencies...
        call npm ci || call npm install
    )
    call npm run build
    cd ..
) else (
    if exist "frontend\dist\index.html" (
        echo [INFO] Node.js not detected in PATH, but pre-built frontend\dist exists. Using existing bundle.
    ) else (
        echo [WARNING] Node.js is not in PATH and frontend\dist is missing!
        echo Please install Node.js 18+ to build the frontend.
    )
)

REM 6. Package Standalone Windows Release
echo [5/5] Packaging Standalone Windows Release...
where python >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    python scripts\package_windows.py
) else (
    where py >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        py scripts\package_windows.py
    ) else (
        echo [INFO] Python not found in PATH. You can manually run scripts\package_windows.py once Python is available.
    )
)

echo.
echo ========================================================
echo   Windows Build and Packaging Completed!
echo   To launch the application: run Start-Workbench.bat
echo ========================================================
echo.
pause
