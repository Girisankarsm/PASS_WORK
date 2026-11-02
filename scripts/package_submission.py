#!/usr/bin/env python3
"""
Package script for RA2311003012331_Workbench.zip submission archive.
Produces a clean, reviewer-ready ZIP with all required deliverables.
Run from the project root:  python3 scripts/package_submission.py
"""
import hashlib
import os
import subprocess
import sys
import zipfile
from pathlib import Path

# ─── Configuration ────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
OUTPUT_NAME = "RA2311003012331_Workbench.zip"
OUTPUT_PATH = ROOT / OUTPUT_NAME

# Prefix inside the ZIP (all files live under this folder)
ZIP_PREFIX = "RA2311003012331_Workbench"

# ─── Exclusion rules ──────────────────────────────────────────────────────────
EXCLUDE_DIRS = {
    ".git", ".github", "node_modules", "__pycache__",
    "build",           # compiled objects (too large; source + CMake is enough)
    "release",         # intermediate packaging artifacts
    ".DS_Store",
}

# Relative paths (from root) to always exclude, even if not caught by dir/suffix rules
EXCLUDE_REL_PATHS = {
    "frontend/node_modules",  # ~400 MB — reviewers run 'npm install'; dist/ is bundled
}

EXCLUDE_SUFFIXES = {
    ".o", ".a", ".so", ".dylib", ".exe", ".obj",
    ".cache", ".tsbuildinfo", ".bak", ".orig",
    ".DS_Store",
}

EXCLUDE_FILENAMES = {
    # Old redundant zips (not the submission archive itself)
    "PassScience_Workbench.zip",
    "PassScience_Workbench_windows_x64.zip",
    OUTPUT_NAME,           # don't include the archive in itself
}

# Files/dirs that MUST appear in the archive (checked after build)
REQUIRED_PATHS = [
    # Core source
    "src/main.cpp",
    "src/core/thermal_solver.hpp",
    "src/geometry/stl_parser.hpp",
    "src/performance/benchmark.hpp",
    "src/hardware/hw_mock.hpp",
    "src/neural/nn_backprop.hpp",
    # Build
    "CMakeLists.txt",
    # Tests
    "tests/test_main.cpp",
    # Frontend source (not built artifacts; dist/ included separately)
    "frontend/src/App.tsx",
    "frontend/src/lib/api.ts",
    "frontend/src/types/api.ts",
    "frontend/package.json",
    # Compiled frontend bundle (self-hosting)
    "frontend/dist/index.html",
    # Data
    "data/stl/unit_cube.stl",
    "data/csv/temperature_rod.csv",
    "data/README.md",
    # Results (raw CSV)
    "results/convergence_study.csv",
    "results/benchmark_multithread_results.csv",
    "results/neural_training_history.csv",
    "results/thermal_fem_20_elements.csv",
    # Results (plots)
    "results/convergence_study_plot.png",
    "results/benchmark_plot.png",
    "results/neural_training_plot.png",
    "results/thermal_fem_plot.png",
    # Windows launch
    "Start-Workbench.bat",
    "Stop-Workbench.bat",
    "scripts/Launch.cpp",
    "scripts/launch_windows.bat",
    "scripts/build_windows.bat",
    # macOS launch
    "scripts/run_macos.sh",
    # Documentation
    "README.md",
    "README-Windows.txt",
    "docs/TECHNICAL_REPORT.md",
    "docs/AI_DISCLOSURE.md",
    "docs/OWNERSHIP_STATEMENT.md",
    "docs/DEMONSTRATION.md",
    "docs/SCREENSHOT_WALKTHROUGH.md",
    "docs/HANDWRITTEN_APPENDIX_GUIDE.md",
    "docs/THERMAL_FEA_REPORT.md",
    "docs/PERFORMANCE_REPORT.md",
    "docs/EMBEDDED_DESIGN.md",
    "docs/ASSIGNMENT_COMPLIANCE_AUDIT.md",
    "docs/COMPLIANCE_CHECKLIST.md",
    # VS Code run config
    ".vscode/tasks.json",
    ".vscode/launch.json",
    # Git bundle
    "PASS_WORK_repo.bundle",
    # License
    "LICENSE",
    # Test scripts
    "scripts/test_all.sh",
    "scripts/test_geometry_classification.mjs",
    "scripts/test_multi_file_mesh.mjs",
    # Plot generator
    "scripts/generate_plots.py",
    # Package tool (for reproducibility)
    "scripts/package_submission.py",
]

# ─── Helpers ──────────────────────────────────────────────────────────────────

def should_exclude(path: Path, root: Path) -> bool:
    """Return True if this path should be skipped from the archive."""
    rel = path.relative_to(root)
    parts = rel.parts
    rel_str = "/".join(parts)

    # Exclude specific top-level dirs/files
    if parts[0] in EXCLUDE_DIRS:
        return True

    # Exclude by relative path prefix (e.g. frontend/node_modules)
    for excl in EXCLUDE_REL_PATHS:
        if rel_str == excl or rel_str.startswith(excl + "/"):
            return True

    # Exclude build/ subtree BUT allow frontend/dist (compiled bundle needed)
    if "build" in parts and parts[0] != "frontend":
        return True

    # Exclude node_modules anywhere in the tree
    if "node_modules" in parts:
        return True

    # Exclude file suffixes
    if path.is_file() and path.suffix in EXCLUDE_SUFFIXES:
        return True

    # Exclude specific filenames
    if path.name in EXCLUDE_FILENAMES:
        return True

    # Exclude .DS_Store anywhere
    if path.name == ".DS_Store":
        return True

    return False


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def collect_files(root: Path):
    """Walk root, yield (absolute_path, relative_path) for all included files."""
    for abs_path in sorted(root.rglob("*")):
        if not abs_path.is_file():
            continue
        if should_exclude(abs_path, root):
            continue
        rel = abs_path.relative_to(root)
        yield abs_path, rel


def verify_required(zip_paths: set):
    """Check that all required paths are present in the archive."""
    missing = []
    for req in REQUIRED_PATHS:
        zp = f"{ZIP_PREFIX}/{req}"
        if zp not in zip_paths:
            missing.append(req)
    return missing


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print(f"=== Submission Packaging: {OUTPUT_NAME} ===")
    print(f"Root: {ROOT}")
    print(f"Output: {OUTPUT_PATH}\n")

    # Confirm frontend/dist exists
    dist_index = ROOT / "frontend" / "dist" / "index.html"
    if not dist_index.exists():
        print("ERROR: frontend/dist/index.html not found — run 'npm run build' first.")
        sys.exit(1)

    # Confirm git bundle is current
    bundle = ROOT / "PASS_WORK_repo.bundle"
    if not bundle.exists():
        print("ERROR: PASS_WORK_repo.bundle not found — run 'git bundle create PASS_WORK_repo.bundle --all'")
        sys.exit(1)

    # Remove old archive if present
    if OUTPUT_PATH.exists():
        OUTPUT_PATH.unlink()
        print(f"Removed old archive: {OUTPUT_NAME}")

    # Build archive
    zip_paths = set()
    file_count = 0

    with zipfile.ZipFile(OUTPUT_PATH, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for abs_path, rel in collect_files(ROOT):
            arc_name = f"{ZIP_PREFIX}/{rel}"
            zf.write(abs_path, arc_name)
            zip_paths.add(arc_name)
            file_count += 1
            if file_count % 50 == 0:
                print(f"  Archived {file_count} files...")

    print(f"\nArchived {file_count} files total.")

    # Verify required files
    print("\n--- Verifying Required Files ---")
    missing = verify_required(zip_paths)
    if missing:
        print(f"[MISSING] {len(missing)} required file(s) not in archive:")
        for m in missing:
            print(f"  ✗ {m}")
        sys.exit(1)
    else:
        print(f"[OK] All {len(REQUIRED_PATHS)} required files present.")

    # Archive stats
    size_bytes = OUTPUT_PATH.stat().st_size
    size_mb = size_bytes / (1024 * 1024)
    checksum = sha256(OUTPUT_PATH)

    print(f"\n=== Archive Stats ===")
    print(f"Path      : {OUTPUT_PATH}")
    print(f"Files     : {file_count}")
    print(f"Size      : {size_bytes:,} bytes ({size_mb:.2f} MB)")
    print(f"SHA-256   : {checksum}")

    # List archive contents
    with zipfile.ZipFile(OUTPUT_PATH, "r") as zf:
        names = sorted(zf.namelist())

    print(f"\n--- Archive Contents ({len(names)} entries) ---")
    for n in names:
        print(f"  {n}")

    # Write checksum file alongside archive
    checksum_file = ROOT / f"{OUTPUT_NAME}.sha256"
    checksum_file.write_text(f"{checksum}  {OUTPUT_NAME}\n")
    print(f"\nChecksum file: {checksum_file}")

    print(f"\n=== DONE: {OUTPUT_NAME} is ready for submission ===")
    return checksum


if __name__ == "__main__":
    main()
