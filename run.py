"""
Prayadarshini - One-command launcher.

Priority: main.py (FastAPI backend) MUST start successfully first.
Only after the backend is healthy do the frontend + simulators launch.

Usage:  python run.py
Stop:   Ctrl+C in this terminal (kills everything)
"""
import subprocess
import sys
import os
import time
import signal
import socket
import urllib.request
import urllib.error

# ─────────────────────────────────────────────────────────
# PATHS
# ─────────────────────────────────────────────────────────
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
IS_WINDOWS  = os.name == "nt"

# Auto-detect venv python (Windows vs Unix)
VENV_PYTHON_WIN = os.path.join(PROJECT_DIR, "venv", "Scripts", "python.exe")
VENV_PYTHON_UNIX = os.path.join(PROJECT_DIR, "venv", "bin", "python")

if IS_WINDOWS and os.path.exists(VENV_PYTHON_WIN):
    VENV_PYTHON = VENV_PYTHON_WIN
elif not IS_WINDOWS and os.path.exists(VENV_PYTHON_UNIX):
    VENV_PYTHON = VENV_PYTHON_UNIX
else:
    # Fall back to whatever `python` is on PATH
    VENV_PYTHON = sys.executable
    print(f"⚠️  venv python not found — falling back to: {VENV_PYTHON}")

# ─────────────────────────────────────────────────────────
# PORT CHECK
# ─────────────────────────────────────────────────────────
BACKEND_HOST = "127.0.0.1"
BACKEND_PORT = int(os.environ.get("PORT", "8000"))
BACKEND_HEALTH = f"http://{BACKEND_HOST}:{BACKEND_PORT}/health"


def is_port_open(host: str, port: int, timeout: float = 0.5) -> bool:
    """Fast port probe — returns True if something is listening."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (OSError, ConnectionRefusedError):
        return False


def wait_for_backend(max_seconds: int = 30) -> bool:
    """
    Wait until /health responds with 200 AND the port is actually open.
    Returns True on success, False on timeout.
    """
    deadline = time.time() + max_seconds
    attempt = 0
    while time.time() < deadline:
        attempt += 1
        # First check the port is open at all
        if not is_port_open(BACKEND_HOST, BACKEND_PORT):
            time.sleep(0.5)
            continue
        # Now check the health endpoint
        try:
            with urllib.request.urlopen(BACKEND_HEALTH, timeout=2) as resp:
                if resp.status == 200:
                    return True
        except (urllib.error.URLError, urllib.error.HTTPError, socket.timeout):
            pass
        # Also accept the older root-probe fallback if /health isn't defined
        try:
            with urllib.request.urlopen(f"http://{BACKEND_HOST}:{BACKEND_PORT}/docs", timeout=2) as resp:
                if resp.status == 200:
                    return True
        except Exception:
            pass
        time.sleep(0.5)
    return False


# ─────────────────────────────────────────────────────────
# SERVICE DEFINITIONS
# ─────────────────────────────────────────────────────────
# main.py is a special "primary" service — everything else is optional.
PRIMARY_SERVICE = {
    "name": "Backend (main.py)",
    "cwd": PROJECT_DIR,
    "cmd": [VENV_PYTHON, "main.py"],
}

SECONDARY_SERVICES = [
    {
        "name": "Frontend (React dev server)",
        "cwd": os.path.join(PROJECT_DIR, "prayadarshini-client"),
        "cmd": ["cmd", "/c", "npm", "start"] if IS_WINDOWS else ["npm", "start"],
        "optional": True,   # Don't abort the whole launcher if npm fails
    },
    {
        "name": "Maitri MQTT Simulator",
        "cwd": PROJECT_DIR,
        "cmd": [VENV_PYTHON, "mqtt_sensor_simulator.py"],
        "optional": True,
    },
    {
        "name": "Bharati MQTT Simulator",
        "cwd": PROJECT_DIR,
        "cmd": [VENV_PYTHON, "mqtt_sensor_simulator_bharati.py"],
        "optional": True,
    },
]


def spawn(svc: dict) -> subprocess.Popen | None:
    """Launch a service in its own console (Windows) or detached (Unix)."""
    try:
        kwargs = {"cwd": svc["cwd"]}
        if IS_WINDOWS:
            kwargs["creationflags"] = subprocess.CREATE_NEW_CONSOLE
        else:
            kwargs["start_new_session"] = True
        return subprocess.Popen(svc["cmd"], **kwargs)
    except FileNotFoundError as e:
        print(f"  ❌ Could not launch {svc['name']}: {e}")
        return None
    except Exception as e:
        print(f"  ❌ {svc['name']} failed: {type(e).__name__}: {e}")
        return None


def banner():
    print("=" * 64)
    print("  🚀 PRAYADARSHINI — POLAR TWIN LAUNCHER")
    print("=" * 64)
    print(f"  Project  : {PROJECT_DIR}")
    print(f"  Python   : {VENV_PYTHON}")
    print(f"  Backend  : http://{BACKEND_HOST}:{BACKEND_PORT}")
    print("=" * 64)
    print()


def main():
    banner()

    # ─── PRE-FLIGHT CHECKS ─────────────────────────────────
    main_py_path = os.path.join(PROJECT_DIR, "main.py")
    if not os.path.exists(main_py_path):
        print(f"❌ FATAL: main.py not found at {main_py_path}")
        sys.exit(1)

    # If something is already on port 8000, warn the user
    if is_port_open(BACKEND_HOST, BACKEND_PORT):
        print(f"⚠️  Port {BACKEND_PORT} is already in use.")
        print(f"   Another backend might be running. Close it first, or")
        print(f"   change PORT env var, then re-run this launcher.")
        print()
        ans = input("Continue anyway? [y/N] ").strip().lower()
        if ans != "y":
            sys.exit(1)

    # ─── STEP 1: START main.py (PRIMARY) ──────────────────
    print(f"[1/2] Starting {PRIMARY_SERVICE['name']}...")
    backend_proc = spawn(PRIMARY_SERVICE)
    if backend_proc is None:
        print("❌ FATAL: Could not launch main.py. Aborting.")
        sys.exit(1)

    print(f"      PID {backend_proc.pid} · waiting for /health ...")
    if not wait_for_backend(max_seconds=10):
        print("❌ FATAL: main.py did not become healthy within 30 s.")
        print("   Check the backend console window for the error.")
        print("   Common causes:")
        print("     • Missing dependencies  → pip install -r requirements.txt")
        print("     • Port already in use   → kill the other process")
        print("     • Import error in code  → read the traceback in the console")
        backend_proc.terminate()
        sys.exit(1)

    print(f"      ✅ Backend is HEALTHY at {BACKEND_HEALTH}")
    print()

    # ─── STEP 2: START SECONDARY SERVICES ─────────────────
    processes: list[tuple[str, subprocess.Popen]] = [("Backend", backend_proc)]

    print("[2/2] Starting secondary services...")
    for svc in SECONDARY_SERVICES:
        print(f"      → {svc['name']}")
        p = spawn(svc)
        if p is None and not svc.get("optional"):
            print(f"❌ FATAL: {svc['name']} failed to start.")
            shutdown_all(processes)
            sys.exit(1)
        if p is not None:
            processes.append((svc["name"], p))
        time.sleep(1.5)  # stagger so consoles don't overlap

    # ─── DONE ──────────────────────────────────────────────
    print()
    print("=" * 64)
    print("  ✅ ALL SERVICES LAUNCHED")
    print("=" * 64)
    print(f"  Backend  →  http://localhost:{BACKEND_PORT}")
    print(f"  Docs     →  http://localhost:{BACKEND_PORT}/docs")
    print(f"  Frontend →  http://localhost:3000  (React dev server)")
    print()
    print("  Press Ctrl+C to stop everything.")
    print("=" * 64)
    print()

    # ─── WAIT LOOP (with clean shutdown) ──────────────────
    try:
        # If the backend dies, we stop everything.
        while True:
            if backend_proc.poll() is not None:
                print(f"\n⚠️  Backend exited with code {backend_proc.returncode}.")
                print("   Shutting down remaining services.")
                break
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n🛑 Ctrl+C received — stopping all services...")
    finally:
        shutdown_all(processes)


def shutdown_all(processes: list[tuple[str, subprocess.Popen]]):
    """Terminate every child process we spawned, politely then forcefully."""
    for name, p in processes:
        if p.poll() is None:
            print(f"  Stopping {name} ...")
            try:
                p.terminate()
            except Exception:
                pass

    # Give them a moment to exit cleanly
    time.sleep(2)

    for name, p in processes:
        if p.poll() is None:
            print(f"  Force-killing {name} ...")
            try:
                p.kill()
            except Exception:
                pass

    print("✅ All services stopped.")


if __name__ == "__main__":
    # On Unix, ignore SIGINT in the parent so children can handle it;
    # we rely on our own KeyboardInterrupt handling.
    if not IS_WINDOWS:
        signal.signal(signal.SIGINT, signal.default_int_handler)
    main()