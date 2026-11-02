@echo off
setlocal EnableDelayedExpansion

title Unified Engineering Workbench - Stopper
echo ========================================================
echo   Stopping Unified Engineering Workbench
echo ========================================================

set "APP_DIR=%~dp0"
set "PID_FILE=%APP_DIR%logs\workbench_server.pid"
set "KILLED=0"

REM 1. Stop by recorded PID if present
if exist "%PID_FILE%" (
    set /p BACKEND_PID=<"%PID_FILE%"
    if defined BACKEND_PID (
        echo Found recorded backend PID: !BACKEND_PID!
        taskkill /PID !BACKEND_PID! /T /F >nul 2>&1
        if !ERRORLEVEL! EQU 0 (
            echo [OK] Backend process (PID: !BACKEND_PID!) terminated cleanly.
            set "KILLED=1"
        )
    )
    del "%PID_FILE%" >nul 2>&1
)

REM 2. Fallback check for any stray workbench_server.exe instances in this directory
tasklist /FI "IMAGENAME eq workbench_server.exe" 2>nul | findstr /I "workbench_server.exe" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Terminating remaining workbench_server.exe processes...
    taskkill /IM workbench_server.exe /F >nul 2>&1
    set "KILLED=1"
)

if "%KILLED%"=="1" (
    echo [OK] All Unified Engineering Workbench processes stopped.
) else (
    echo [INFO] No active Unified Engineering Workbench process was found running.
)

if "%1"=="/quiet" exit /b 0

timeout /t 2 /nobreak >nul
exit /b 0
