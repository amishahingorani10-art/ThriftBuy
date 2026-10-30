
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = PROJECT_DIR / "frontend"

# Start Flask backend
backend = subprocess.Popen(
    [sys.executable, "app.py"],
    cwd=PROJECT_DIR / "backend"
)

# Start frontend HTTP server
frontend = subprocess.Popen(
    [sys.executable, "-m", "http.server", "5500"],
    cwd=FRONTEND_DIR
)

try:
    time.sleep(2)
    webbrowser.open("http://127.0.0.1:5500/home.html")

    print("THRIFTBUY is running!")
    print("Website: http://127.0.0.1:5500/home.html")
    print("Press Ctrl+C to stop both servers.")

    while True:
        time.sleep(1)

except KeyboardInterrupt:
    print("\nStopping THRIFTBUY...")
    backend.terminate()
    frontend.terminate()
    backend.wait()
    frontend.wait()
