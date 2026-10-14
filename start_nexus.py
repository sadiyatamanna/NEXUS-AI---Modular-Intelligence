import os
import sys
import subprocess
import shutil
import time
import webbrowser

def print_banner():
    print("=" * 65)
    print("      NEXUS AI — Production Platform Orchestrator")
    print("=" * 65)

def is_python_functional(py_path):
    if not os.path.isfile(py_path):
        return False
    try:
        res = subprocess.run(
            [py_path, "-c", "import sys; sys.exit(0)"],
            capture_output=True,
            timeout=5
        )
        return res.returncode == 0
    except Exception:
        return False

def check_backend_dependencies(py_path):
    try:
        res = subprocess.run(
            [py_path, "-c", "import sys, fastapi, uvicorn, sqlalchemy; sys.exit(0)"],
            capture_output=True,
            timeout=5
        )
        return res.returncode == 0
    except Exception:
        return False

def ensure_backend_env(root_dir):
    backend_dir = os.path.join(root_dir, "backend")
    requirements_file = os.path.join(backend_dir, "requirements.txt")
    venv_dir = os.path.join(root_dir, ".venv")
    
    if sys.platform == "win32":
        venv_python = os.path.join(venv_dir, "Scripts", "python.exe")
    else:
        venv_python = os.path.join(venv_dir, "bin", "python")

    # 0. Ensure .env exists from template if freshly cloned from Git
    env_file = os.path.join(root_dir, ".env")
    env_example = os.path.join(root_dir, ".env.example")
    backend_env = os.path.join(backend_dir, ".env")
    if not os.path.exists(env_file) and os.path.exists(env_example):
        shutil.copy(env_example, env_file)
        print("[+] Created .env from .env.example")
    if not os.path.exists(backend_env) and os.path.exists(env_example):
        shutil.copy(env_example, backend_env)

    # 1. Check if an existing .venv is corrupted or from a different PC
    if os.path.exists(venv_dir):
        if not is_python_functional(venv_python):
            print("[!] Detected invalid or non-portable .venv (copied from another machine).")
            print("[*] Cleaning up invalid environment to rebuild cleanly for this machine...")
            try:
                shutil.rmtree(venv_dir)
            except Exception as e:
                print(f"[!] Warning: Could not remove old .venv: {e}. Falling back to system Python.")
                venv_python = sys.executable

    # 2. Create fresh .venv if not present
    if not os.path.exists(venv_dir):
        print("[*] Creating local Python virtual environment (.venv)...")
        try:
            subprocess.run([sys.executable, "-m", "venv", venv_dir], check=True)
            print("[+] Virtual environment created successfully.")
        except Exception as e:
            print(f"[!] Warning: Could not create .venv: {e}. Using system Python.")
            venv_python = sys.executable

    # Re-verify venv_python
    if not is_python_functional(venv_python):
        venv_python = sys.executable

    # 3. Check and install dependencies
    if not check_backend_dependencies(venv_python):
        print("[*] Installing backend dependencies from requirements.txt...")
        print("    (This only runs once on first setup and may take 1-2 minutes)")
        try:
            subprocess.run(
                [venv_python, "-m", "pip", "install", "--upgrade", "pip"],
                check=False,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            subprocess.run(
                [venv_python, "-m", "pip", "install", "-r", requirements_file],
                check=True
            )
            print("[+] Backend dependencies installed successfully.")
        except Exception as e:
            print(f"[!] Error installing dependencies: {e}")
            print(f"    Please manually run: {venv_python} -m pip install -r backend/requirements.txt")
            sys.exit(1)

    return venv_python

def start():
    print_banner()

    root_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(root_dir, "backend")
    frontend_dir = os.path.join(root_dir, "frontend")
    dist_dir = os.path.join(frontend_dir, "dist")

    # Step 1: Ensure Backend Environment
    print("\n[1/3] Verifying Python backend environment...")
    python_exe = ensure_backend_env(root_dir)
    print(f"      Using Python: {python_exe}")

    # Step 2: Check Frontend Setup
    print("\n[2/3] Checking Frontend configuration...")
    npm_path = shutil.which("npm")
    node_modules_dir = os.path.join(frontend_dir, "node_modules")
    frontend_proc = None
    use_vite_dev = False

    if npm_path:
        # Check if node_modules exists
        if not os.path.exists(node_modules_dir):
            print("      npm detected but node_modules missing.")
            print("      Installing frontend npm packages (this may take a minute)...")
            try:
                subprocess.run(["npm", "install"], cwd=frontend_dir, shell=True, check=True)
                print("      [+] Frontend packages installed.")
            except Exception as e:
                print(f"      [!] Warning: npm install failed: {e}")

        # Check if dist exists; if not and node_modules exists, build it
        if not os.path.exists(dist_dir) and os.path.exists(node_modules_dir):
            print("      Building production frontend assets...")
            try:
                subprocess.run(["npm", "run", "build"], cwd=frontend_dir, shell=True, check=True)
                print("      [+] Production frontend built successfully.")
            except Exception as e:
                print(f"      [!] Warning: npm run build failed: {e}")

        use_vite_dev = True
    else:
        print("      [i] Node.js/npm not found in PATH.")
        if os.path.exists(dist_dir):
            print("      [+] Pre-built frontend bundle (dist) detected!")
            print("      [+] NEXUS AI will serve frontend + backend together via FastAPI.")
        else:
            print("      [!] Note: To enable live frontend development, please install Node.js from https://nodejs.org")

    print("\n[3/3] Starting Services...")
    print("      Launching Backend API on http://127.0.0.1:8000 ...")
    backend_proc = subprocess.Popen(
        [python_exe, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"],
        cwd=backend_dir
    )

    # Allow backend a moment to spin up and check for early crash
    time.sleep(1.5)
    if backend_proc.poll() is not None:
        print(f"\n[!] Backend failed to start (exit code {backend_proc.returncode}).")
        print("    Run 'python -m uvicorn app.main:app' inside 'backend/' to diagnose.")
        sys.exit(1)

    if use_vite_dev:
        print("      Launching Frontend Dev Server on http://localhost:5173 ...")
        frontend_proc = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=frontend_dir,
            shell=True
        )
        time.sleep(1.0)

    print("\n" + "=" * 65)
    print("  >>> NEXUS AI IS RUNNING! <<<")
    if use_vite_dev:
        print("   * Frontend Workspace (Dev):  http://localhost:5173")
    print("   * Standalone Web App / API:  http://127.0.0.1:8000")
    print("   * Interactive API Docs:      http://127.0.0.1:8000/docs")
    print("   * Backend Health Check:      http://127.0.0.1:8000/api/health")
    print("=" * 65)
    print("\nPress Ctrl+C to terminate all services.\n")

    # Try to open the application in browser
    target_url = "http://localhost:5173" if use_vite_dev else "http://127.0.0.1:8000"
    try:
        webbrowser.open(target_url)
    except Exception:
        pass

    try:
        while True:
            time.sleep(1)
            # Check if backend unexpectedly died
            if backend_proc.poll() is not None:
                print("\n[!] Backend process stopped unexpectedly.")
                break
    except KeyboardInterrupt:
        print("\nStopping services...")
    finally:
        if backend_proc and backend_proc.poll() is None:
            backend_proc.terminate()
        if frontend_proc and frontend_proc.poll() is None:
            frontend_proc.terminate()
        print("Services cleanly stopped.")

if __name__ == "__main__":
    start()
