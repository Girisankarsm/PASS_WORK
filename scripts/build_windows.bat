@echo off
echo ========================================================
echo   Building Unified Engineering Workbench on Windows x64
echo ========================================================

REM 1. Configure CMake with Visual Studio / MSVC
echo [1/4] Configuring CMake (Release)...
cmake -B build -G "Visual Studio 17 2022" -A x64 -DCMAKE_BUILD_TYPE=Release
if %ERRORLEVEL% NEQ 0 (
    echo Fallback to default CMake generator...
    cmake -B build -DCMAKE_BUILD_TYPE=Release
)

REM 2. Build C++ Targets
echo [2/4] Building C++ Backend and Tests...
cmake --build build --config Release --parallel
if %ERRORLEVEL% NEQ 0 (
    echo Error building C++ binaries!
    pause
    exit /b %ERRORLEVEL%
)

REM 3. Compile Standalone Launcher
echo [3/4] Compiling Standalone Launch.exe...
cl /EHsc /O2 /Fe:build\Release\Launch.exe scripts\Launch.cpp Shell32.lib User32.lib
if %ERRORLEVEL% NEQ 0 (
    echo Note: cl.exe not in PATH or using CMake-built launcher.
)

REM 4. Build Frontend Bundle
echo [4/4] Building Frontend Bundle...
cd frontend
call npm install
call npm run build
cd ..

echo.
echo ========================================================
echo   Windows Build Succeeded!
echo   Run scripts\package_windows.py to create CandidateID_Workbench.zip
echo ========================================================
pause
