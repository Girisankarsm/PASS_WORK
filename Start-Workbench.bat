@echo off
setlocal EnableDelayedExpansion

title Unified Engineering Workbench - Launcher
echo ========================================================
echo   Unified Engineering Workbench (Windows x64)
echo ========================================================

REM 1. Canonical working directory resolution
set "APP_DIR=%~dp0"
cd /d "%APP_DIR%"

set "PORT=8080"
set "URL=http://localhost:%PORT%"
set "LOG_DIR=%APP_DIR%logs"
set "LOG_FILE=%LOG_DIR%\workbench_server.log"
set "ERR_LOG_FILE=%LOG_DIR%\workbench_error.log"
set "PID_FILE=%LOG_DIR%\workbench_server.pid"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

REM 2. Check if Workbench is already running
powershell -NoProfile -Command "try { $r = Invoke-RestMethod -Uri '%URL%/api/health' -TimeoutSec 1; if ($r.success) { exit 0 } } catch {}; exit 1" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [INFO] Workbench backend is already running on %URL%.
    echo Opening application in default web browser...
    start "" "%URL%"
    echo.
    echo Workbench is active in your browser.
    echo To stop the running server, execute Stop-Workbench.bat.
    echo.
    pause
    exit /b 0
)

REM 3. Locate backend executable
set "SERVER_EXE="
if exist "%APP_DIR%workbench_server.exe" (
    set "SERVER_EXE=%APP_DIR%workbench_server.exe"
) else if exist "%APP_DIR%bin\workbench_server.exe" (
    set "SERVER_EXE=%APP_DIR%bin\workbench_server.exe"
) else if exist "%APP_DIR%build\Release\workbench_server.exe" (
    set "SERVER_EXE=%APP_DIR%build\Release\workbench_server.exe"
) else if exist "%APP_DIR%build\workbench_server.exe" (
    set "SERVER_EXE=%APP_DIR%build\workbench_server.exe"
) else if exist "%APP_DIR%UnifiedEngineeringWorkbench.exe" (
    set "SERVER_EXE=%APP_DIR%UnifiedEngineeringWorkbench.exe"
)

if "%SERVER_EXE%"=="" (
    echo [ERROR] Could not find workbench_server.exe in "%APP_DIR%".
    echo.
    echo If you downloaded the source repository:
    echo   Run "scripts\build_windows.bat" to compile the C++ backend and frontend.
    echo If you downloaded the binary release:
    echo   Ensure workbench_server.exe is in the same folder as Start-Workbench.bat.
    echo.
    pause
    exit /b 1
)

REM 4. Check for port collision with unrelated process
netstat -ano | findstr /R /C:":%PORT% " >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [WARNING] Port %PORT% appears to be in use by an existing process.
    echo Attempting to verify if it responds to Workbench health endpoint...
    powershell -NoProfile -Command "try { $r = Invoke-RestMethod -Uri '%URL%/api/health' -TimeoutSec 1; if ($r.success) { exit 0 } } catch {}; exit 1" >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        echo [INFO] Existing instance confirmed. Opening browser...
        start "" "%URL%"
        exit /b 0
    ) else (
        echo [ERROR] Port %PORT% is occupied by an unrelated program.
        echo Please free port %PORT% or run:
        echo   "%SERVER_EXE%" ^<different-port^>
        echo.
        pause
        exit /b 1
    )
)

REM 5. Start the backend process and track its specific PID
echo [1/3] Starting C++ simulation backend...
echo Binary: "%SERVER_EXE%"
echo Log:    "%LOG_FILE%"

REM Clear previous log
echo --- Workbench Startup %DATE% %TIME% --- > "%LOG_FILE%"

powershell -NoProfile -Command "$proc = Start-Process -FilePath '%SERVER_EXE%' -ArgumentList '%PORT%' -WorkingDirectory '%APP_DIR%' -RedirectStandardOutput '%LOG_FILE%' -RedirectStandardError '%ERR_LOG_FILE%' -PassThru; if ($proc) { $proc.Id | Out-File -FilePath '%PID_FILE%' -Encoding ASCII; exit 0 } else { exit 1 }"

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to start backend process.
    if exist "%ERR_LOG_FILE%" type "%ERR_LOG_FILE%"
    pause
    exit /b 1
)

set /p BACKEND_PID=<"%PID_FILE%"
echo [INFO] Backend spawned with PID: %BACKEND_PID%

REM 6. Wait for backend health confirmation (up to 15 seconds)
echo [2/3] Waiting for backend readiness at %URL%/api/health...

set "READY=0"
for /L %%i in (1,1,30) do (
    powershell -NoProfile -Command "try { $r = Invoke-RestMethod -Uri '%URL%/api/health' -TimeoutSec 1; if ($r.success) { exit 0 } } catch {}; exit 1" >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        set "READY=1"
        goto :BackendReady
    )
    timeout /t 1 /nobreak >nul
)

:BackendReady
if "%READY%"=="0" (
    echo [ERROR] Backend failed to respond at %URL%/api/health within 15 seconds!
    echo.
    echo --- Diagnostic Log (%LOG_FILE%) ---
    if exist "%LOG_FILE%" type "%LOG_FILE%"
    if exist "%ERR_LOG_FILE%" type "%ERR_LOG_FILE%"
    echo.
    echo Shutting down stalled process (PID: %BACKEND_PID%)...
    taskkill /PID %BACKEND_PID% /F >nul 2>&1
    if exist "%PID_FILE%" del "%PID_FILE%"
    pause
    exit /b 1
)

REM 7. Launch application in default web browser
echo [3/3] Backend confirmed healthy! Opening %URL% in default browser...
start "" "%URL%"

echo.
echo ========================================================
echo   Unified Engineering Workbench is RUNNING!
echo   URL:  %URL%
echo   PID:  %BACKEND_PID%
echo   Logs: %LOG_FILE%
echo ========================================================
echo.
echo Press ANY KEY or Ctrl+C to stop the Workbench server...
pause >nul

echo.
echo Stopping Workbench backend (PID: %BACKEND_PID%)...
taskkill /PID %BACKEND_PID% /F >nul 2>&1
if exist "%PID_FILE%" del "%PID_FILE%"
echo [OK] Backend stopped cleanly.
exit /b 0
