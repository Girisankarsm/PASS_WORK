@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
set "ROOT_DIR=%SCRIPT_DIR%..\"

if exist "%ROOT_DIR%Launch.exe" (
    start "" "%ROOT_DIR%Launch.exe" %*
) else if exist "%ROOT_DIR%Start-Workbench.bat" (
    call "%ROOT_DIR%Start-Workbench.bat" %*
) else (
    echo Error: Neither Launch.exe nor Start-Workbench.bat found at %ROOT_DIR%
    pause
    exit /b 1
)
