#if defined(_WIN32)
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <shellapi.h>
#include <winsock2.h>
#include <ws2tcpip.h>
#pragma comment(lib, "ws2_32.lib")
#pragma comment(lib, "Shell32.lib")
#pragma comment(lib, "User32.lib")
#endif

#include <iostream>
#include <string>
#include <chrono>
#include <thread>
#include <cstdlib>
#include <filesystem>
#include <fstream>

#if defined(_WIN32)
static PROCESS_INFORMATION g_backend_pi;
static bool g_backend_started = false;

BOOL WINAPI ConsoleCtrlHandler(DWORD ctrlType) {
    if (g_backend_started && g_backend_pi.hProcess != NULL) {
        std::cout << "\nTerminating Workbench backend process..." << std::endl;
        TerminateProcess(g_backend_pi.hProcess, 0);
        CloseHandle(g_backend_pi.hProcess);
        CloseHandle(g_backend_pi.hThread);
        g_backend_started = false;
    }
    return FALSE;
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

    // Short timeout for connect check
    u_long mode = 1;
    ioctlsocket(sock, FIONBIO, &mode);
    connect(sock, reinterpret_cast<sockaddr*>(&addr), sizeof(addr));

    fd_set fdwrite;
    FD_ZERO(&fdwrite);
    FD_SET(sock, &fdwrite);
    timeval tv;
    tv.tv_sec = 0;
    tv.tv_usec = 200000; // 200 ms

    bool connected = (select(0, NULL, &fdwrite, NULL, &tv) > 0);
    closesocket(sock);
    WSACleanup();
    return connected;
}
#endif

int main(int argc, char* argv[]) {
    std::cout << "======================================================" << std::endl;
    std::cout << "      Pass Science Works - Unified Engineering Workbench" << std::endl;
    std::cout << "======================================================" << std::endl;

    int port = 8080;
    if (argc > 1) {
        try { port = std::stoi(argv[1]); } catch (...) {}
    }

    std::string app_url = "http://localhost:" + std::to_string(port);

#if defined(_WIN32)
    SetConsoleCtrlHandler(ConsoleCtrlHandler, TRUE);

    // Resolve own directory
    char exePath[MAX_PATH];
    GetModuleFileNameA(NULL, exePath, MAX_PATH);
    std::filesystem::path app_dir = std::filesystem::path(exePath).parent_path();

    // Check if backend is already running
    if (is_port_responding(port)) {
        std::cout << "[INFO] Workbench backend is already running on " << app_url << std::endl;
        std::cout << "Opening default web browser..." << std::endl;
        ShellExecuteA(NULL, "open", app_url.c_str(), NULL, NULL, SW_SHOWNORMAL);
        std::cout << "\nWorkbench interface opened. Press Enter to exit launcher." << std::endl;
        std::cin.get();
        return 0;
    }

    // Locate workbench_server.exe
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
        std::cerr << "\n[ERROR] Could not find workbench_server.exe!" << std::endl;
        std::cerr << "Searched in: " << app_dir.string() << std::endl;
        std::cerr << "Please build the project first or use the standalone release." << std::endl;
        std::cout << "\nPress Enter to exit..." << std::endl;
        std::cin.get();
        return 1;
    }

    std::cout << "Starting C++ simulation backend: " << server_exe.string() << std::endl;

    STARTUPINFOA si;
    ZeroMemory(&si, sizeof(si));
    si.cb = sizeof(si);
    ZeroMemory(&g_backend_pi, sizeof(g_backend_pi));

    std::string cmd = "\"" + server_exe.string() + "\" " + std::to_string(port);
    std::string workingDir = app_dir.string();

    BOOL success = CreateProcessA(
        NULL,
        const_cast<char*>(cmd.c_str()),
        NULL,
        NULL,
        FALSE,
        0,
        NULL,
        workingDir.c_str(),
        &si,
        &g_backend_pi
    );

    if (!success) {
        std::cerr << "[ERROR] CreateProcess failed (error " << GetLastError() << ")" << std::endl;
        std::cout << "Press Enter to exit..." << std::endl;
        std::cin.get();
        return 1;
    }

    g_backend_started = true;
    std::cout << "Backend running (PID: " << g_backend_pi.dwProcessId << ")" << std::endl;
    std::cout << "Waiting for server initialization..." << std::endl;

    // Poll health up to 10 seconds
    bool ready = false;
    for (int i = 0; i < 20; ++i) {
        std::this_thread::sleep_for(std::chrono::milliseconds(500));
        if (is_port_responding(port)) {
            ready = true;
            break;
        }
    }

    if (!ready) {
        std::cerr << "[WARNING] Backend not responding on " << app_url << " yet." << std::endl;
    } else {
        std::cout << "Backend ready! Opening " << app_url << " in browser..." << std::endl;
    }

    ShellExecuteA(NULL, "open", app_url.c_str(), NULL, NULL, SW_SHOWNORMAL);

    std::cout << "\n======================================================" << std::endl;
    std::cout << " Workbench is active at " << app_url << std::endl;
    std::cout << " Press Ctrl+C or close this window to stop the server." << std::endl;
    std::cout << "======================================================" << std::endl;

    WaitForSingleObject(g_backend_pi.hProcess, INFINITE);

    CloseHandle(g_backend_pi.hProcess);
    CloseHandle(g_backend_pi.hThread);
    g_backend_started = false;

#else
    std::cout << "Launching Unix server..." << std::endl;
    int ret = std::system("./build/workbench_server 8080 &");
    (void)ret;
    std::this_thread::sleep_for(std::chrono::milliseconds(1200));
    std::system("open http://localhost:8080 2>/dev/null || xdg-open http://localhost:8080 2>/dev/null");
    std::cout << "Server active at http://localhost:8080" << std::endl;
#endif

    return 0;
}
