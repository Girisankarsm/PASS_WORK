#!/usr/bin/env python3
"""
Package Unified Engineering Workbench for Windows Deployment.
Creates:
  1. A standalone 'release/' directory structured for zero-configuration execution.
  2. CandidateID_Workbench_windows_x64.zip (Standalone Windows runtime bundle).
  3. CandidateID_Workbench.zip (Comprehensive source and runtime bundle).
"""

import os
import sys
import zipfile
import shutil

CANDIDATE_ID = "PassScience"
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RELEASE_DIR = os.path.join(BASE_DIR, "release")
STANDALONE_ZIP = os.path.join(BASE_DIR, f"{CANDIDATE_ID}_Workbench_windows_x64.zip")
FULL_ZIP = os.path.join(BASE_DIR, f"{CANDIDATE_ID}_Workbench.zip")

def build_standalone_release_dir():
    print(f"\n[1/3] Assembling standalone Windows release directory at: {RELEASE_DIR}")
    if os.path.exists(RELEASE_DIR):
        shutil.rmtree(RELEASE_DIR)
    os.makedirs(RELEASE_DIR, exist_ok=True)
    os.makedirs(os.path.join(RELEASE_DIR, "logs"), exist_ok=True)

    # 1. Launcher and helper batch scripts
    for script in ["Start-Workbench.bat", "Stop-Workbench.bat", "README-Windows.txt", "LICENSE"]:
        src = os.path.join(BASE_DIR, script)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(RELEASE_DIR, script))
            print(f"  + script:  {script}")

    # 2. Check for Windows binary executables if compiled
    exe_candidates = [
        os.path.join(BASE_DIR, "build", "Release", "workbench_server.exe"),
        os.path.join(BASE_DIR, "build", "workbench_server.exe"),
        os.path.join(BASE_DIR, "workbench_server.exe"),
        os.path.join(BASE_DIR, "bin", "workbench_server.exe"),
    ]
    for exe in exe_candidates:
        if os.path.exists(exe):
            shutil.copy2(exe, os.path.join(RELEASE_DIR, "workbench_server.exe"))
            print(f"  + binary:  workbench_server.exe (from {os.path.relpath(exe, BASE_DIR)})")
            break

    launch_candidates = [
        os.path.join(BASE_DIR, "build", "Release", "Launch.exe"),
        os.path.join(BASE_DIR, "build", "Launch.exe"),
        os.path.join(BASE_DIR, "Launch.exe"),
    ]
    for exe in launch_candidates:
        if os.path.exists(exe):
            shutil.copy2(exe, os.path.join(RELEASE_DIR, "Launch.exe"))
            shutil.copy2(exe, os.path.join(RELEASE_DIR, "UnifiedEngineeringWorkbench.exe"))
            print(f"  + binary:  Launch.exe & UnifiedEngineeringWorkbench.exe")
            break

    # 3. Production Frontend bundle
    frontend_dist = os.path.join(BASE_DIR, "frontend", "dist")
    if not os.path.exists(frontend_dist) or not os.path.exists(os.path.join(frontend_dist, "index.html")):
        print("  [ERROR] Frontend dist not found! Please run 'npm run build' inside frontend/.")
        sys.exit(1)
    
    shutil.copytree(frontend_dist, os.path.join(RELEASE_DIR, "dist"))
    print(f"  + assets:  dist/ (React 18 + Vite production assets)")

    # 4. Verified Datasets (data/)
    data_dir = os.path.join(BASE_DIR, "data")
    if os.path.exists(data_dir):
        shutil.copytree(data_dir, os.path.join(RELEASE_DIR, "data"), ignore=shutil.ignore_patterns(".DS_Store"))
        print(f"  + data:    data/ (STL models and verified temperature CSVs)")

    # 5. Build scripts for building from source if user desires
    scripts_dest = os.path.join(RELEASE_DIR, "scripts")
    os.makedirs(scripts_dest, exist_ok=True)
    for s in ["build_windows.bat", "launch_windows.bat"]:
        src = os.path.join(BASE_DIR, "scripts", s)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(scripts_dest, s))
            print(f"  + helper:  scripts/{s}")

def create_zip(archive_path, source_dir, description):
    print(f"\nCreating {description} -> {os.path.basename(archive_path)}...")
    with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(source_dir):
            for f in files:
                if f.startswith('.') and f != ".gitignore":
                    continue
                full_path = os.path.join(root, f)
                rel_path = os.path.relpath(full_path, source_dir)
                zf.write(full_path, rel_path)
    size_mb = os.path.getsize(archive_path) / (1024 * 1024)
    print(f"  -> Generated {os.path.basename(archive_path)} ({size_mb:.2f} MB)")

def create_full_archive():
    print(f"\n[3/3] Creating complete deployment archive: {os.path.basename(FULL_ZIP)}")
    include_paths = [
        ("CMakeLists.txt", "CMakeLists.txt"),
        ("README.md", "README.md"),
        ("README-Windows.txt", "README-Windows.txt"),
        ("Start-Workbench.bat", "Start-Workbench.bat"),
        ("Stop-Workbench.bat", "Stop-Workbench.bat"),
        ("LICENSE", "LICENSE"),
        (".gitignore", ".gitignore"),
        ("src", "src"),
        ("include", "include"),
        ("tests", "tests"),
        ("data", "data"),
        ("docs", "docs"),
        ("scripts", "scripts"),
        (".vscode", ".vscode"),
        ("release", "release"),
        ("frontend/dist", "dist"),
        ("frontend/package.json", "frontend/package.json"),
        ("frontend/tsconfig.json", "frontend/tsconfig.json"),
        ("frontend/vite.config.ts", "frontend/vite.config.ts"),
        ("frontend/src", "frontend/src"),
        ("frontend/index.html", "frontend/index.html"),
        ("results", "results"),
    ]
    with zipfile.ZipFile(FULL_ZIP, 'w', zipfile.ZIP_DEFLATED) as zf:
        for src_rel, dst_rel in include_paths:
            src_full = os.path.join(BASE_DIR, src_rel)
            if os.path.isfile(src_full):
                zf.write(src_full, dst_rel)
            elif os.path.isdir(src_full):
                for root, dirs, files in os.walk(src_full):
                    for f in files:
                        if f.startswith('.') and f != ".gitignore":
                            continue
                        f_full = os.path.join(root, f)
                        rel_in_dir = os.path.relpath(f_full, src_full)
                        arc_name = os.path.join(dst_rel, rel_in_dir)
                        zf.write(f_full, arc_name)
    size_mb = os.path.getsize(FULL_ZIP) / (1024 * 1024)
    print(f"  -> Generated {os.path.basename(FULL_ZIP)} ({size_mb:.2f} MB)")

def package():
    print("==================================================================")
    print("      Unified Engineering Workbench - Windows Deployment Packager")
    print("==================================================================")
    build_standalone_release_dir()
    create_zip(STANDALONE_ZIP, RELEASE_DIR, "Standalone Windows Release Package")
    create_full_archive()

    print("\n==================================================================")
    print("  Packaging Completed Successfully!")
    print(f"  Standalone Folder:  {RELEASE_DIR}")
    print(f"  Standalone ZIP:     {STANDALONE_ZIP}")
    print(f"  Full Project ZIP:   {FULL_ZIP}")
    print("==================================================================")

if __name__ == "__main__":
    package()
