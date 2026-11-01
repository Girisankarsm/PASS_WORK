#!/usr/bin/env python3
"""
Package Unified Engineering Workbench for Windows Deployment.
Creates: CandidateID_Workbench.zip containing:
 - Standalone frontend assets (dist/)
 - C++ server sources and build configurations
 - Windows launch scripts (launch_windows.bat, Launch.cpp)
 - Automated tests and sample data (unit_cube.stl, temperature_rod.csv)
 - Technical reports, verification evidence, and compliance documentation
"""

import os
import sys
import zipfile
import shutil

CANDIDATE_ID = "PassScience"
ZIP_NAME = f"{CANDIDATE_ID}_Workbench.zip"
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def package():
    print(f"Creating Windows standalone deployment package: {ZIP_NAME}...")
    zip_path = os.path.join(BASE_DIR, ZIP_NAME)
    
    # Ensure frontend dist exists
    dist_dir = os.path.join(BASE_DIR, "frontend", "dist")
    if not os.path.exists(dist_dir):
        print("Frontend dist not found! Please run 'npm run build' inside frontend/.")
        sys.exit(1)
        
    include_paths = [
        ("CMakeLists.txt", "CMakeLists.txt"),
        ("README.md", "README.md"),
        (".gitignore", ".gitignore"),
        ("src", "src"),
        ("include", "include"),
        ("tests", "tests"),
        ("data", "data"),
        ("docs", "docs"),
        ("scripts", "scripts"),
        (".vscode", ".vscode"),
        ("frontend/dist", "dist"),
        ("frontend/package.json", "frontend/package.json"),
        ("frontend/tsconfig.json", "frontend/tsconfig.json"),
        ("frontend/vite.config.ts", "frontend/vite.config.ts"),
        ("frontend/src", "frontend/src"),
        ("frontend/index.html", "frontend/index.html"),
        ("results", "results"),
    ]
    
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for src_rel, dst_rel in include_paths:
            src_full = os.path.join(BASE_DIR, src_rel)
            if os.path.isfile(src_full):
                zf.write(src_full, dst_rel)
                print(f"  + file: {dst_rel}")
            elif os.path.isdir(src_full):
                for root, dirs, files in os.walk(src_full):
                    for f in files:
                        if f.startswith('.'):
                            continue
                        f_full = os.path.join(root, f)
                        rel_in_dir = os.path.relpath(f_full, src_full)
                        arc_name = os.path.join(dst_rel, rel_in_dir)
                        zf.write(f_full, arc_name)
                print(f"  + dir:  {dst_rel}")
                
    size_mb = os.path.getsize(zip_path) / (1024 * 1024)
    print(f"\nSuccessfully created {ZIP_NAME} ({size_mb:.2f} MB)")
    print(f"Location: {zip_path}")

if __name__ == "__main__":
    package()
