@echo off
setlocal
echo ========================================================
echo   Pass Science Works - Unified Engineering Workbench
echo ========================================================
echo Starting C++ Backend Server on http://localhost:8080...

REM Check if workbench_server.exe exists
if exist "workbench_server.exe" (
    start "" /b workbench_server.exe 8080
) else if exist "build\Release\workbench_server.exe" (
    start "" /b build\Release\workbench_server.exe 8080
) else if exist "build\workbench_server.exe" (
    start "" /b build\workbench_server.exe 8080
) else (
    echo Error: workbench_server.exe not found!
    echo Please run build_windows.bat first.
    pause
    exit /b 1
)

REM Wait 1.5 seconds for server to start
timeout /t 2 /nobreak >nul

REM Open default browser
echo Opening workbench in default web browser...
start http://localhost:8080

echo.
echo Workbench is active at http://localhost:8080
echo Close this command window or press Ctrl+C to terminate the workbench.
echo.
pause
