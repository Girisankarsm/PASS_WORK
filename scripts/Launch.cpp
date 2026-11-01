#if defined(_WIN32)
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <shellapi.h>
#endif

#include <iostream>
#include <string>
#include <chrono>
#include <thread>
#include <cstdlib>

int main(int argc, char* argv[]) {
    std::cout << "======================================================" << std::endl;
    std::cout << "      Pass Science Works - Unified Engineering Workbench" << std::endl;
    std::cout << "======================================================" << std::endl;
    std::cout << "Starting C++ simulation backend..." << std::endl;

#if defined(_WIN32)
    STARTUPINFOA si;
    PROCESS_INFORMATION pi;
    ZeroMemory(&si, sizeof(si));
    si.cb = sizeof(si);
    ZeroMemory(&pi, sizeof(pi));

    char cmd[] = "workbench_server.exe 8080";
    BOOL success = CreateProcessA(
        NULL, cmd, NULL, NULL, FALSE, CREATE_NO_WINDOW, NULL, NULL, &si, &pi
    );

    if (!success) {
        // Try looking in bin/ or current directory
        char cmd2[] = "bin\\workbench_server.exe 8080";
        success = CreateProcessA(NULL, cmd2, NULL, NULL, FALSE, CREATE_NO_WINDOW, NULL, NULL, &si, &pi);
    }

    if (!success) {
        std::cerr << "Error: Could not launch workbench_server.exe!" << std::endl;
        std::cerr << "Ensure workbench_server.exe is located in the same directory." << std::endl;
        std::cout << "Press Enter to exit..." << std::endl;
        std::cin.get();
        return 1;
    }

    std::cout << "Backend running on PID: " << pi.dwProcessId << std::endl;
    std::cout << "Waiting for server to initialize..." << std::endl;
    std::this_thread::sleep_for(std::chrono::milliseconds(1500));

    std::cout << "Opening Workbench interface at http://localhost:8080..." << std::endl;
    ShellExecuteA(NULL, "open", "http://localhost:8080", NULL, NULL, SW_SHOWNORMAL);

    std::cout << "\nWorkbench is running! Close this window to stop the server." << std::endl;
    WaitForSingleObject(pi.hProcess, INFINITE);
    CloseHandle(pi.hProcess);
    CloseHandle(pi.hThread);
#else
    std::cout << "Launching Unix server..." << std::endl;
    int ret = std::system("./build/workbench_server 8080 &");
    std::this_thread::sleep_for(std::chrono::milliseconds(1200));
    std::system("open http://localhost:8080 2>/dev/null || xdg-open http://localhost:8080 2>/dev/null");
    std::cout << "Server active at http://localhost:8080" << std::endl;
#endif

    return 0;
}
