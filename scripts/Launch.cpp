#if defined(_WIN32)
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <shellapi.h>
#include <winsock2.h>
#include <ws2tcpip.h>
#ifdef ERROR
#undef ERROR
#endif
#pragma comment(lib, "ws2_32.lib")
#pragma comment(lib, "Shell32.lib")
#pragma comment(lib, "User32.lib")
#endif

#include <iostream>
#include <string>
#include <vector>
#include <chrono>
#include <thread>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <sstream>

#if defined(_WIN32)
static PROCESS_INFORMATION g_backend_pi;
static bool g_backend_started = false;
static HANDLE g_job_object = NULL;

static void cleanup_backend() {
    if (g_backend_started && g_backend_pi.hProcess != NULL) {
        std::cout << "\n[Shutdown] Terminating Workbench backend process..." << std::endl;
        TerminateProcess(g_backend_pi.hProcess, 0);
        WaitForSingleObject(g_backend_pi.hProcess, 2000);
        CloseHandle(g_backend_pi.hProcess);
        CloseHandle(g_backend_pi.hThread);
        g_backend_pi.hProcess = NULL;
        g_backend_pi.hThread = NULL;
        g_backend_started = false;
    }
    if (g_job_object != NULL) {
        CloseHandle(g_job_object);
        g_job_object = NULL;
    }
}

BOOL WINAPI ConsoleCtrlHandler(DWORD ctrlType) {
    switch (ctrlType) {
        case CTRL_C_EVENT:
        case CTRL_BREAK_EVENT:
        case CTRL_CLOSE_EVENT:
        case CTRL_LOGOFF_EVENT:
        case CTRL_SHUTDOWN_EVENT:
            cleanup_backend();
            return TRUE;
        default:
            return FALSE;
    }
}

static bool is_port_responding(int port) {
    WSADATA wsaData;
    if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) return false;

    SOCKET sock = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (sock == INVALID_SOCKET) {
        WSACleanup();
        return false;
    }

    sockaddr_in addr;
    addr.sin_family = AF_INET;
    addr.sin_port = htons(static_cast<u_short>(port));
    inet_pton(AF_INET, "127.0.0.1", &addr.sin_addr);

    u_long mode = 1;
    ioctlsocket(sock, FIONBIO, &mode);
    connect(sock, reinterpret_cast<sockaddr*>(&addr), sizeof(addr));

    fd_set fdwrite;
    FD_ZERO(&fdwrite);
    FD_SET(sock, &fdwrite);
    timeval tv;
    tv.tv_sec = 0;
    tv.tv_usec = 250000; // 250 ms timeout

    bool connected = (select(0, NULL, &fdwrite, NULL, &tv) > 0);
    closesocket(sock);
    WSACleanup();
    return connected;
}

static void show_error_dialog(const std::string& title, const std::string& message) {
    std::cerr << "\n[ERROR] " << title << "\n" << message << std::endl;
    MessageBoxA(NULL, message.c_str(), title.c_str(), MB_ICONERROR | MB_OK);
}
#endif

int main(int argc, char* argv[]) {
    std::cout << "======================================================" << std::endl;
    std::cout << "   Pass Science Works - Unified Engineering Workbench" << std::endl;
    std::cout << "======================================================" << std::endl;

    int port = 8080;
    bool open_browser = true;

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--no-browser") {
            open_browser = false;
        } else if (arg == "--port" && i + 1 < argc) {
            try { port = std::stoi(argv[++i]); } catch (...) {}
        } else {
            try { port = std::stoi(arg); } catch (...) {}
        }
    }

    std::string app_url = "http://localhost:" + std::to_string(port);

#if defined(_WIN32)
    // 1. Register console signal handler and atexit cleanup
    SetConsoleCtrlHandler(ConsoleCtrlHandler, TRUE);
    std::atexit(cleanup_backend);

    // 2. Resolve own directory relative to executable location (supports spaces & any CWD)
    wchar_t exePathW[MAX_PATH];
    GetModuleFileNameW(NULL, exePathW, MAX_PATH);
    std::filesystem::path app_dir = std::filesystem::path(exePathW).parent_path();

    // 3. Prevent duplicate instances: check if backend is already responding
    if (is_port_responding(port)) {
        std::cout << "[INFO] Workbench backend is already running on " << app_url << std::endl;
        if (open_browser) {
            std::cout << "Opening application in default web browser..." << std::endl;
            ShellExecuteA(NULL, "open", app_url.c_str(), NULL, NULL, SW_SHOWNORMAL);
        }
        std::cout << "\nWorkbench interface is active. Exiting launcher." << std::endl;
        return 0;
    }

    // 4. Locate workbench_server.exe relative to application directory
    std::vector<std::filesystem::path> candidates = {
        app_dir / "workbench_server.exe",
        app_dir / "bin" / "workbench_server.exe",
        app_dir / "build" / "Release" / "workbench_server.exe",
        app_dir / "build" / "workbench_server.exe",
        std::filesystem::current_path() / "workbench_server.exe"
    };

    std::filesystem::path server_exe;
    for (const auto& c : candidates) {
        if (std::filesystem::exists(c)) {
            server_exe = c;
            break;
        }
    }

    if (server_exe.empty()) {
        std::string err = "Could not find 'workbench_server.exe' in application directory:\n" +
                          app_dir.string() + "\n\n" +
                          "Please ensure workbench_server.exe is extracted in the same folder as Launch.exe.";
        show_error_dialog("Unified Engineering Workbench - Executable Missing", err);
        return 1;
    }

    // 5. Setup Windows Job Object to guarantee child cleanup on exit
    g_job_object = CreateJobObjectA(NULL, NULL);
    if (g_job_object != NULL) {
        JOBOBJECT_EXTENDED_LIMIT_INFORMATION jeli;
        ZeroMemory(&jeli, sizeof(jeli));
        jeli.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        SetInformationJobObject(g_job_object, JobObjectExtendedLimitInformation, &jeli, sizeof(jeli));
    }

    // 6. Launch backend process with CREATE_NO_WINDOW to avoid extra console popups
    std::cout << "[1/3] Starting C++ simulation backend: " << server_exe.filename().string() << std::endl;

    STARTUPINFOW si;
    ZeroMemory(&si, sizeof(si));
    si.cb = sizeof(si);
    ZeroMemory(&g_backend_pi, sizeof(g_backend_pi));

    // Quote server executable path to safely support paths with spaces
    std::wstring cmdW = L"\"" + server_exe.wstring() + L"\" " + std::to_wstring(port);
    std::wstring workingDirW = app_dir.wstring();

    std::vector<wchar_t> cmdBuffer(cmdW.begin(), cmdW.end());
    cmdBuffer.push_back(L'\0');

    // CREATE_NO_WINDOW prevents an extra console window from opening for the backend
    DWORD creationFlags = CREATE_NO_WINDOW;

    BOOL success = CreateProcessW(
        NULL,
        cmdBuffer.data(),
        NULL,
        NULL,
        FALSE,
        creationFlags,
        NULL,
        workingDirW.c_str(),
        &si,
        &g_backend_pi
    );

    if (!success) {
        DWORD errCode = GetLastError();
        std::string msg = "Failed to launch backend process.\nError Code: " + std::to_string(errCode);
        show_error_dialog("Unified Engineering Workbench - Launch Failed", msg);
        return 1;
    }

    g_backend_started = true;
    if (g_job_object != NULL) {
        AssignProcessToJobObject(g_job_object, g_backend_pi.hProcess);
    }

    std::cout << "      Backend running with PID: " << g_backend_pi.dwProcessId << std::endl;
    std::cout << "[2/3] Waiting for backend readiness at " << app_url << "..." << std::endl;

    // 7. Poll health up to 15 seconds (30 attempts x 500ms)
    bool ready = false;
    for (int i = 0; i < 30; ++i) {
        std::this_thread::sleep_for(std::chrono::milliseconds(500));

        // Check if process exited prematurely
        DWORD exitCode = 0;
        if (GetExitCodeProcess(g_backend_pi.hProcess, &exitCode) && exitCode != STILL_ACTIVE) {
            std::string msg = "The backend process exited unexpectedly during startup.\nExit Code: " +
                              std::to_string(exitCode) + "\n\n" +
                              "Please check if another application is already occupying port " + std::to_string(port);
            show_error_dialog("Unified Engineering Workbench - Startup Aborted", msg);
            cleanup_backend();
            return 1;
        }

        if (is_port_responding(port)) {
            ready = true;
            break;
        }
    }

    if (!ready) {
        std::string msg = "Backend did not respond on " + app_url + " within 15 seconds.\n" +
                          "Terminating unresponsive startup process.";
        show_error_dialog("Unified Engineering Workbench - Readiness Timeout", msg);
        cleanup_backend();
        return 1;
    }

    std::cout << "[3/3] Backend healthy! Serving UI and REST API." << std::endl;

    // 8. Open default browser
    if (open_browser) {
        std::cout << "Opening " << app_url << " in default web browser..." << std::endl;
        ShellExecuteA(NULL, "open", app_url.c_str(), NULL, NULL, SW_SHOWNORMAL);
    }

    std::cout << "\n======================================================" << std::endl;
    std::cout << " Workbench is active at: " << app_url << std::endl;
    std::cout << " Close this window or press Ctrl+C to stop the server." << std::endl;
    std::cout << "======================================================" << std::endl;

    // 9. Keep launcher alive until backend exits or user terminates
    WaitForSingleObject(g_backend_pi.hProcess, INFINITE);

    cleanup_backend();
    std::cout << "[Shutdown] Clean shutdown completed." << std::endl;

#else
    std::cout << "Launching Unix server..." << std::endl;
    int ret = std::system("./build/workbench_server 8080 &");
    (void)ret;
    std::this_thread::sleep_for(std::chrono::milliseconds(1200));
    if (open_browser) {
        std::system("open http://localhost:8080 2>/dev/null || xdg-open http://localhost:8080 2>/dev/null");
    }
    std::cout << "Server active at http://localhost:8080" << std::endl;
#endif

    return 0;
}
