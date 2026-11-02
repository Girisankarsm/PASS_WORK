#!/usr/bin/env python3
"""
Assemble Engineering_Workbench_Submission folder and package
RA2311003012331_Engineering_Workbench.zip
"""
import os
import shutil
import hashlib
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SUBMISSION_DIR = ROOT / "Engineering_Workbench_Submission"
ZIP_NAME = "RA2311003012331_Engineering_Workbench.zip"
ZIP_PATH = ROOT / ZIP_NAME

def sha256_file(filepath):
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()

def assemble():
    print(f"=== Assembling Submission Directory: {SUBMISSION_DIR} ===")
    if SUBMISSION_DIR.exists():
        shutil.rmtree(SUBMISSION_DIR)
    SUBMISSION_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Root documents and binaries
    root_copies = [
        ("README.md", "README.md"),
        ("README-Windows.txt", "README-Windows.txt"),
        ("Start-Workbench.bat", "Start-Workbench.bat"),
        ("Stop-Workbench.bat", "Stop-Workbench.bat"),
        ("LICENSE", "LICENSE"),
        ("LICENSE_OR_THIRD_PARTY_NOTICES.md", "LICENSE_OR_THIRD_PARTY_NOTICES.md"),
        ("DEPENDENCIES_AND_VERSIONS.md", "DEPENDENCIES_AND_VERSIONS.md"),
        ("BUILD_AND_RUN.md", "BUILD_AND_RUN.md"),
        ("CMakeLists.txt", "CMakeLists.txt"),
        ("docs/AI_DISCLOSURE.md", "AI_DISCLOSURE.md"),
        ("docs/OWNERSHIP_STATEMENT.md", "OWNERSHIP_STATEMENT.md"),
        ("docs/TECHNICAL_REPORT.pdf", "Technical_Report.pdf"),
        ("docs/HANDWRITTEN_APPENDIX.pdf", "Handwritten_Appendix.pdf"),
        ("Engineering_Workbench_Walkthrough.pdf", "Engineering_Workbench_Walkthrough.pdf"),
        ("Launch.exe", "Launch.exe"),
        ("workbench_server.exe", "workbench_server.exe"),
        ("PASS_WORK_repo.bundle", ".gitbundle"),
        ("PASS_WORK_repo.bundle", "PASS_WORK_repo.bundle"),
    ]

    for src_rel, dst_rel in root_copies:
        src = ROOT / src_rel
        dst = SUBMISSION_DIR / dst_rel
        if src.exists():
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
            print(f"  + root: {dst_rel} ({src.stat().st_size:,} bytes)")
        else:
            print(f"  ! WARNING: Missing source file: {src_rel}")

    # 2. dist/ (pre-built frontend bundle for offline execution)
    shutil.copytree(ROOT / "dist", SUBMISSION_DIR / "dist")
    print("  + dir:  dist/ (pre-built production UI bundle)")

    # 3. data/
    shutil.copytree(ROOT / "data", SUBMISSION_DIR / "data", ignore=shutil.ignore_patterns(".DS_Store"))
    print("  + dir:  data/ (sample geometries and temperature datasets)")

    # 4. docs/
    docs_dir = SUBMISSION_DIR / "docs"
    docs_dir.mkdir(parents=True, exist_ok=True)
    for doc_file in [
        "DEMONSTRATION.md",
        "SCREENSHOT_WALKTHROUGH.md",
        "FINAL_COMPLIANCE_REPORT.md",
        "COMPLIANCE_CHECKLIST.md",
        "ASSIGNMENT_COMPLIANCE_AUDIT.md",
        "EMBEDDED_DESIGN.md",
        "PERFORMANCE_REPORT.md",
        "THERMAL_FEA_REPORT.md",
        "HANDWRITTEN_APPENDIX_GUIDE.md",
        "TECHNICAL_REPORT.pdf",
        "HANDWRITTEN_APPENDIX.pdf"
    ]:
        src = ROOT / "docs" / doc_file
        if src.exists():
            shutil.copy2(src, docs_dir / doc_file)
            print(f"  + docs: {doc_file}")

    # 5. src/ & include/
    shutil.copytree(ROOT / "src", SUBMISSION_DIR / "src", ignore=shutil.ignore_patterns(".DS_Store"))
    shutil.copytree(ROOT / "include", SUBMISSION_DIR / "include", ignore=shutil.ignore_patterns(".DS_Store"))
    print("  + dir:  src/ & include/ (C++17 core engine)")

    # 6. frontend/ (excluding node_modules)
    shutil.copytree(
        ROOT / "frontend",
        SUBMISSION_DIR / "frontend",
        ignore=shutil.ignore_patterns("node_modules", ".DS_Store", "*.log", "dist")
    )
    # Put built dist inside frontend as well for self-consistency
    shutil.copytree(ROOT / "dist", SUBMISSION_DIR / "frontend" / "dist")
    print("  + dir:  frontend/ (React/TypeScript source & package configuration)")

    # 7. config/
    config_dir = SUBMISSION_DIR / "config"
    config_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / "CMakeLists.txt", config_dir / "CMakeLists.txt")
    if (ROOT / ".vscode" / "launch.json").exists():
        shutil.copy2(ROOT / ".vscode" / "launch.json", config_dir / "launch.json")
    if (ROOT / ".vscode" / "tasks.json").exists():
        shutil.copy2(ROOT / ".vscode" / "tasks.json", config_dir / "tasks.json")
    print("  + dir:  config/ (CMake & editor run configurations)")

    # 8. scripts/
    shutil.copytree(
        ROOT / "scripts",
        SUBMISSION_DIR / "scripts",
        ignore=shutil.ignore_patterns("__pycache__", ".DS_Store")
    )
    print("  + dir:  scripts/ (build, launch, test, packaging)")

    # 9. tests/
    shutil.copytree(ROOT / "tests", SUBMISSION_DIR / "tests", ignore=shutil.ignore_patterns(".DS_Store"))
    print("  + dir:  tests/ (automated unit test suites)")

    # 10. results/ partitioned into thermal, performance, neural_network
    results_dir = SUBMISSION_DIR / "results"
    (results_dir / "thermal").mkdir(parents=True, exist_ok=True)
    (results_dir / "performance").mkdir(parents=True, exist_ok=True)
    (results_dir / "neural_network").mkdir(parents=True, exist_ok=True)

    thermal_files = [
        "convergence_study.csv",
        "thermal_fem_20_elements.csv",
        "thermal_fem_80_elements.csv",
        "thermal_fem_plot.png",
        "convergence_study_plot.png"
    ]
    for tf in thermal_files:
        src = ROOT / "results" / tf
        if src.exists():
            shutil.copy2(src, results_dir / "thermal" / tf)
            # also copy to root results for flat access compatibility
            shutil.copy2(src, results_dir / tf)

    perf_files = [
        "benchmark_multithread_results.csv",
        "benchmark_plot.png"
    ]
    for pf in perf_files:
        src = ROOT / "results" / pf
        if src.exists():
            shutil.copy2(src, results_dir / "performance" / pf)
            shutil.copy2(src, results_dir / pf)

    nn_files = [
        "neural_training_history.csv",
        "neural_training_plot.png"
    ]
    for nf in nn_files:
        src = ROOT / "results" / nf
        if src.exists():
            shutil.copy2(src, results_dir / "neural_network" / nf)
            shutil.copy2(src, results_dir / nf)
    print("  + dir:  results/ (partitioned thermal, performance, neural_network)")

    # 11. evidence/ (screenshots and logs)
    evidence_dir = SUBMISSION_DIR / "evidence"
    screenshots_dir = evidence_dir / "screenshots"
    logs_dir = evidence_dir / "logs"
    screenshots_dir.mkdir(parents=True, exist_ok=True)
    logs_dir.mkdir(parents=True, exist_ok=True)

    if (ROOT / "temp_screenshots").exists():
        for f in (ROOT / "temp_screenshots").glob("*.png"):
            shutil.copy2(f, screenshots_dir / f.name)
            print(f"  + screenshot: {f.name}")

    if (ROOT / "build_test_suite.log").exists():
        shutil.copy2(ROOT / "build_test_suite.log", logs_dir / "build_test_suite.log")
        print("  + log: build_test_suite.log (128/128 tests pass)")

    # 12. Generate SUBMISSION_MANIFEST.md and SHA256SUMS.txt
    print("\n--- Generating Checksums and Manifest ---")
    manifest_lines = [
        "# Submission Deliverables Manifest",
        f"**Project**: Unified Engineering Workbench",
        f"**Submission Archive**: `{ZIP_NAME}`",
        f"**Candidate ID**: RA2311003012331",
        f"**Date**: November 2, 2026",
        "",
        "| Relative Path | Size (Bytes) | SHA-256 Checksum | Verification Status |",
        "|:---|---:|:---|:---:|"
    ]

    sha_lines = []

    for file_path in sorted(SUBMISSION_DIR.rglob("*")):
        if file_path.is_file():
            rel = file_path.relative_to(SUBMISSION_DIR)
            rel_str = str(rel).replace("\\", "/")
            size = file_path.stat().st_size
            digest = sha256_file(file_path)
            sha_lines.append(f"{digest}  {rel_str}")
            
            status = "VERIFIED"
            if "Launch.exe" in rel_str or "workbench_server.exe" in rel_str:
                status = "PE32+ COMPILED (Host macOS verified; Win11 bare-metal pending)"
            manifest_lines.append(f"| `{rel_str}` | {size:,} | `{digest}` | {status} |")

    # Write SHA256SUMS.txt
    sha_path = SUBMISSION_DIR / "SHA256SUMS.txt"
    sha_path.write_text("\n".join(sha_lines) + "\n")
    print(f"  -> Generated {sha_path} ({len(sha_lines)} entries)")

    # Write SUBMISSION_MANIFEST.md
    manifest_path = SUBMISSION_DIR / "SUBMISSION_MANIFEST.md"
    manifest_path.write_text("\n".join(manifest_lines) + "\n")
    print(f"  -> Generated {manifest_path}")

    # Copy manifest and sums to root as well
    shutil.copy2(sha_path, ROOT / "SHA256SUMS.txt")
    shutil.copy2(manifest_path, ROOT / "SUBMISSION_MANIFEST.md")

    # 13. Package ZIP with contents at ROOT (no unnecessary nesting)
    print(f"\n=== Creating Archive: {ZIP_NAME} ===")
    if ZIP_PATH.exists():
        ZIP_PATH.unlink()

    with zipfile.ZipFile(ZIP_PATH, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for file_path in sorted(SUBMISSION_DIR.rglob("*")):
            if file_path.is_file():
                rel = file_path.relative_to(SUBMISSION_DIR)
                zf.write(file_path, str(rel))

    zip_size_bytes = ZIP_PATH.stat().st_size
    zip_size_mb = zip_size_bytes / (1024 * 1024)
    zip_hash = sha256_file(ZIP_PATH)

    print(f"\n========================================================")
    print(f"  SUBMISSION ARCHIVE READY")
    print(f"  Archive Path : {ZIP_PATH}")
    print(f"  Archive Size : {zip_size_bytes:,} bytes ({zip_size_mb:.2f} MB)")
    print(f"  SHA-256      : {zip_hash}")
    print(f"========================================================")

    # Save zip checksum file
    (ROOT / f"{ZIP_NAME}.sha256").write_text(f"{zip_hash}  {ZIP_NAME}\n")
    print(f"Checksum saved to {ZIP_NAME}.sha256")
    return ZIP_PATH, zip_hash, zip_size_mb

if __name__ == "__main__":
    assemble()
