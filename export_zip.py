import os
import sys
import shutil
import zipfile
import subprocess

def create_distribution_zip():
    print("=" * 65)
    print("     NEXUS AI — Portable Distribution Packager")
    print("=" * 65)

    root_dir = os.path.dirname(os.path.abspath(__file__))
    frontend_dir = os.path.join(root_dir, "frontend")
    dist_dir = os.path.join(frontend_dir, "dist")
    output_zip = os.path.join(root_dir, "nexus-ai-portable.zip")

    # 1. Build frontend if npm is available
    npm_path = shutil.which("npm")
    if npm_path:
        print("\n[*] Building fresh production frontend (npm run build)...")
        try:
            subprocess.run(["npm", "run", "build"], cwd=frontend_dir, shell=True, check=True)
            print("[+] Frontend build succeeded.")
        except Exception as e:
            print(f"[!] Warning: npm run build failed: {e}")
    else:
        print("\n[i] npm not found in PATH; packing existing pre-built assets.")

    # 2. Files and patterns to strictly EXCLUDE from the distribution
    EXCLUDE_DIRS = {
        ".venv",
        "venv",
        "env",
        "node_modules",
        "__pycache__",
        ".pytest_cache",
        ".git",
        ".gemini",
        ".idea",
        ".vscode"
    }

    EXCLUDE_EXTENSIONS = {
        ".pyc",
        ".pyo",
        ".pyd"
    }

    EXCLUDE_FILES = {
        "test_nexus.db",
        "nexus-ai-portable.zip"
    }

    print(f"\n[*] Packaging project into: {output_zip} ...")
    if os.path.exists(output_zip):
        try:
            os.remove(output_zip)
        except Exception:
            pass

    file_count = 0
    total_size = 0

    with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zipf:
        for foldername, subfolders, filenames in os.walk(root_dir):
            # Prune directories in-place so os.walk does not traverse into them
            subfolders[:] = [d for d in subfolders if d not in EXCLUDE_DIRS]

            rel_folder = os.path.relpath(foldername, root_dir)
            if rel_folder == ".":
                rel_folder = ""

            for filename in filenames:
                if filename in EXCLUDE_FILES:
                    continue
                _, ext = os.path.splitext(filename)
                if ext in EXCLUDE_EXTENSIONS:
                    continue

                full_path = os.path.join(foldername, filename)
                rel_path = os.path.join(rel_folder, filename) if rel_folder else filename

                zipf.write(full_path, rel_path)
                file_count += 1
                total_size += os.path.getsize(full_path)

    zip_size_mb = os.path.getsize(output_zip) / (1024 * 1024)
    raw_size_mb = total_size / (1024 * 1024)

    print("\n" + "=" * 65)
    print("  >>> PACKAGING COMPLETE! <<<")
    print(f"  [1] Portable Full-Stack ZIP:  {output_zip} ({zip_size_mb:.2f} MB)")
    print("=" * 65 + "\n")

if __name__ == "__main__":
    create_distribution_zip()
